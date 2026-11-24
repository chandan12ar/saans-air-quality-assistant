import { fetchForecast } from "./airQuality";
import { BoundedTtlCache } from "./boundedCache";
import { readGeminiConfig } from "./gemini";
import type { PlanDeps } from "./planService";
import { createRateLimiter } from "./rateLimit";

const AI_CACHE_TTL_MS = 20 * 60 * 1000;
const AI_CACHE_MAX = 200;

/** Production wiring for the API routes. Reads the Gemini key and model IDs from the environment only. */
export function defaultPlanDeps(): PlanDeps {
  const { call, models } = readGeminiConfig();
  return {
    fetchForecast: (lat, lon) => fetchForecast(lat, lon),
    geminiCall: call,
    models,
    now: Date.now,
    aiCache: new BoundedTtlCache(AI_CACHE_MAX, AI_CACHE_TTL_MS),
  };
}

/** Reads a positive integer from the environment, falling back to a default for anything else. */
export function intFromEnv(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

/** Plan requests call a rate-limited upstream, so they get a tighter budget than place search. */
export const planLimiter = () =>
  createRateLimiter({ limit: intFromEnv(process.env.RATE_LIMIT_PLAN_PER_MIN, 10), windowMs: 60_000 });
export const placesLimiter = () =>
  createRateLimiter({ limit: intFromEnv(process.env.RATE_LIMIT_PLACES_PER_MIN, 30), windowMs: 60_000 });
