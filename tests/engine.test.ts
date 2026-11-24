import { describe, expect, it } from "vitest";
import {
  bandAtLeast,
  buildDefaultSlots,
  buildLedger,
  computeDose,
  pm25ToAqi,
  type HourSlot,
  type Home,
  type PlanContext,
  type Person,
} from "@/engine";

const flat = (v: number): number[] => Array.from({ length: 24 }, () => v);
/** Smoggy winter day: heavy morning and evening, cleaner afternoon. */
const smoggyDay = (): number[] =>
  Array.from({ length: 24 }, (_, h) => (h >= 12 && h <= 15 ? 70 : h >= 17 && h <= 22 ? 220 : 160));

const child: Person = { ageBand: "child" };
const baseHome: Home = { windows: "typical", purifierCadr: 0, roomVolumeM3: 30 };

const routine = (over: Partial<Parameters<typeof buildDefaultSlots>[0]> = {}) =>
  buildDefaultSlots({
    commuteMode: "two_wheeler",
    commuteKm: 8,
    awayDuringDay: true,
    outdoorActivity: "evening",
    windowsOpenHabit: true,
    ...over,
  });

const ctx = (over: Partial<PlanContext> = {}): PlanContext => ({
  outdoor: smoggyDay(),
  slots: routine(),
  person: child,
  home: baseHome,
  commuteKm: 8,
  ...over,
});

describe("pm25ToAqi (CPCB bands)", () => {
  it.each([
    [0, "good", 0],
    [30, "good", 50],
    [30.1, "satisfactory", 51],
    [60, "satisfactory", 100],
    [90, "moderate", 200],
    [120, "poor", 300],
    [250, "very_poor", 400],
    [251, "severe", 401],
  ])("PM2.5 %s -> %s (sub-index %s)", (c, band, idx) => {
    const r = pm25ToAqi(c);
    expect(r.band).toBe(band);
    expect(r.subIndex).toBe(idx);
  });

  it("caps the sub-index at 500 for extreme values", () => {
    expect(pm25ToAqi(900)).toEqual({ band: "severe", subIndex: 500 });
  });

  it.each([-1, NaN, Infinity])("rejects invalid concentration %s", (c) => {
    expect(() => pm25ToAqi(c)).toThrow(RangeError);
  });

  it("orders bands correctly", () => {
    expect(bandAtLeast("poor", "moderate")).toBe(true);
    expect(bandAtLeast("good", "poor")).toBe(false);
  });
});

describe("computeDose", () => {
  it("rejects wrong lengths and invalid values", () => {
    expect(() => computeDose([1, 2], routine(), child, baseHome)).toThrow(RangeError);
    expect(() => computeDose(flat(50), routine().slice(0, 5), child, baseHome)).toThrow(RangeError);
    expect(() => computeDose([...flat(50).slice(1), NaN], routine(), child, baseHome)).toThrow(RangeError);
    expect(() => computeDose([...flat(50).slice(1), -3], routine(), child, baseHome)).toThrow(RangeError);
  });

  it("is zero for zero pollution", () => {
    expect(computeDose(flat(0), routine(), child, baseHome).totalUg).toBe(0);
  });

  it("increases monotonically with outdoor concentration", () => {
    const low = computeDose(flat(50), routine(), child, baseHome).totalUg;
    const high = computeDose(flat(150), routine(), child, baseHome).totalUg;
    expect(high).toBeGreaterThan(low);
  });

  it("is roughly proportional to concentration (linear model)", () => {
    const a = computeDose(flat(50), routine(), child, baseHome).totalUg;
    const b = computeDose(flat(100), routine(), child, baseHome).totalUg;
    expect(b / a).toBeCloseTo(2, 5);
  });

  it("tighter windows lower the indoor dose", () => {
    const stay = Array.from({ length: 24 }, (): HourSlot => ({ place: "home", activity: "rest" }));
    const tight = computeDose(flat(200), stay, child, { ...baseHome, windows: "tight" }).totalUg;
    const leaky = computeDose(flat(200), stay, child, { ...baseHome, windows: "leaky" }).totalUg;
    expect(tight).toBeLessThan(leaky);
  });

  it("open windows raise the dose versus closed", () => {
    const closed = Array.from({ length: 24 }, (): HourSlot => ({ place: "home", activity: "light", windowsOpen: false }));
    const open = closed.map((s): HourSlot => ({ ...s, windowsOpen: true }));
    expect(computeDose(flat(200), open, child, baseHome).totalUg).toBeGreaterThan(
      computeDose(flat(200), closed, child, baseHome).totalUg,
    );
  });

  it("a purifier lowers the dose, and a larger one lowers it more", () => {
    const withP = (cadr: number) =>
      computeDose(flat(200), routine().map((s) => ({ ...s, purifier: s.place === "home" })), child, { ...baseHome, purifierCadr: cadr }).totalUg;
    expect(withP(150)).toBeLessThan(withP(0));
    expect(withP(300)).toBeLessThan(withP(150));
  });

  it("a mask only helps outdoors or in transit", () => {
    const stay = Array.from({ length: 24 }, (): HourSlot => ({ place: "home", activity: "light", mask: true }));
    const unmasked = stay.map((s): HourSlot => ({ ...s, mask: false }));
    expect(computeDose(flat(200), stay, child, baseHome).totalUg).toBeCloseTo(computeDose(flat(200), unmasked, child, baseHome).totalUg, 9);
    const out = Array.from({ length: 24 }, (): HourSlot => ({ place: "outdoor", activity: "light", mask: true }));
    const outBare = out.map((s): HourSlot => ({ ...s, mask: false }));
    expect(computeDose(flat(200), out, child, baseHome).totalUg).toBeLessThan(computeDose(flat(200), outBare, child, baseHome).totalUg);
  });

  it("children inhale less than adults per hour at the same activity (scale assumption)", () => {
    const adult = computeDose(flat(100), routine(), { ageBand: "adult" }, baseHome).totalUg;
    expect(computeDose(flat(100), routine(), child, baseHome).totalUg).toBeLessThan(adult);
  });

  it("pessimistic scenario is not below optimistic", () => {
    const o = computeDose(smoggyDay(), routine(), child, baseHome, "optimistic").totalUg;
    const p = computeDose(smoggyDay(), routine(), child, baseHome, "pessimistic").totalUg;
    expect(p).toBeGreaterThan(o);
  });
});

