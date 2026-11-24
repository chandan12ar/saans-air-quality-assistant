import { pm25ToAqi } from "@/engine";
import type { Language } from "@/lib/labels";
import type { PlanResponse } from "@/lib/planTypes";
import { BandBadge } from "./ForecastView";
import type { Translate } from "./i18n";
import { TraceDialog } from "./TraceDialog";

const n = (v: number) => Math.round(v).toLocaleString("en-IN");

interface Props {
  t: Translate;
  lang: Language;
  result: PlanResponse;
  headingRef: React.Ref<HTMLHeadingElement>;
}

/** The answer at a glance: where, how the air is, and what the plan changes. */
export function ResultBanner({ t, lang, result, headingRef }: Props) {
  const { ledger, hourly } = result;
  const mean = hourly.reduce((a, b) => a + b, 0) / hourly.length;
  const peak = Math.max(...hourly);
  const cut = ledger.reductionPct;
  const showCut = !ledger.nothingToDo && cut.high >= 1;

  return (
    <section className="banner">
      <div className="banner-top">
        <h2 className="results-title" tabIndex={-1} ref={headingRef}>
          {result.place}
        </h2>
        <TraceDialog t={t} trace={result.trace} />
      </div>

      <dl className="stats">
        <div>
          <dt>{t("statAir")}</dt>
          <dd>
            <BandBadge band={pm25ToAqi(mean).band} lang={lang} />
            <span className="sub">{t("statPeak", Math.round(peak))}</span>
          </dd>
        </div>
        <div>
          <dt>{t("baseline")}</dt>
          <dd>
            <span className="num">{n(ledger.baselineUg.central)}</span>
            <span className="sub">µg</span>
          </dd>
        </div>
        <div>
          <dt>{t("planned")}</dt>
          <dd>
            <span className="num">{n(ledger.plannedUg.central)}</span>
            <span className="sub">µg</span>
          </dd>
        </div>
        <div className="cut">
          <dt>{t("statCut")}</dt>
          <dd>
            {showCut ? (
              <>
                <span className="num big">
                  {Math.max(0, Math.round(cut.low))}&ndash;{Math.round(cut.high)}%
                </span>
                <span className="sub">{t("statCentral", Math.round(cut.central))}</span>
              </>
            ) : (
              <span className="sub">{t("headlineNone")}</span>
            )}
          </dd>
        </div>
      </dl>
    </section>
  );
}
