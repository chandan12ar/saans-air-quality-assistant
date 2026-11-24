import type { ActionEffect } from "@/engine";
import type { Translate } from "./i18n";

const n = (v: number) => Math.round(v).toLocaleString("en-IN");

/** Engine-computed impact for one action. The numbers never come from the AI. */
export function ImpactChip({ impact, t }: { impact: ActionEffect; t: Translate }) {
  if (!impact.applied) {
    return <span className="chip warn">{t("tradeoff", n(Math.abs(impact.avoidedUg.central)))}</span>;
  }
  return (
    <span className="chips">
      <span className="chip good">{t("impactLess", n(impact.avoidedUg.central), n(impact.avoidedUg.low), n(impact.avoidedUg.high))}</span>
      {impact.co2eAvoidedG !== undefined && impact.co2eAvoidedG > 0 && <span className="chip good">{t("impactCo2", n(impact.co2eAvoidedG))}</span>}
    </span>
  );
}
