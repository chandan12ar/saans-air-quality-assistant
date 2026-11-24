import { simulatedDay, type HourlyForecast } from "@/lib/airQuality";
import { BoundedTtlCache } from "@/lib/boundedCache";
import type { GeminiCall, GeminiRawResult, GeminiRequest } from "@/lib/gemini";
import type { PlanDeps } from "@/lib/planService";
import { PlanRequestSchema, type PlanRequest } from "@/lib/schemas";

export const NOW = Date.parse("2026-11-24T09:00:00Z");

/** Delhi-NCR family: asthmatic child, leaky windows, no purifier, two-wheeler commute, evening play. */
export function demoRequest(overrides: Partial<PlanRequest> = {}): PlanRequest {
  return PlanRequestSchema.parse({
    lat: 28.6139,
    lon: 77.209,
    placeLabel: "New Delhi, Delhi, India",
    dayOffset: 0,
    language: "en",
    profile: {
      ageBand: "child",
      hasRespiratoryCondition: true,
      windows: "leaky",
      purifierCadr: 0,
      roomVolumeM3: 30,
      commuteMode: "two_wheeler",
      commuteKm: 8,
      awayDuringDay: true,
      outdoorActivity: "evening",
      windowsOpenHabit: true,
      budget: "medium",
    },
    ...overrides,
  });
}

export function smogForecast(peak = 300): HourlyForecast {
  const times: string[] = [];
  const pm25: number[] = [];
  for (const day of ["2026-11-24", "2026-11-25", "2026-11-26"]) {
    simulatedDay(peak).forEach((v, h) => {
      times.push(`${day}T${String(h).padStart(2, "0")}:00`);
      pm25.push(v);
    });
  }
  return { times, pm25, timezone: "Asia/Kolkata", fetchedAt: new Date(NOW).toISOString(), source: "open-meteo" };
}

export const VALID_PLAN = {
  summary: "Smog peaks in the evening, so move play to the afternoon and keep windows closed after sunset.",
  timeline: [
    { hour: 18, title: "Wear a fitted mask for the evening walk", why: "The evening walk cannot move, so protect yourself.", actionId: "mask_unavoidable" },
    { hour: 19, title: "Stay in with windows closed", why: "Evening is the most polluted period.", actionId: "close_windows" },
  ],
  indoorHacks: [{ title: "Build a box-fan filter", how: "Strap a MERV-13 filter to a box fan in the main room.", actionId: "diy_filter" }],
  sustainableSwaps: [{ title: "Take the metro", why: "Cuts emissions versus the two-wheeler.", actionId: "swap_commute" }],
  questions: ["Does your building have a shared clean room?"],
  caveats: ["Modelled estimate, not medical advice. Seek care for breathing trouble."],
};

export const okResult = (plan: unknown = VALID_PLAN): GeminiRawResult => ({ text: JSON.stringify(plan) });

/** Scripted Gemini: each call consumes the next step. A step may be a result or an error to throw. */
export function scriptedGemini(steps: Array<GeminiRawResult | Error | "hang">): { call: GeminiCall; requests: GeminiRequest[] } {
  const requests: GeminiRequest[] = [];
  let i = 0;
  const call: GeminiCall = (req) => {
    requests.push(req);
    const step = steps[Math.min(i++, steps.length - 1)];
    if (step === "hang") return new Promise<GeminiRawResult>(() => undefined);
    if (step instanceof Error) return Promise.reject(step);
    return Promise.resolve(step ?? {});
  };
  return { call, requests };
}

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message = `HTTP ${status}`,
  ) {
    super(message);
  }
}

export function makeDeps(call: GeminiCall | null, overrides: Partial<PlanDeps> = {}): PlanDeps {
  return {
    fetchForecast: () => Promise.resolve(smogForecast()),
    geminiCall: call,
    models: ["primary-model", "fallback-model"],
    now: () => NOW,
    aiCache: new BoundedTtlCache(50, 20 * 60 * 1000, () => NOW),
    ...overrides,
  };
}
