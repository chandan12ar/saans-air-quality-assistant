"use client";

import { useRef } from "react";
import type { PlanResponse } from "@/lib/planTypes";
import type { Translate } from "./i18n";

/** Shows exactly what went into Gemini and what came back, so the AI's role is inspectable. */
export function TraceDialog({ t, trace }: { t: Translate; trace: PlanResponse["trace"] }) {
  const ref = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button type="button" className="btn secondary" onClick={() => ref.current?.showModal()}>
        {t("traceButton")}
      </button>
      <dialog ref={ref} className="trace" aria-labelledby="trace-title">
        <div className="trace-head">
          <h2 id="trace-title">{t("traceTitle")}</h2>
          <button type="button" className="btn secondary" onClick={() => ref.current?.close()}>
            {t("traceClose")}
          </button>
        </div>

        <h3>{t("traceSystem")}</h3>
        <pre tabIndex={0}>{trace.systemInstruction}</pre>

        <h3>{t("traceInput")}</h3>
        <pre tabIndex={0}>{JSON.stringify(trace.input, null, 2)}</pre>

        {trace.attempts.length === 0 && <p>{t("traceNone")}</p>}
        {trace.attempts.map((a, i) => (
          <div key={i} className="attempt">
            <h3>
              {t("traceAttempt", i + 1, a.model, a.latencyMs)}: {a.ok ? t("traceAccepted") : t("traceRejected", a.failure ? `${a.failure.kind}: ${a.failure.detail}` : "")}
            </h3>
            {a.raw ? (
              <>
                <p className="hint">{t("traceRaw")}</p>
                <pre tabIndex={0}>{a.raw}</pre>
              </>
            ) : (
              <p>{t("traceNone")}</p>
            )}
          </div>
        ))}
      </dialog>
    </>
  );
}
