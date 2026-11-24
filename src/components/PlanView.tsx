import type { ActionEffect } from "@/engine";
import type { Language } from "@/lib/labels";
import type { PlanResponse } from "@/lib/planTypes";
import { ImpactChip } from "./ImpactChip";
import type { Translate } from "./i18n";

const hh = (h: number) => `${String(h).padStart(2, "0")}:00`;

function Impact({ impact, t }: { impact?: ActionEffect; t: Translate }) {
  return impact ? <ImpactChip impact={impact} t={t} /> : null;
}

interface Props {
  t: Translate;
  /** Language the plan text was written in (may differ from the interface language). */
  planLang: Language;
  result: PlanResponse;
}

export function PlanView({ t, planLang, result }: Props) {
  const { plan, ledger, meta } = result;
  return (
    <section className="panel" aria-labelledby="plan-title">
      <h2 id="plan-title">{t("planTitle")}</h2>

      <p className={meta.aiUsed ? "ai-note" : "ai-note fallback"}>
        {meta.aiUsed
          ? meta.cached
            ? t("aiCached", meta.model ?? "")
            : t("aiOk", meta.model ?? "", ((meta.latencyMs ?? 0) / 1000).toFixed(1))
          : t("aiFallback", meta.fallbackReason?.message ?? "")}
      </p>

      {ledger.nothingToDo && <p className="calm">{t("cleanDay")}</p>}
      <div lang={planLang}>
        <p className="summary">{plan.summary}</p>

        {plan.timeline.length > 0 && (
          <>
            <h3>{t("timeline")}</h3>
            <ol className="timeline">
              {plan.timeline.map((item, i) => (
                <li key={`${item.hour}-${i}`}>
                  <time className="when">{hh(item.hour)}</time>
                  <div>
                    <strong>{item.title}</strong>
                    <p>{item.why}</p>
                    <Impact impact={item.impact} t={t} />
                  </div>
                </li>
              ))}
            </ol>
          </>
        )}

        {plan.indoorHacks.length > 0 && (
          <>
            <h3>{t("indoor")}</h3>
            <ul className="cards">
              {plan.indoorHacks.map((h, i) => (
                <li key={i}>
                  <strong>{h.title}</strong>
                  <p>{h.how}</p>
                  <Impact impact={h.impact} t={t} />
                </li>
              ))}
            </ul>
          </>
        )}

        {plan.sustainableSwaps.length > 0 && (
          <>
            <h3>{t("swaps")}</h3>
            <ul className="cards">
              {plan.sustainableSwaps.map((s, i) => (
                <li key={i}>
                  <strong>{s.title}</strong>
                  <p>{s.why}</p>
                  <Impact impact={s.impact} t={t} />
                </li>
              ))}
            </ul>
          </>
        )}

        {plan.questions.length > 0 && (
          <>
            <h3>{t("ask")}</h3>
            <ul className="plain">
              {plan.questions.map((q, i) => (
                <li key={i}>{q}</li>
              ))}
            </ul>
          </>
        )}

        {plan.caveats.length > 0 && (
          <>
            <h3>{t("caveats")}</h3>
            <ul className="plain muted">
              {plan.caveats.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          </>
        )}
      </div>
    </section>
  );
}
