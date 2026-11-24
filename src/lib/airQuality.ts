import { z } from "zod";

const OPEN_METEO_AQ = "https://air-quality-api.open-meteo.com/v1/air-quality";
const OPEN_METEO_GEO = "https://geocoding-api.open-meteo.com/v1/search";
const TIMEOUT_MS = 8000;
const CACHE_TTL_MS = 30 * 60 * 1000;
const MAX_NULL_HOURS = 6;

export const CoordinatesSchema = z.object({
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
});

const AirQualityResponseSchema = z.object({
  timezone: z.string(),
  hourly: z.object({
    time: z.array(z.string()),
    pm2_5: z.array(z.number().nullable()),
  }),
});

const GeocodeResponseSchema = z.object({
  results: z
    .array(
      z.object({
        name: z.string(),
        latitude: z.number(),
        longitude: z.number(),
        country: z.string().optional(),
        admin1: z.string().optional(),
      }),
    )
    .optional(),
});

export interface HourlyForecast {
  /** Local ISO times, e.g. 2026-11-24T14:00. */
  times: string[];
  pm25: Array<number | null>;
  timezone: string;
  fetchedAt: string;
  source: "open-meteo";
}

export class AirDataError extends Error {
  constructor(message: string, override readonly cause?: unknown) {
    super(message);
    this.name = "AirDataError";
  }
}

type FetchLike = typeof fetch;

async function getJson(url: string, fetchImpl: FetchLike): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetchImpl(url, { signal: controller.signal });
    if (!res.ok) throw new AirDataError(`Upstream responded ${res.status}`);
    return await res.json();
  } catch (err) {
    if (err instanceof AirDataError) throw err;
    throw new AirDataError("Could not reach the air quality service", err);
  } finally {
    clearTimeout(timer);
  }
}

const cache = new Map<string, { at: number; value: HourlyForecast }>();

/** Rounds to ~11 km so nearby requests share a cache entry (the data is regional model output anyway). */
const cacheKey = (lat: number, lon: number) => `${lat.toFixed(1)},${lon.toFixed(1)}`;

export function clearForecastCache(): void {
  cache.clear();
}

export async function fetchForecast(
  lat: number,
  lon: number,
  fetchImpl: FetchLike = fetch,
  now: () => number = Date.now,
): Promise<HourlyForecast> {
  const coords = CoordinatesSchema.safeParse({ lat, lon });
  if (!coords.success) throw new AirDataError("Coordinates out of range");

  const key = cacheKey(lat, lon);
  const hit = cache.get(key);
  if (hit && now() - hit.at < CACHE_TTL_MS) return hit.value;

  const url = `${OPEN_METEO_AQ}?latitude=${lat.toFixed(3)}&longitude=${lon.toFixed(3)}&hourly=pm2_5&forecast_days=3&timezone=auto`;
  const parsed = AirQualityResponseSchema.safeParse(await getJson(url, fetchImpl));
  if (!parsed.success) throw new AirDataError("Unexpected air quality response format");

  const { time, pm2_5 } = parsed.data.hourly;
  if (time.length !== pm2_5.length || time.length < 24) throw new AirDataError("Air quality response is incomplete");

  const value: HourlyForecast = {
    times: time,
    pm25: pm2_5,
    timezone: parsed.data.timezone,
    fetchedAt: new Date(now()).toISOString(),
    source: "open-meteo",
  };
  cache.set(key, { at: now(), value });
  return value;
}

/**
 * Returns the 24 hourly PM2.5 values for the given day (0 = first date in the forecast).
 * Isolated gaps are filled by interpolation; too many gaps is an error rather than a guess.
 */
export function dayValues(forecast: HourlyForecast, dayOffset: number): number[] {
  const firstDate = forecast.times[0]?.slice(0, 10);
  if (!firstDate) throw new AirDataError("Empty forecast");
  const dates = [...new Set(forecast.times.map((t) => t.slice(0, 10)))];
  const date = dates[dayOffset];
  if (!date) throw new AirDataError("Requested day is outside the forecast range");

  const raw: Array<number | null> = Array.from({ length: 24 }, () => null);
  forecast.times.forEach((t, i) => {
    if (t.startsWith(date)) {
      const hour = Number(t.slice(11, 13));
      if (Number.isInteger(hour) && hour >= 0 && hour < 24) raw[hour] = forecast.pm25[i] ?? null;
    }
  });
  return fillGaps(raw);
}

export function fillGaps(raw: ReadonlyArray<number | null>): number[] {
  const known = raw.map((v, i) => ({ v, i })).filter((x): x is { v: number; i: number } => x.v !== null);
  if (raw.length - known.length > MAX_NULL_HOURS || known.length === 0) {
    throw new AirDataError("Too many missing hours to build a reliable day");
  }
  return raw.map((v, i) => {
    if (v !== null) return Math.max(0, v);
    const prev = [...known].reverse().find((k) => k.i < i);
    const next = known.find((k) => k.i > i);
    if (prev && next) return prev.v + ((next.v - prev.v) * (i - prev.i)) / (next.i - prev.i);
    return (prev ?? next)!.v;
  });
}

/**
 * Synthetic winter-smog day for testing the assistant on clean-air days.
 * Always labelled as simulated in the UI. `peakPm25` is the evening peak.
 */
export function simulatedDay(peakPm25: number): number[] {
  const peak = Math.max(0, Math.min(900, peakPm25));
  return Array.from({ length: 24 }, (_, h) => {
    const evening = Math.exp(-((h - 20) ** 2) / 8);
    const morning = Math.exp(-((h - 7) ** 2) / 10) * 0.8;
    const afternoonDip = h >= 12 && h <= 15 ? 0.45 : 0;
    const shape = Math.max(0.35, Math.max(evening, morning) - afternoonDip + 0.35);
    return Math.round(peak * Math.min(1, shape));
  });
}

export interface GeoResult {
  label: string;
  lat: number;
  lon: number;
}

export async function searchPlaces(query: string, fetchImpl: FetchLike = fetch): Promise<GeoResult[]> {
  const q = query.trim().slice(0, 80);
  if (q.length < 2) return [];
  const url = `${OPEN_METEO_GEO}?name=${encodeURIComponent(q)}&count=5&language=en&format=json`;
  const parsed = GeocodeResponseSchema.safeParse(await getJson(url, fetchImpl));
  if (!parsed.success) throw new AirDataError("Unexpected geocoding response format");
  return (parsed.data.results ?? []).map((r) => ({
    label: [r.name, r.admin1, r.country].filter(Boolean).join(", "),
    lat: r.latitude,
    lon: r.longitude,
  }));
}
