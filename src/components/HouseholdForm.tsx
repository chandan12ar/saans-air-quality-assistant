"use client";

import { useId } from "react";
import type { Profile } from "@/lib/schemas";
import { ChipGroup, Toggle } from "./Choice";
import { PRESETS, type FormState } from "./formState";
import type { Translate } from "./i18n";
import { PlaceSearch } from "./PlaceSearch";

interface Props {
  t: Translate;
  form: FormState;
  setForm: (updater: (prev: FormState) => FormState) => void;
  onSubmit: () => void;
  busy: boolean;
}

type PurifierSize = "none" | "small" | "large";
type Distance = "short" | "mid" | "long";

/** Plain-language choices mapped to the engine's numbers. The mappings are assumptions, stated in the README. */
const PURIFIER_CADR: Record<PurifierSize, number> = { none: 0, small: 150, large: 350 };
const DISTANCE_KM: Record<Distance, number> = { short: 3, mid: 10, long: 20 };

const purifierOf = (cadr: number): PurifierSize => (cadr <= 0 ? "none" : cadr <= 200 ? "small" : "large");
const distanceOf = (km: number): Distance => (km < 5 ? "short" : km <= 15 ? "mid" : "long");

export function HouseholdForm({ t, form, setForm, onSubmit, busy }: Props) {
  const notesId = useId();
  const peakId = useId();
  const setProfile = <K extends keyof Profile>(key: K, value: Profile[K]) =>
    setForm((f) => ({ ...f, profile: { ...f.profile, [key]: value } }));
  const p = form.profile;

  return (
    <form
      className="card form-card"
      aria-labelledby="household-title"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <div className="form-head">
        <h2 id="household-title">{t("householdTitle")}</h2>
        <div className="examples">
          <span>{t("loadExample")}</span>
          {PRESETS.map((preset) => (
            <button key={preset.id} type="button" className="pill" onClick={() => setForm((f) => ({ ...f, place: preset.place, profile: preset.profile }))}>
              {preset.id === "delhi" ? t("exDelhi") : t("exLucknow")}
            </button>
          ))}
        </div>
      </div>

      <div className="form-grid">
        <div className="form-sec">
          <h3>{t("placeTitle")}</h3>
          <PlaceSearch t={t} place={form.place} onPick={(place) => setForm((f) => ({ ...f, place }))} />
          <ChipGroup
            legend={t("day")}
            value={String(form.dayOffset) as "0" | "1" | "2"}
            onChange={(v) => setForm((f) => ({ ...f, dayOffset: Number(v) as FormState["dayOffset"] }))}
            options={[
              { value: "0", label: t("day0") },
              { value: "1", label: t("day1") },
              { value: "2", label: t("day2") },
            ]}
          />
        </div>

        <div className="form-sec">
          <h3>{t("familyTitle")}</h3>
          <ChipGroup
            legend={t("who")}
            value={p.ageBand}
            onChange={(v) => setProfile("ageBand", v)}
            options={[
              { value: "child", label: t("age_child") },
              { value: "adult", label: t("age_adult") },
              { value: "older", label: t("age_older") },
            ]}
          />
          <Toggle label={t("respiratory")} checked={p.hasRespiratoryCondition} onChange={(v) => setProfile("hasRespiratoryCondition", v)} />
        </div>

        <div className="form-sec">
          <h3>{t("homeTitle")}</h3>
          <ChipGroup
            legend={t("windows")}
            value={p.windows}
            onChange={(v) => setProfile("windows", v)}
            options={[
              { value: "tight", label: t("win_tight") },
              { value: "typical", label: t("win_typical") },
              { value: "leaky", label: t("win_leaky") },
            ]}
          />
          <Toggle label={t("windowsOpen")} checked={p.windowsOpenHabit} onChange={(v) => setProfile("windowsOpenHabit", v)} />
          <ChipGroup
            legend={t("purifier")}
            value={purifierOf(p.purifierCadr)}
            onChange={(v) => setProfile("purifierCadr", PURIFIER_CADR[v])}
            hint={t("purHint")}
            options={[
              { value: "none", label: t("pur_none") },
              { value: "small", label: t("pur_small") },
              { value: "large", label: t("pur_large") },
            ]}
          />
        </div>

        <div className="form-sec">
          <h3>{t("routineTitle")}</h3>
          <ChipGroup
            legend={t("commuteMode")}
            value={p.commuteMode}
            onChange={(v) => setProfile("commuteMode", v)}
            options={[
              { value: "walk", label: t("mode_walk") },
              { value: "two_wheeler", label: t("mode_two_wheeler") },
              { value: "bus", label: t("mode_bus") },
              { value: "metro", label: t("mode_metro") },
              { value: "car_closed", label: t("mode_car_closed") },
            ]}
          />
          <ChipGroup
            legend={t("distance")}
            value={distanceOf(p.commuteKm)}
            onChange={(v) => setProfile("commuteKm", DISTANCE_KM[v])}
            options={[
              { value: "short", label: t("dist_short") },
              { value: "mid", label: t("dist_mid") },
              { value: "long", label: t("dist_long") },
            ]}
          />
          <Toggle label={t("away")} checked={p.awayDuringDay} onChange={(v) => setProfile("awayDuringDay", v)} />
          <ChipGroup
            legend={t("outdoor")}
            value={p.outdoorActivity}
            onChange={(v) => setProfile("outdoorActivity", v)}
            options={[
              { value: "morning", label: t("out_morning") },
              { value: "evening", label: t("out_evening") },
              { value: "none", label: t("out_none") },
            ]}
          />
          <ChipGroup
            legend={t("budget")}
            value={p.budget}
            onChange={(v) => setProfile("budget", v)}
            options={[
              { value: "low", label: t("bud_low") },
              { value: "medium", label: t("bud_medium") },
              { value: "high", label: t("bud_high") },
            ]}
          />
        </div>
      </div>

      <details className="more" open={form.notes.length > 0 || undefined}>
        <summary>{t("notes")}</summary>
        <label htmlFor={notesId} className="sr-only">
          {t("notes")}
        </label>
        <textarea
          id={notesId}
          rows={3}
          maxLength={300}
          value={form.notes}
          aria-describedby={`${notesId}-help`}
          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
        />
        <p id={`${notesId}-help`} className="hint">
          {t("notesHelp")} ({form.notes.length}/300)
        </p>
      </details>

      <div className="sim">
        <h3>{t("simulateTitle")}</h3>
        <p className="hint">{t("simulateHelp")}</p>
        <Toggle label={t("simulate")} checked={form.simulate} onChange={(v) => setForm((f) => ({ ...f, simulate: v }))} />
        {form.simulate && (
          <div className="field">
            <label htmlFor={peakId}>
              {t("peak")}: <output htmlFor={peakId}>{form.simulatePeak}</output>
            </label>
            <input
              id={peakId}
              type="range"
              min={0}
              max={600}
              step={10}
              value={form.simulatePeak}
              aria-valuetext={`${form.simulatePeak} µg/m³`}
              onChange={(e) => setForm((f) => ({ ...f, simulatePeak: Number(e.target.value) }))}
            />
          </div>
        )}
      </div>

      <div className="submit-row">
        <button type="submit" className="btn primary" disabled={busy} aria-busy={busy}>
          {busy ? t("building") : t("submit")}
        </button>
      </div>
    </form>
  );
}
