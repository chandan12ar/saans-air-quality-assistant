import { pm25ToAqi, type NaqiBand } from "@/engine";
import { BAND_ICON, BAND_LABEL, type Language } from "@/lib/labels";
import type { PlanResponse } from "@/lib/planTypes";
import type { Translate } from "./i18n";

const BANDS: NaqiBand[] = ["good", "satisfactory", "moderate", "poor", "very_poor", "severe"];
const hh = (h: number) => `${String(h).padStart(2, "0")}:00`;

function dayLabel(date: string, lang: Language): string {
  const d = new Date(`${date}T12:00:00Z`);
  return d.toLocaleDateString(lang === "hi" ? "hi-IN" : "en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
}

export function BandBadge({ band, lang }: { band: NaqiBand; lang: Language }) {
  return (
    <span className={`badge band-${band}`}>
      <span aria-hidden="true">{BAND_ICON[band]}</span> {BAND_LABEL[lang][band]}
    </span>
  );
}

interface Props {
  t: Translate;
  lang: Language;
  result: PlanResponse;
  busy: boolean;
  onPickDay: (offset: 0 | 1 | 2) => void;
  selectedDay: number;
}

export function ForecastView({ t, lang, result, busy, onPickDay, selectedDay }: Props) {
  const { hourly, days, meta } = result;
  const peak = Math.max(...hourly);
  const peakHour = hourly.indexOf(peak);
  let bestHour = 6;
  for (let h = 6; h <= 19; h++) if ((hourly[h] ?? 0) < (hourly[bestHour] ?? 0)) bestHour = h;
  const yMax = Math.max(60, peak);
  const chartLabel = t("chartLabel", dayLabel(result.date, lang), Math.round(peak), hh(peakHour), BAND_LABEL[lang][pm25ToAqi(peak).band], hh(bestHour));

  return (
    <section className="panel" aria-labelledby="forecast-title">
      <h2 id="forecast-title">{t("forecastTitle")}</h2>
      <p className={meta.simulated ? "source sim" : "source"}>
        {meta.simulated ? t("srcSim") : t("srcLive", new Date(meta.fetchedAt).toLocaleTimeString(lang === "hi" ? "hi-IN" : "en-IN", { hour: "2-digit", minute: "2-digit" }))}
      </p>

      {days.length > 1 && (
        <div className="days" role="group" aria-label={t("day")}>
          {days.map((d, i) => (
            <button
              key={d.date}
              type="button"
              className="day"
              aria-pressed={i === selectedDay}
              disabled={busy}
              onClick={() => onPickDay(i as 0 | 1 | 2)}
            >
              <strong>{dayLabel(d.date, lang)}</strong>
              <BandBadge band={d.band} lang={lang} />
              <span className="muted">{t("dayMean", d.meanPm25, d.maxPm25)}</span>
            </button>
          ))}
        </div>
      )}

      <h3>{t("forecastFor", dayLabel(result.date, lang))}</h3>
      <div className="chart" role="img" aria-label={chartLabel}>
        <div className="bars" aria-hidden="true">
          {hourly.map((v, h) => (
            <div key={h} className="barcol" title={`${hh(h)}: ${Math.round(v)} µg/m³`}>
              <div className={`bar band-${pm25ToAqi(v).band}`} style={{ height: `${Math.max(3, (v / yMax) * 100)}%` }} />
            </div>
          ))}
        </div>
        <div className="xaxis" aria-hidden="true">
          {[0, 3, 6, 9, 12, 15, 18, 21].map((h) => (
            <span key={h}>{hh(h)}</span>
          ))}
        </div>
      </div>

      <ul className="legend" aria-label={t("band")}>
        {BANDS.map((b) => (
          <li key={b}>
            <BandBadge band={b} lang={lang} />
          </li>
        ))}
      </ul>
      <p className="hint">{t("bandNote")}</p>

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
                  <BandBadge band={pm25ToAqi(v).band} lang={lang} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </section>
  );
}
