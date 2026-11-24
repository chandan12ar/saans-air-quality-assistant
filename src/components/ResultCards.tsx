"use client";

import { pm25ToAqi, WHO_2021_PM25, type NaqiBand } from "@/engine";
import { BAND_ICON, BAND_LABEL, type Language } from "@/lib/labels";
import type { PlanResponse } from "@/lib/planTypes";
import { airStateFor, BAND_COLOR } from "./airTheme";
import { Band } from "./Band";
import type { Translate } from "./i18n";
import { Icon } from "./Icon";
import { TraceDialog } from "./TraceDialog";

const hh = (h: number) => `${String(h).padStart(2, "0")}:00`;
const SCALE_MAX = 500;
const locale = (lang: Language) => (lang === "hi" ? "hi-IN" : "en-IN");

export function dayLabel(date: string, lang: Language): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString(locale(lang), { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
}

/** CPCB band colours as a continuous scale (0 to 500 sub-index), as on India's AQI bulletins. */
const SCALE_GRADIENT = `linear-gradient(90deg, ${BAND_COLOR.good} 0%, ${BAND_COLOR.satisfactory} 15%, ${BAND_COLOR.moderate} 30%, ${BAND_COLOR.poor} 50%, ${BAND_COLOR.very_poor} 70%, ${BAND_COLOR.severe} 90%)`;

interface Common {
  t: Translate;
  lang: Language;
  result: PlanResponse;
}

/** The answer at a glance, Apple Weather style: place, a big number, the band, the peak. */
export function NowHeader({ t, lang, result, headingRef }: Common & { headingRef: React.Ref<HTMLHeadingElement> }) {
  const { mean, peak, peakHour } = airStateFor(result.hourly);
  const reading = pm25ToAqi(mean);
  return (
    <header className="now">
      <p className="now-date">
        <Icon name="pin" size={16} /> {dayLabel(result.date, lang)}
      </p>
      <h2 className="results-title" tabIndex={-1} ref={headingRef}>
        {result.place}
      </h2>
      <p className="now-num" aria-label={`AQI ${reading.subIndex}`}>
        {reading.subIndex}
      </p>
      <p className="now-band">
        <Band band={reading.band} lang={lang} />
      </p>
      <p className="now-sub">{t("peakAt", Math.round(peak), hh(peakHour))}</p>
    </header>
  );
}

export function HourlyCard({ t, lang, result }: Common) {
  const { hourly, meta } = result;
  const { peak, peakHour } = airStateFor(hourly);
  let best = 6;
  for (let h = 6; h <= 19; h++) if ((hourly[h] ?? 0) < (hourly[best] ?? 0)) best = h;
  const yMax = Math.max(60, peak);
  const label = t("chartLabel", dayLabel(result.date, lang), Math.round(peak), hh(peakHour), BAND_LABEL[lang][pm25ToAqi(peak).band], hh(best));

  return (
    <section className="card span-2" aria-labelledby="hourly-title">
      <h3 className="card-title" id="hourly-title">
        <Icon name="clock" /> {t("hourlyTitle")}
      </h3>
      <p className={meta.simulated ? "source sim" : "source"}>
        {meta.simulated ? t("srcSim") : t("srcLive", new Date(meta.fetchedAt).toLocaleTimeString(locale(lang), { hour: "2-digit", minute: "2-digit" }))}
      </p>
      <div className="hourly" role="region" aria-label={label} tabIndex={0}>
        <ol>
          {hourly.map((v, h) => {
            const band = pm25ToAqi(v).band;
            return (
              <li key={h} className={h === peakHour ? "is-peak" : undefined}>
                <span className="h-time">{hh(h)}</span>
                <span className="h-bar" aria-hidden="true">
                  <span style={{ height: `${Math.max(6, (v / yMax) * 100)}%`, background: BAND_COLOR[band] }} />
                </span>
                <span className="h-glyph" style={{ color: BAND_COLOR[band] }} aria-hidden="true">
                  {BAND_ICON[band]}
                </span>
                <span className="h-val">{Math.round(v)}</span>
              </li>
            );
          })}
        </ol>
      </div>
      <details>
        <summary>{t("hourlyTable")}</summary>
        <table>
          <thead>
            <tr>
              <th scope="col">{t("hour")}</th>
              <th scope="col">{t("pm25")}</th>
              <th scope="col">{t("band")}</th>
            </tr>
          </thead>
          <tbody>
            {hourly.map((v, h) => (
              <tr key={h}>
                <th scope="row">{hh(h)}</th>
                <td>{Math.round(v)}</td>
                <td>
                  <Band band={pm25ToAqi(v).band} lang={lang} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="hint">{t("bandNote")}</p>
      </details>
    </section>
  );
}

export function AqiCard({ t, lang, result }: Common) {
  const { mean } = airStateFor(result.hourly);
  const reading = pm25ToAqi(mean);
  const ratio = Math.round((mean / WHO_2021_PM25.value.h24) * 10) / 10;
  return (
    <section className="card" aria-labelledby="aqi-title">
      <h3 className="card-title" id="aqi-title">
        <Icon name="gauge" /> {t("aqiTitle")}
      </h3>
      <p className="aqi-num">{reading.subIndex}</p>
      <p className="aqi-band">
        <Band band={reading.band} lang={lang} />
      </p>
      <div className="aqi-scale" style={{ background: SCALE_GRADIENT }} aria-hidden="true">
        <span style={{ left: `${Math.min(100, (reading.subIndex / SCALE_MAX) * 100)}%` }} />
      </div>
      <p>{ratio > 1 ? t("aqiLine", Math.round(mean), ratio) : t("aqiLineClean", Math.round(mean))}</p>
      <p className="hint">{t("aqiEstimate")}</p>
    </section>
  );
}

export function DaysCard({ t, lang, result, selected, busy, onPick }: Common & { selected: number; busy: boolean; onPick: (i: 0 | 1 | 2) => void }) {
  return (
    <section className="card" aria-labelledby="days-title">
      <h3 className="card-title" id="days-title">
        <Icon name="calendar" /> {t("daysTitle")}
      </h3>
      <ul className="days">
        {result.days.map((d, i) => {
          const span = Math.max(1, d.maxPm25 - d.minPm25);
          const pos = span >= SCALE_MAX ? 0 : (Math.min(d.minPm25, SCALE_MAX) / (SCALE_MAX - span)) * 100;
          return (
            <li key={d.date}>
              <button type="button" className="day-row" aria-pressed={i === selected} disabled={busy} onClick={() => onPick(i as 0 | 1 | 2)}>
                <span className="day-name">{i === 0 && !result.meta.simulated ? t("day0") : dayLabel(d.date, lang)}</span>
                <span className="day-band">
                  <Band band={d.band as NaqiBand} lang={lang} />
                </span>
                <span className="day-min">{d.minPm25}</span>
                <span className="range-track" aria-hidden="true">
                  <span
                    style={{
                      left: `${Math.min(100, (d.minPm25 / SCALE_MAX) * 100)}%`,
                      width: `${Math.max(3, Math.min(100, (span / SCALE_MAX) * 100))}%`,
                      backgroundImage: SCALE_GRADIENT,
                      backgroundSize: `${(SCALE_MAX / span) * 100}% 100%`,
                      backgroundPosition: `${pos}% 0`,
                    }}
                  />
                </span>
                <span className="day-max">{d.maxPm25}</span>
                <span className="sr-only">{t("dayMean", d.meanPm25, d.maxPm25)}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Plain-text plan for WhatsApp. Figures come from the ledger, never from the model. */
export function shareText(t: Translate, lang: Language, result: PlanResponse): string {
  const { mean, peak, peakHour } = airStateFor(result.hourly);
  const cut = result.ledger.reductionPct;
  const steps = [
    ...result.plan.timeline.slice(0, 4).map((i) => `${hh(i.hour)} ${i.title}`),
    ...result.plan.indoorHacks.slice(0, 2).map((h) => h.title),
    ...result.plan.sustainableSwaps.slice(0, 1).map((s) => s.title),
  ];
  return [
    t("shareIntro", result.place, dayLabel(result.date, lang)),
    t("shareAir", BAND_LABEL[lang][pm25ToAqi(mean).band], Math.round(peak), hh(peakHour)),
    result.ledger.nothingToDo ? "" : t("shareCut", Math.max(0, Math.round(cut.low)), Math.round(cut.high)),
    "",
    t("shareSteps"),
    ...steps.map((s) => `- ${s}`),
    "",
    t("shareFooter"),
  ]
    .filter((line, i, all) => !(line === "" && all[i - 1] === ""))
    .join("\n");
}

export function ShareCard({ t, lang, result }: Common) {
  const href = `https://wa.me/?text=${encodeURIComponent(shareText(t, lang, result))}`;
  return (
    <section className="card share-card no-print" aria-labelledby="share-title">
      <h3 className="card-title" id="share-title">
        <Icon name="share" /> {t("shareTitle")}
      </h3>
      <p>{t("shareBody")}</p>
      <div className="share-actions">
        <a className="btn primary" href={href} target="_blank" rel="noopener noreferrer">
          <Icon name="chat" /> {t("shareWhatsApp")}
        </a>
        <button type="button" className="btn ghost" onClick={() => window.print()}>
          <Icon name="file" /> {t("saveReport")}
        </button>
        <TraceDialog t={t} trace={result.trace} />
      </div>
    </section>
  );
}
