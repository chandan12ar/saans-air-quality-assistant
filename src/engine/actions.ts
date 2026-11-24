import { bandAtLeast, pm25ToAqi } from "./aqi";
import { COMMUTE_G_CO2E_PER_KM, DIY_FILTER_CADR_M3_PER_H } from "./constants";
import type { ActionId, HourSlot, Home, Person } from "./types";

export interface PlanContext {
  outdoor: readonly number[];
  slots: readonly HourSlot[];
  person: Person;
  home: Home;
  /** One-way commute distance in km; each commute slot is one leg. */
  commuteKm: number;
}

export interface ActionResult {
  slots: HourSlot[];
  home: Home;
  co2eAvoidedG?: number;
  detail: string;
  /** For shift_outdoor: which hours the activity moves from and to (0-23). */
  moves?: Array<{ from: number; to: number }>;
}

const hh = (h: number): string => `${String(h).padStart(2, "0")}:00`;
const at = (values: readonly number[], i: number): number => values[i] ?? 0;

type ActionFn = (ctx: PlanContext) => ActionResult | null;

const shiftOutdoor: ActionFn = (ctx) => {
  const slots = ctx.slots.map((s) => ({ ...s }));
  const moves: string[] = [];
  const hourMoves: Array<{ from: number; to: number }> = [];
  const movable = slots
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => s.place === "outdoor" && s.movable)
    .sort((a, b) => at(ctx.outdoor, b.i) - at(ctx.outdoor, a.i));

  for (const { i } of movable) {
    let best = -1;
    for (let h = 6; h <= 19; h++) {
      const cand = slots[h];
      if (!cand || cand.place !== "home" || cand.movable) continue;
      if (best === -1 || at(ctx.outdoor, h) < at(ctx.outdoor, best)) best = h;
    }
    if (best === -1 || at(ctx.outdoor, best) >= at(ctx.outdoor, i)) continue;
    const moved = slots[i];
    const replaced = slots[best];
    if (!moved || !replaced) continue;
    slots[best] = { ...moved };
    slots[i] = { place: "home", activity: replaced.activity, windowsOpen: false };
    moves.push(`Move outdoor activity from ${hh(i)} (PM2.5 ${Math.round(at(ctx.outdoor, i))}) to ${hh(best)} (PM2.5 ${Math.round(at(ctx.outdoor, best))})`);
    hourMoves.push({ from: i, to: best });
  }
  return moves.length ? { slots, home: ctx.home, detail: moves.join("; "), moves: hourMoves } : null;
};

const closeWindows: ActionFn = (ctx) => {
  const hours: number[] = [];
  const slots = ctx.slots.map((s, h) => {
    if (s.place === "home" && s.windowsOpen && at(ctx.outdoor, h) > 30) {
      hours.push(h);
      return { ...s, windowsOpen: false };
    }
    return { ...s };
  });
  return hours.length
    ? { slots, home: ctx.home, detail: `Keep windows closed during ${hours.length} hour(s) when outdoor PM2.5 is above the good band` }
    : null;
};

const purifierSlots = (ctx: PlanContext): HourSlot[] | null => {
  const mean = ctx.outdoor.reduce((a, b) => a + b, 0) / 24;
  if (mean <= 30) return null;
  return ctx.slots.map((s) => (s.place === "home" ? { ...s, purifier: true } : { ...s }));
};

const runPurifier: ActionFn = (ctx) => {
  if (ctx.home.purifierCadr <= 0) return null;
  const slots = purifierSlots(ctx);
  return slots ? { slots, home: ctx.home, detail: "Run your air purifier whenever someone is home, with windows closed" } : null;
};

const diyFilter: ActionFn = (ctx) => {
  if (ctx.home.purifierCadr > 0) return null;
  const slots = purifierSlots(ctx);
  return slots
    ? {
        slots,
        home: { ...ctx.home, purifierCadr: DIY_FILTER_CADR_M3_PER_H.value },
        detail: "Build a box-fan filter (fan plus MERV-13 filters) and run it in the main room when at home",
      }
    : null;
};

const maskUnavoidable: ActionFn = (ctx) => {
  let count = 0;
  const slots = ctx.slots.map((s, h) => {
    const exposed = s.place === "outdoor" || (s.place === "commute" && s.commuteMode !== "car_closed");
    if (exposed && !s.mask && bandAtLeast(pm25ToAqi(at(ctx.outdoor, h)).band, "poor")) {
      count++;
      return { ...s, mask: true };
    }
    return { ...s };
  });
  return count ? { slots, home: ctx.home, detail: `Wear a well-fitted N95/FFP2 mask for ${count} unavoidable outdoor hour(s)` } : null;
};

const swapCommute: ActionFn = (ctx) => {
  let grams = 0;
  let count = 0;
  const slots = ctx.slots.map((s) => {
    if (s.place === "commute" && (s.commuteMode === "car_closed" || s.commuteMode === "two_wheeler")) {
      const from = COMMUTE_G_CO2E_PER_KM.value[s.commuteMode];
      grams += (from - COMMUTE_G_CO2E_PER_KM.value.metro) * ctx.commuteKm;
      count++;
      return { ...s, commuteMode: "metro" as const };
    }
    return { ...s };
  });
  return count
    ? { slots, home: ctx.home, co2eAvoidedG: Math.round(grams), detail: "Switch private-vehicle commute legs to metro or bus" }
    : null;
};

export const ACTIONS: ReadonlyArray<{ id: ActionId; run: ActionFn }> = [
  { id: "shift_outdoor", run: shiftOutdoor },
  { id: "close_windows", run: closeWindows },
  { id: "run_purifier", run: runPurifier },
  { id: "diy_filter", run: diyFilter },
  { id: "mask_unavoidable", run: maskUnavoidable },
  { id: "swap_commute", run: swapCommute },
];
