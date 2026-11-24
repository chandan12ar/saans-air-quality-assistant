"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Language } from "@/lib/labels";
import type { PlanResponse } from "@/lib/planTypes";
import { ProfileSchema, type Profile } from "@/lib/schemas";
import { airStateFor, hazeForPm25, sky, STORY_SKY, type AirState } from "./airTheme";
import { ChipGroup } from "./Choice";
import { HouseholdForm } from "./HouseholdForm";
import { INITIAL_FORM, toRequest, type FormState } from "./formState";
import { makeTranslator } from "./i18n";
import { Icon } from "./Icon";
import { LedgerPanel } from "./LedgerPanel";
import { CommunityCard, IndoorCard, PlanCard, SwapsCard } from "./PlanView";
import { AqiCard, DaysCard, dayLabel, HourlyCard, NowHeader, ShareCard } from "./ResultCards";
import { Sky } from "./Sky";
import { Story } from "./Story";

interface Snapshot {
  id: number;
  result: PlanResponse;
  /** The inputs that produced the result, kept so what-if toggles use the same household. */
  profile: Profile;
  lang: Language;
  dayOffset: number;
}

interface ApiError {
  error?: { message?: string; issues?: Array<{ path: string; message: string }> };
}

export function Planner() {
  const [form, setFormState] = useState<FormState>(INITIAL_FORM);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; issues: string[] } | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const resultsRef = useRef<HTMLHeadingElement>(null);
  const counter = useRef(0);

  const t = useMemo(() => makeTranslator(form.language), [form.language]);
  const setForm = useCallback((updater: (prev: FormState) => FormState) => setFormState(updater), []);

  const air = useMemo(() => (snapshot ? airStateFor(snapshot.result.hourly) : null), [snapshot]);
  const theme: AirState = air?.air ?? "idle";
  // The sky behind the results shows the household's real (or simulated) air.
  const resultSky = air ? sky(0.42, hazeForPm25(air.mean), 0.3) : undefined;
  // While the simulator is on, dragging its slider re-paints the sky behind the form.
  const formSky = form.simulate ? sky(0.4, hazeForPm25(form.simulatePeak * 0.7), 0.28) : STORY_SKY.home;

  useEffect(() => {
    document.documentElement.lang = form.language;
  }, [form.language]);

  useEffect(() => {
    if (snapshot) resultsRef.current?.focus({ preventScroll: true });
    if (snapshot) resultsRef.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  }, [snapshot]);

  async function run(overrides: Partial<FormState> = {}) {
    const f = { ...form, ...overrides };
    if (!f.place) {
      setError({ message: t("placeRequired"), issues: [] });
      return;
    }
    const parsed = ProfileSchema.safeParse(f.profile);
    if (!parsed.success) {
      setError({ message: t("invalidField"), issues: parsed.error.issues.slice(0, 5).map((i) => i.path.join(".")) });
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true);
    setError(null);
    if (overrides.dayOffset !== undefined) setFormState((prev) => ({ ...prev, dayOffset: overrides.dayOffset ?? prev.dayOffset }));

    try {
      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toRequest(f, f.place)),
        signal: controller.signal,
      });
      const json = (await res.json()) as PlanResponse & ApiError;
      if (!res.ok) {
        const message = res.status === 429 ? t("tooManyRequests") : (json.error?.message ?? t("planFailed"));
        setError({ message, issues: (json.error?.issues ?? []).map((i) => `${i.path}: ${i.message}`) });
        return;
      }
      counter.current += 1;
      setSnapshot({ id: counter.current, result: json, profile: parsed.data, lang: f.language, dayOffset: f.dayOffset });
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError({ message: t("networkError"), issues: [] });
    } finally {
      if (abortRef.current === controller) setBusy(false);
    }
  }

  const announcement = busy ? t("building") : snapshot && !error ? t("planReady", snapshot.result.place) : "";

  return (
    <div className="app" data-air={theme}>
      <Sky />
      <a className="skip" href="#plan">
        {t("skip")}
      </a>

      <header className="topbar">
        <p className="brand">
          <span className="breath" aria-hidden="true" />
          Saans <span lang="hi">साँस</span>
        </p>
        <ChipGroup
          legend={t("language")}
          hideLegend
          value={form.language}
          onChange={(v) => setForm((f) => ({ ...f, language: v }))}
          options={[
            { value: "en", label: "English" },
            { value: "hi", label: "हिन्दी" },
          ]}
        />
      </header>

      <main id="main">
        <section className="hero" data-sky={STORY_SKY.hero} aria-labelledby="hero-title">
          <h1 id="hero-title">{t("tagline")}</h1>
          <p className="lede">{t("intro")}</p>
          <a className="btn primary cta" href="#household">
            {t("heroCta")}
          </a>
          <p className="scroll-hint">
            <Icon name="arrowDown" size={16} /> {t("scrollHint")}
          </p>
        </section>

        <Story t={t} />

        <section id="household" className="household" data-sky={formSky}>
          <HouseholdForm t={t} form={form} setForm={setForm} busy={busy} onSubmit={() => void run()} />
        </section>

        <div id="plan" className="plan-area" data-sky={resultSky}>
          <div className="sr-only" role="status" aria-live="polite">
            {announcement}
          </div>

          {error && (
            <div className="alert" role="alert">
              <strong>{error.message}</strong>
              {error.issues.length > 0 && (
                <ul>
                  {error.issues.map((m, i) => (
                    <li key={i}>{m}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {busy && !snapshot && (
            <div className="skeleton" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
          )}

          {snapshot && (
            <div className={busy ? "results stale" : "results"} aria-busy={busy}>
              <div className="print-only report-head">
                <p>
                  {t("reportTitle")}: {snapshot.result.place}, {dayLabel(snapshot.result.date, form.language)}
                </p>
              </div>
              <NowHeader t={t} lang={form.language} result={snapshot.result} headingRef={resultsRef} />
              <div className="grid">
                <HourlyCard t={t} lang={form.language} result={snapshot.result} />
                <AqiCard t={t} lang={form.language} result={snapshot.result} />
                <DaysCard
                  t={t}
                  lang={form.language}
                  result={snapshot.result}
                  busy={busy}
                  selected={snapshot.dayOffset}
                  onPick={(offset) => void run({ dayOffset: offset })}
                />
              </div>
              <div className="cols">
                <div className="col">
                  <PlanCard t={t} planLang={snapshot.lang} result={snapshot.result} />
                  <LedgerPanel key={snapshot.id} t={t} result={snapshot.result} profile={snapshot.profile} />
                </div>
                <div className="col">
                  <IndoorCard t={t} planLang={snapshot.lang} result={snapshot.result} />
                  <SwapsCard t={t} planLang={snapshot.lang} result={snapshot.result} />
                  <CommunityCard t={t} planLang={snapshot.lang} result={snapshot.result} />
                  <ShareCard t={t} lang={form.language} result={snapshot.result} />
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      <footer className="foot">
        <p>{t("privacy")}</p>
        <p>{t("disclaimer")}</p>
        <p>{t("attribution")}</p>
      </footer>
    </div>
  );
}
