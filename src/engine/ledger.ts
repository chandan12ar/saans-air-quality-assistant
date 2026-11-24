import { ACTIONS, type PlanContext } from "./actions";
import { computeDose } from "./model";
import type { ActionEffect, ActionId, Ledger, Range, ScenarioName } from "./types";

const SCENARIOS: ScenarioName[] = ["optimistic", "central", "pessimistic"];

const toRange = (central: number, values: number[]): Range => ({
  low: Math.min(...values),
  central,
  high: Math.max(...values),
});

const doseFor = (ctx: PlanContext, scenario: ScenarioName) =>
  computeDose(ctx.outdoor, ctx.slots, ctx.person, ctx.home, scenario).totalUg;

/**
 * Builds the before/after exposure ledger.
 * Each action's effect is its marginal effect on the baseline day. The planned day applies
 * every enabled action in order, except opt-in trade-offs (actions that raise exposure).
 */
export function buildLedger(base: PlanContext, enabled?: ReadonlySet<ActionId>): Ledger {
  const baseline = Object.fromEntries(SCENARIOS.map((s) => [s, doseFor(base, s)])) as Record<ScenarioName, number>;

  const marginal: Array<{ id: ActionId; effect: ActionEffect; central: number }> = [];
  for (const action of ACTIONS) {
    if (enabled && !enabled.has(action.id)) continue;
    const result = action.run(base);
    if (!result) continue;
    const after = { ...base, slots: result.slots, home: result.home };
    const avoided = SCENARIOS.map((s) => baseline[s] - doseFor(after, s));
    const central = baseline.central - doseFor(after, "central");
    marginal.push({
      id: action.id,
      central,
      effect: {
        id: action.id,
        avoidedUg: toRange(central, avoided),
        co2eAvoidedG: result.co2eAvoidedG,
        applied: central >= 0,
        detail: result.detail,
        ...(result.moves ? { moves: result.moves } : {}),
      },
    });
  }

  // Apply recommended (non-negative) actions sequentially to get the planned day.
  let ctx = base;
  for (const { id, central } of marginal) {
    if (central < 0) continue;
    const action = ACTIONS.find((a) => a.id === id);
    const result = action?.run(ctx);
    if (result) ctx = { ...ctx, slots: result.slots, home: result.home };
  }

  const planned = Object.fromEntries(SCENARIOS.map((s) => [s, doseFor(ctx, s)])) as Record<ScenarioName, number>;
  const pct = (s: ScenarioName) => (baseline[s] > 0 ? ((baseline[s] - planned[s]) / baseline[s]) * 100 : 0);

  const maxOutdoor = Math.max(...base.outdoor);
  return {
    baselineUg: toRange(baseline.central, SCENARIOS.map((s) => baseline[s])),
    plannedUg: toRange(planned.central, SCENARIOS.map((s) => planned[s])),
    reductionPct: toRange(pct("central"), SCENARIOS.map(pct)),
    actions: marginal.map((m) => m.effect),
    nothingToDo: maxOutdoor <= 30,
  };
}
