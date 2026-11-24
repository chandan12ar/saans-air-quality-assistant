import { describe, expect, it } from "vitest";
import { buildLedger } from "@/engine";
import { simulatedDay } from "@/lib/airQuality";
import { contextFor } from "@/lib/context";
import { buildFallbackPlan } from "@/lib/fallbackPlan";
import { findUngroundedNumbers } from "@/lib/planValidation";
import { demoRequest } from "./fixtures";

const homebody = () => ({
  ...demoRequest().profile,
  ageBand: "older" as const,
  awayDuringDay: false,
  outdoorActivity: "morning" as const,
  commuteMode: "walk" as const,
  commuteKm: 1,
  purifierCadr: 250,
});

function planFor(profile = demoRequest().profile, peak = 300, language: "en" | "hi" = "en") {
  const hourly = simulatedDay(peak);
  const ledger = buildLedger(contextFor(profile, hourly));
  return { ledger, hourly, plan: buildFallbackPlan({ ledger, hourly, language, placeLabel: "Test City" }) };
}

describe("shift_outdoor moves", () => {
  it("exposes the hours the engine actually moves an activity between", () => {
    const { ledger } = planFor(homebody());
    const shift = ledger.actions.find((a) => a.id === "shift_outdoor");
    expect(shift?.moves?.length).toBeGreaterThan(0);
    const move = shift?.moves?.[0];
    expect(move?.from).toBe(6);
    expect(move?.to).toBeGreaterThanOrEqual(6);
    expect(move?.to).toBeLessThanOrEqual(19);
  });

  it("offers no move when the household's schedule leaves no cleaner usable hour", () => {
    const { ledger } = planFor(demoRequest().profile);
    expect(ledger.actions.find((a) => a.id === "shift_outdoor")).toBeUndefined();
  });
});

describe("buildFallbackPlan", () => {
  it("uses the engine's move rather than guessing a clean hour that the household cannot use", () => {
    const { plan, ledger } = planFor(homebody());
    const move = ledger.actions.find((a) => a.id === "shift_outdoor")?.moves?.[0];
    const item = plan.timeline.find((t) => t.actionId === "shift_outdoor");
    expect(item?.hour).toBe(move?.to);
  });

  it("does not suggest outdoor time at hours a school-going family is away", () => {
    const { plan } = planFor(demoRequest().profile);
    expect(plan.timeline.some((t) => t.actionId === "shift_outdoor")).toBe(false);
    expect(plan.timeline.some((t) => /outdoor/i.test(t.title))).toBe(false);
  });

  it("only references actions the ledger offered", () => {
    const { plan, ledger } = planFor(homebody());
    const allowed = new Set(ledger.actions.map((a) => a.id));
    const refs = [...plan.timeline, ...plan.indoorHacks, ...plan.sustainableSwaps].map((i) => i.actionId).filter(Boolean);
    expect(refs.every((r) => r && allowed.has(r))).toBe(true);
  });

  it("never contains invented impact figures", () => {
    for (const language of ["en", "hi"] as const) {
      const { plan } = planFor(homebody(), 300, language);
      expect(findUngroundedNumbers(plan)).toEqual([]);
    }
  });

  it("writes Hindi in Devanagari", () => {
    const { plan } = planFor(homebody(), 300, "hi");
    expect(plan.summary).toMatch(/[ऀ-ॿ]/);
    expect(plan.caveats.join(" ")).toMatch(/[ऀ-ॿ]/);
  });

  it("stays calm on a clean day", () => {
    const { plan } = planFor(homebody(), 15);
    expect(plan.indoorHacks).toHaveLength(0);
    expect(plan.summary).toMatch(/acceptable/i);
  });
});
