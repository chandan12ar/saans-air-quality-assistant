"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Language } from "@/lib/labels";
import type { PlanResponse } from "@/lib/planTypes";
import { ProfileSchema, type Profile } from "@/lib/schemas";
import { ForecastView } from "./ForecastView";
import { HouseholdForm } from "./HouseholdForm";
import { INITIAL_FORM, toRequest, type FormState } from "./formState";
import { makeTranslator } from "./i18n";
import { LedgerPanel } from "./LedgerPanel";
import { PlanView } from "./PlanView";
import { TraceDialog } from "./TraceDialog";

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

  useEffect(() => {
    document.documentElement.lang = form.language;
  }, [form.language]);

  useEffect(() => {
    if (snapshot) resultsRef.current?.focus();
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
    <>
      <a className="skip" href="#plan">
        {t("skip")}
      </a>
      <header className="masthead">
        <div className="wrap">
          <p className="brand">
            <span className="breath" aria-hidden="true" />
            Saans <span className="brand-hi" lang="hi">साँस</span>
          </p>
          <h1>{t("tagline")}</h1>
          <p className="lede">{t("intro")}</p>
        </div>
      </header>

      <main className="wrap layout" id="main">
        <div className="col-form">
          <HouseholdForm t={t} form={form} setForm={setForm} busy={busy} onSubmit={() => void run()} />
        </div>

        <div className="col-results" id="plan">
          <div className="sr-only" role="status" aria-live="polite">
            {announcement}
          </div>

          {error && (
            <div className="panel alert" role="alert">
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
            <div className="panel" aria-hidden="true">
              <div className="skeleton" />
            </div>
          )}

          {snapshot && (
            <div className={busy ? "results stale" : "results"} aria-busy={busy}>
              <h2 className="results-title" tabIndex={-1} ref={resultsRef}>
                {snapshot.result.place}
              </h2>
              <div className="actions">
                <TraceDialog t={t} trace={snapshot.result.trace} />
              </div>
              <ForecastView
                t={t}
                lang={form.language}
                result={snapshot.result}
                busy={busy}
                selectedDay={snapshot.dayOffset}
                onPickDay={(offset) => void run({ dayOffset: offset })}
              />
              <PlanView t={t} planLang={snapshot.lang} result={snapshot.result} />
              <LedgerPanel key={snapshot.id} t={t} result={snapshot.result} profile={snapshot.profile} />
            </div>
          )}
        </div>
      </main>

      <footer className="wrap foot">
        <p>{t("privacy")}</p>
        <p>{t("disclaimer")}</p>
        <p>{t("attribution")}</p>
      </footer>
    </>
  );
}
