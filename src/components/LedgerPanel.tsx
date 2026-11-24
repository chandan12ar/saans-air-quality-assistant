"use client";

import { useMemo, useState } from "react";
import {
  BREATHING_M3_PER_H,
  COMMUTE_EXPOSURE_FACTOR,
  COMMUTE_G_CO2E_PER_KM,
  CPCB_PM25_BANDS,
  DEPOSITION_PER_H,
  DIY_FILTER_CADR_M3_PER_H,
  HOME_ACH,
  MASK_EFFECTIVENESS,
  OTHER_INDOOR_ACH,
  PENETRATION,
  PURIFIER_DERATE,
  WHO_2021_PM25,
  buildLedger,
  type ActionId,
  type Const,
  type Range,
} from "@/engine";
import { contextFor } from "@/lib/context";
import type { PlanResponse } from "@/lib/planTypes";
import type { Profile } from "@/lib/schemas";
import type { StringKey, Translate } from "./i18n";
import { Icon } from "./Icon";

const n = (v: number) => Math.round(v).toLocaleString("en-IN");

const ACTION_LABEL: Record<ActionId, string> = {
  shift_outdoor: "Shift outdoor time to cleaner hours",
  close_windows: "Keep windows closed in bad hours",
  run_purifier: "Run your air purifier at home",
  diy_filter: "DIY box-fan filter at home",
  mask_unavoidable: "Fitted N95 for unavoidable outdoor hours",
  swap_commute: "Metro or bus instead of a private vehicle",
};

const ASSUMPTIONS: Array<{ name: string; item: Const<unknown>; show?: (v: unknown) => string }> = [
  { name: "Breathing rate by activity (m³/h)", item: BREATHING_M3_PER_H },
  { name: "Home air changes per hour", item: HOME_ACH },
  { name: "Outdoor PM2.5 passing indoors", item: PENETRATION },
  { name: "Indoor deposition per hour", item: DEPOSITION_PER_H },
  { name: "Office or school air changes per hour", item: OTHER_INDOOR_ACH },
  { name: "Mask effectiveness", item: MASK_EFFECTIVENESS },
  { name: "Purifier real-world derating", item: PURIFIER_DERATE },
  { name: "DIY box-fan filter CADR (m³/h)", item: DIY_FILTER_CADR_M3_PER_H },
  { name: "Commute exposure factor by mode", item: COMMUTE_EXPOSURE_FACTOR },
  { name: "Commute emissions (g CO₂e per km)", item: COMMUTE_G_CO2E_PER_KM },
  {
    name: "CPCB PM2.5 band limits (µg/m³)",
    item: CPCB_PM25_BANDS,
    show: (v) => (v as Array<{ band: string; cMax: number }>).map((b) => `${b.band} ≤ ${b.cMax}`).join(", "),
  },
  { name: "WHO 2021 PM2.5 guideline (µg/m³)", item: WHO_2021_PM25 },
];

function RangeBar({ label, range, max }: { label: string; range: Range; max: number }) {
  const pct = (v: number) => `${Math.min(100, (v / max) * 100)}%`;
  return (
    <div className="rangebar">
      <div className="rb-head">
        <span>{label}</span>
        <strong>
          {n(range.central)} µg <span className="muted">({n(range.low)} to {n(range.high)})</span>
        </strong>
      </div>
      <div className="track" aria-hidden="true">
        <div className="range" style={{ left: pct(range.low), width: `${Math.max(0.5, ((range.high - range.low) / max) * 100)}%` }} />
        <div className="fill" style={{ width: pct(range.central) }} />
      </div>
    </div>
  );
}

interface Props {
  t: Translate;
  result: PlanResponse;
  /** The profile that produced `result` (not whatever is currently typed in the form). */
  profile: Profile;
}

export function LedgerPanel({ t, result, profile }: Props) {
  const recommended = useMemo(() => result.ledger.actions.filter((a) => a.applied), [result]);
  const tradeoffs = result.ledger.actions.filter((a) => !a.applied);
  const [enabled, setEnabled] = useState<ReadonlySet<ActionId>>(() => new Set(recommended.map((a) => a.id)));
  const ctx = useMemo(() => contextFor(profile, result.hourly), [profile, result.hourly]);
  // Instant what-if: the same engine the server used, run in the browser. No AI call involved.
  const live = useMemo(() => buildLedger(ctx, enabled), [ctx, enabled]);

  const max = Math.max(live.baselineUg.high, 1);
  const baselineCentral = Math.max(live.baselineUg.central, 1);
  const r = live.reductionPct;
  const toggle = (id: ActionId) =>
    setEnabled((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <section className="card ledger-card" aria-labelledby="ledger-title">
      <h3 className="card-title" id="ledger-title">
        <Icon name="scale" /> {t("ledgerTitle")}
      </h3>
      <p>{t("ledgerIntro")}</p>

      <RangeBar label={t("baseline")} range={live.baselineUg} max={max} />
      <RangeBar label={t("planned")} range={live.plannedUg} max={max} />

      <p className="headline" role="status">
        {live.nothingToDo || r.high < 1 ? t("headlineNone") : t("headline", Math.max(0, Math.round(r.low)), Math.round(r.high), Math.round(r.central))}
      </p>

      <h4>{t("whatIf")}</h4>
      <p className="hint">{t("whatIfHelp")}</p>
      <ul className="whatif">
        {recommended.map((a) => (
          <li key={a.id}>
            <div className="check">
              <input id={`wi-${a.id}`} type="checkbox" checked={enabled.has(a.id)} onChange={() => toggle(a.id)} />
              <label htmlFor={`wi-${a.id}`}>{ACTION_LABEL[a.id]}</label>
            </div>
            <div className="mini" aria-hidden="true">
              <div style={{ width: `${Math.max(0, Math.min(100, (a.avoidedUg.central / baselineCentral) * 100))}%` }} />
            </div>
            <span className="muted">
              {t("impactLess", n(a.avoidedUg.central), n(a.avoidedUg.low), n(a.avoidedUg.high))}
              {a.co2eAvoidedG ? `; ${t("impactCo2", n(a.co2eAvoidedG))}` : ""}
            </span>
          </li>
        ))}
      </ul>
      {tradeoffs.map((a) => (
        <p key={a.id} className="chip warn block">
          {ACTION_LABEL[a.id]}: {t("tradeoff", n(Math.abs(a.avoidedUg.central)))}
        </p>
      ))}
      <p className="hint">{t("overlapNote")}</p>

      <details>
        <summary>{t("how")}</summary>
        <p>{t("howBody")}</p>
        <table>
          <tbody>
            {ASSUMPTIONS.map(({ name, item, show }) => (
              <tr key={name}>
                <th scope="row">{name}</th>
                <td>{show ? show(item.value) : JSON.stringify(item.value)}</td>
                <td>
                  <span className={`tag ${item.provenance.kind}`}>
                    {t((item.provenance.kind === "assumption" ? "assumption" : "sourced") satisfies StringKey)}
                  </span>{" "}
                  <span className="muted">{item.provenance.kind === "assumption" ? item.provenance.note : item.provenance.source}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </section>
  );
}
