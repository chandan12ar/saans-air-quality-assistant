"use client";

import { useId, type ReactNode } from "react";
import type { Language } from "@/lib/labels";
import type { Profile } from "@/lib/schemas";
import { PRESETS, type FormState } from "./formState";
import type { StringKey, Translate } from "./i18n";
import { PlaceSearch } from "./PlaceSearch";

interface Props {
  t: Translate;
  form: FormState;
  setForm: (updater: (prev: FormState) => FormState) => void;
  onSubmit: () => void;
  busy: boolean;
}

function Field({ label, children, help }: { label: string; children: (id: string) => ReactNode; help?: string }) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children(id)}
      {help && <p className="hint">{help}</p>}
    </div>
  );
}

function SelectField<V extends string>({
  t,
  label,
  value,
  options,
  onChange,
}: {
  t: Translate;
  label: string;
  value: V;
  options: ReadonlyArray<{ value: V; key: StringKey }>;
  onChange: (value: V) => void;
}) {
  return (
    <Field label={label}>
      {(id) => (
        <select id={id} value={value} onChange={(e) => onChange(options.find((o) => o.value === e.target.value)?.value ?? value)}>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {t(o.key)}
            </option>
          ))}
        </select>
      )}
    </Field>
  );
}

function CheckField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  const id = useId();
  return (
    <div className="check">
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <label htmlFor={id}>{label}</label>
    </div>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (n: number) => void;
}) {
  return (
    <Field label={label}>
      {(id) => (
        <input
          id={id}
          type="number"
          inputMode="decimal"
          value={Number.isFinite(value) ? value : ""}
          min={min}
          max={max}
          step={step}
          onChange={(e) => onChange(e.target.value === "" ? Number.NaN : Number(e.target.value))}
        />
      )}
    </Field>
  );
}

export function HouseholdForm({ t, form, setForm, onSubmit, busy }: Props) {
  const notesId = useId();
  const peakId = useId();
  const setProfile = <K extends keyof Profile>(key: K, value: Profile[K]) =>
    setForm((f) => ({ ...f, profile: { ...f.profile, [key]: value } }));
  const p = form.profile;

  return (
    <form
      className="panel form"
      aria-labelledby="household-title"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <h2 id="household-title">{t("householdTitle")}</h2>

      <div className="examples">
        <span>{t("loadExample")}:</span>
        {PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            className="btn link"
            onClick={() => setForm((f) => ({ ...f, place: preset.place, profile: preset.profile }))}
          >
            {preset.id === "delhi" ? t("exDelhi") : t("exLucknow")}
          </button>
        ))}
      </div>

      <PlaceSearch t={t} place={form.place} onPick={(place) => setForm((f) => ({ ...f, place }))} />

      <div className="grid2">
        <Field label={t("language")}>
          {(id) => (
            <select id={id} value={form.language} onChange={(e) => setForm((f) => ({ ...f, language: e.target.value as Language }))}>
              <option value="en">English</option>
              <option value="hi">हिन्दी</option>
            </select>
          )}
        </Field>
        <Field label={t("day")}>
          {(id) => (
            <select
              id={id}
              value={form.dayOffset}
              onChange={(e) => setForm((f) => ({ ...f, dayOffset: Number(e.target.value) as FormState["dayOffset"] }))}
            >
              <option value={0}>{t("day0")}</option>
              <option value={1}>{t("day1")}</option>
              <option value={2}>{t("day2")}</option>
            </select>
          )}
        </Field>
      </div>

      <fieldset className="group">
        <legend>{t("who")}</legend>
        <SelectField
          t={t}
          label={t("ageBand")}
          value={p.ageBand}
          onChange={(v) => setProfile("ageBand", v)}
          options={[
            { value: "child", key: "age_child" },
            { value: "adult", key: "age_adult" },
            { value: "older", key: "age_older" },
          ]}
        />
        <CheckField label={t("respiratory")} checked={p.hasRespiratoryCondition} onChange={(v) => setProfile("hasRespiratoryCondition", v)} />
      </fieldset>

      <fieldset className="group">
        <legend>{t("homeTitle")}</legend>
        <SelectField
          t={t}
          label={t("windows")}
          value={p.windows}
          onChange={(v) => setProfile("windows", v)}
          options={[
            { value: "tight", key: "win_tight" },
            { value: "typical", key: "win_typical" },
            { value: "leaky", key: "win_leaky" },
          ]}
        />
        <CheckField label={t("windowsOpen")} checked={p.windowsOpenHabit} onChange={(v) => setProfile("windowsOpenHabit", v)} />
        <div className="grid2">
          <NumberField label={t("purifier")} value={p.purifierCadr} min={0} max={2000} onChange={(v) => setProfile("purifierCadr", v)} />
          <NumberField label={t("room")} value={p.roomVolumeM3} min={5} max={200} onChange={(v) => setProfile("roomVolumeM3", v)} />
        </div>
      </fieldset>

      <fieldset className="group">
        <legend>{t("routineTitle")}</legend>
        <div className="grid2">
          <SelectField
            t={t}
            label={t("commuteMode")}
            value={p.commuteMode}
            onChange={(v) => setProfile("commuteMode", v)}
            options={[
              { value: "walk", key: "mode_walk" },
              { value: "two_wheeler", key: "mode_two_wheeler" },
              { value: "bus", key: "mode_bus" },
              { value: "metro", key: "mode_metro" },
              { value: "car_closed", key: "mode_car_closed" },
            ]}
          />
          <NumberField label={t("commuteKm")} value={p.commuteKm} min={0} max={100} step={0.5} onChange={(v) => setProfile("commuteKm", v)} />
        </div>
        <CheckField label={t("away")} checked={p.awayDuringDay} onChange={(v) => setProfile("awayDuringDay", v)} />
        <div className="grid2">
          <SelectField
            t={t}
            label={t("outdoor")}
            value={p.outdoorActivity}
            onChange={(v) => setProfile("outdoorActivity", v)}
            options={[
              { value: "morning", key: "out_morning" },
              { value: "evening", key: "out_evening" },
              { value: "none", key: "out_none" },
            ]}
          />
          <SelectField
            t={t}
            label={t("budget")}
            value={p.budget}
            onChange={(v) => setProfile("budget", v)}
            options={[
              { value: "low", key: "bud_low" },
              { value: "medium", key: "bud_medium" },
              { value: "high", key: "bud_high" },
            ]}
          />
        </div>
      </fieldset>

      <div className="field">
        <label htmlFor={notesId}>{t("notes")}</label>
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
      </div>

      <fieldset className="group sim">
        <legend>{t("simulateTitle")}</legend>
        <CheckField label={t("simulate")} checked={form.simulate} onChange={(v) => setForm((f) => ({ ...f, simulate: v }))} />
        <p className="hint">{t("simulateHelp")}</p>
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
      </fieldset>

      <button type="submit" className="btn primary" disabled={busy} aria-busy={busy}>
        {busy ? t("building") : t("submit")}
      </button>
    </form>
  );
}
