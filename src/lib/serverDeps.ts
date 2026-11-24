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

/** Plan requests call a paid/limited upstream, so they get a tighter budget than place search. */
export const planLimiter = () => createRateLimiter({ limit: 8, windowMs: 60_000 });
export const placesLimiter = () => createRateLimiter({ limit: 30, windowMs: 60_000 });