describe("buildLedger", () => {
  it("shows a positive reduction on a smoggy day, ordered ranges, never above 100%", () => {
    const l = buildLedger(ctx());
    expect(l.reductionPct.central).toBeGreaterThan(5);
    expect(l.reductionPct.high).toBeLessThanOrEqual(100);
    for (const r of [l.baselineUg, l.plannedUg, l.reductionPct]) {
      expect(r.low).toBeLessThanOrEqual(r.central);
      expect(r.central).toBeLessThanOrEqual(r.high);
    }
    expect(l.plannedUg.central).toBeLessThan(l.baselineUg.central);
    expect(l.nothingToDo).toBe(false);
  });

  it("recommends shifting the evening outdoor hour to the cleaner afternoon", () => {
    const l = buildLedger(ctx());
    const shift = l.actions.find((a) => a.id === "shift_outdoor");
    expect(shift?.avoidedUg.central).toBeGreaterThan(0);
    expect(shift?.detail).toContain("18:00");
  });

  it("offers a DIY filter when there is no purifier, and a purifier action when there is", () => {
    expect(buildLedger(ctx()).actions.map((a) => a.id)).toContain("diy_filter");
    const ids = buildLedger(ctx({ home: { ...baseHome, purifierCadr: 250 } })).actions.map((a) => a.id);
    expect(ids).toContain("run_purifier");
    expect(ids).not.toContain("diy_filter");
  });

  it("reports nothing to do on a clean-air day", () => {
    const l = buildLedger(ctx({ outdoor: flat(12) }));
    expect(l.nothingToDo).toBe(true);
    expect(l.actions.find((a) => a.id === "mask_unavoidable")).toBeUndefined();
    expect(l.actions.find((a) => a.id === "shift_outdoor")).toBeUndefined();
  });

  it("keeps the shift action out when the activity is already in the cleanest hour", () => {
    const outdoor = flat(150);
    outdoor[18] = 10;
    expect(buildLedger(ctx({ outdoor })).actions.find((a) => a.id === "shift_outdoor")).toBeUndefined();
  });

  it("treats swapping a closed car for the metro as an opt-in trade-off with an emissions saving", () => {
    const l = buildLedger(ctx({ slots: routine({ commuteMode: "car_closed" }) }));
    const swap = l.actions.find((a) => a.id === "swap_commute");
    expect(swap).toBeDefined();
    expect(swap?.avoidedUg.central).toBeLessThan(0);
    expect(swap?.applied).toBe(false);
    expect(swap?.co2eAvoidedG).toBeGreaterThan(0);
  });

  it("respects an enabled-actions filter", () => {
    const l = buildLedger(ctx(), new Set(["close_windows"]));
    expect(l.actions.map((a) => a.id)).toEqual(["close_windows"]);
  });

  it("handles a household that is home all day with no commute or outdoor activity", () => {
    const slots = routine({ awayDuringDay: false, outdoorActivity: "none", windowsOpenHabit: false });
    const l = buildLedger(ctx({ slots }));
    expect(l.actions.find((a) => a.id === "swap_commute")).toBeUndefined();
    expect(Number.isFinite(l.reductionPct.central)).toBe(true);
  });

  it("copes with extreme pollution without NaN", () => {
    const l = buildLedger(ctx({ outdoor: flat(900) }));
    expect(Number.isFinite(l.baselineUg.central)).toBe(true);
    expect(l.reductionPct.central).toBeGreaterThanOrEqual(0);
  });
});
