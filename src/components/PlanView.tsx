import type { ActionEffect } from "@/engine";
import type { Language } from "@/lib/labels";
import type { PlanResponse } from "@/lib/planTypes";
import { ImpactChip } from "./ImpactChip";
import type { Translate } from "./i18n";
import { Icon, type IconName } from "./Icon";

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

/** The AI-written day plan. Impact chips are attached by the server from the engine, never written by the model. */
export function PlanCard({ t, planLang, result }: Props) {
  const { plan, ledger, meta } = result;
  return (
    <section className="card plan-card" aria-labelledby="plan-title">
      <h3 className="card-title" id="plan-title">
        <Icon name="sun" /> {t("planTitle")}
      </h3>
      <p className={meta.aiUsed ? "ai-note" : "ai-note fallback"}>
        <Icon name="spark" size={16} />{" "}
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
            <h4>{t("timeline")}</h4>
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
        {plan.caveats.length > 0 && (
          <>
            <h4>{t("caveats")}</h4>
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

function ItemsCard({
  id,
  icon,
  title,
  items,
  planLang,
  t,
}: {
  id: string;
  icon: IconName;
  title: string;
  items: Array<{ title: string; body: string; impact?: ActionEffect }>;
  planLang: Language;
  t: Translate;
}) {
  if (items.length === 0) return null;
  return (
    <section className="card" aria-labelledby={id}>
      <h3 className="card-title" id={id}>
        <Icon name={icon} /> {title}
      </h3>
      <ul className="items" lang={planLang}>
        {items.map((item, i) => (
          <li key={i}>
            <strong>{item.title}</strong>
            <p>{item.body}</p>
            <Impact impact={item.impact} t={t} />
          </li>
        ))}
      </ul>
    </section>
  );
}

export function IndoorCard({ t, planLang, result }: Props) {
  const items = result.plan.indoorHacks.map((h) => ({ title: h.title, body: h.how, impact: h.impact }));
  return <ItemsCard id="indoor-title" icon="home" title={t("indoor")} items={items} planLang={planLang} t={t} />;
}

export function SwapsCard({ t, planLang, result }: Props) {
  const items = result.plan.sustainableSwaps.map((s) => ({ title: s.title, body: s.why, impact: s.impact }));
  return <ItemsCard id="swaps-title" icon="leaf" title={t("swaps")} items={items} planLang={planLang} t={t} />;
}

export function CommunityCard({ t, planLang, result }: Props) {
  if (result.plan.questions.length === 0) return null;
  return (
    <section className="card" aria-labelledby="community-title">
      <h3 className="card-title" id="community-title">
        <Icon name="users" /> {t("ask")}
      </h3>
      <ul className="plain" lang={planLang}>
        {result.plan.questions.map((q, i) => (
          <li key={i}>{q}</li>
        ))}
      </ul>
    </section>
  );
}
