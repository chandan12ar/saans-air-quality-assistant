import { createHash } from "node:crypto";
import { buildLedger, pm25ToAqi } from "@/engine";
import { AirDataError, dayValues, simulatedDay, type HourlyForecast } from "./airQuality";
import { BoundedTtlCache } from "./boundedCache";
import { contextFor } from "./context";
import { buildFallbackPlan } from "./fallbackPlan";
import { buildGeminiInput, generateAiPlan, type GeminiCall, type GenerateResult } from "./gemini";
import type { DaySummary, PlanResponse } from "./planTypes";
import { attachImpact, sanitizeFreeText } from "./planValidation";
import type { PlanRequest } from "./schemas";

export class PlanError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
    this.name = "PlanError";
  }
}

export interface PlanDeps {
  fetchForecast: (lat: number, lon: number) => Promise<HourlyForecast>;
  geminiCall: GeminiCall | null;
  /** Preferred model first, then fallback. */
  models: readonly string[];
  now: () => number;
  aiCache: BoundedTtlCache<Extract<GenerateResult, { ok: true }>>;
  geminiTimeoutMs?: number;
}

const ATTRIBUTION_LIVE = "Air-quality data: Open-Meteo.com (CC BY 4.0). Modelled regional estimates, not station readings.";
const ATTRIBUTION_SIM = "Synthetic smog day generated for demonstration. Not real data.";

function summarise(date: string, hourly: readonly number[]): DaySummary {
  const mean = hourly.reduce((a, b) => a + b, 0) / hourly.length;
  return { date, meanPm25: Math.round(mean), maxPm25: Math.round(Math.max(...hourly)), band: pm25ToAqi(mean).band };
}

function airFailure(err: unknown): PlanError {
  if (err instanceof AirDataError) {
    if (/missing hours|outside the forecast|incomplete|Empty forecast/i.test(err.message)) {
      return new PlanError("No reliable air-quality data for this location or day. Try a nearby city, or use the smog simulator.", 422, "no_coverage");
    }
    return new PlanError("The air-quality service is unavailable right now. Try again shortly, or use the smog simulator.", 502, "air_data_unavailable");
  }
  return new PlanError("Unexpected error while loading air-quality data.", 500, "internal");
}

export async function buildPlan(request: PlanRequest, deps: PlanDeps): Promise<PlanResponse> {
  const nowMs = deps.now();
  const simulated = request.simulatePeakPm25 !== undefined;
  const placeLabel = sanitizeFreeText(request.placeLabel, 120) || "Unknown place";
  const notes = request.notes ? sanitizeFreeText(request.notes, 300) || null : null;
  const req: PlanRequest = { ...request, placeLabel };

  let hourly: number[];
  let date: string;
  let days: DaySummary[];
  let fetchedAt = new Date(nowMs).toISOString();

  if (simulated) {
    hourly = simulatedDay(request.simulatePeakPm25 ?? 0);
    date = new Date(nowMs).toISOString().slice(0, 10);
    days = [summarise(date, hourly)];
  } else {
    try {
      const forecast = await deps.fetchForecast(req.lat, req.lon);
      hourly = dayValues(forecast, req.dayOffset);
      const dates = [...new Set(forecast.times.map((t) => t.slice(0, 10)))].slice(0, 3);
      date = dates[req.dayOffset] ?? dates[0] ?? "";
      days = dates.flatMap((d, i) => {
        try {
          return [summarise(d, dayValues(forecast, i))];
        } catch {
          return []; // an unusable neighbouring day must not break the selected one
        }
      });
      fetchedAt = forecast.fetchedAt;
    } catch (err) {
      throw airFailure(err);
    }
  }

  const ledger = buildLedger(contextFor(req.profile, hourly));

  const input = buildGeminiInput({ request: req, date, simulated, hourly, ledger, notes });
  const allowedActions = new Set(ledger.actions.map((a) => a.id));
  const cacheKey = createHash("sha256")
    .update(JSON.stringify({ input, models: deps.models }))
    .digest("hex");

  const hit = deps.aiCache.get(cacheKey);
  const cached = hit !== undefined;
  const result: GenerateResult =
    hit ??
    (await generateAiPlan({ input, allowedActions, call: deps.geminiCall, models: deps.models, timeoutMs: deps.geminiTimeoutMs, now: deps.now }));
  if (!cached && result.ok) deps.aiCache.set(cacheKey, result);

  const plan = result.ok
    ? result.plan
    : buildFallbackPlan({ ledger, hourly, language: req.language, placeLabel });

  return {
    place: placeLabel,
    date,
    hourly,
    days,
    ledger,
    plan: attachImpact(plan, ledger),
    meta: {
      source: simulated ? "simulated" : "open-meteo",
      simulated,
      fetchedAt,
      aiUsed: result.ok,
      model: result.ok ? result.model : undefined,
      latencyMs: result.ok ? result.latencyMs : undefined,
      cached,
      fallbackReason: result.ok ? undefined : result.failure,
      attribution: simulated ? ATTRIBUTION_SIM : ATTRIBUTION_LIVE,
    },
    trace: result.trace,
  };
}
