import { beforeEach, describe, expect, it, vi } from "vitest";
import { AirDataError, clearForecastCache, dayValues, fetchForecast, fillGaps, searchPlaces, simulatedDay } from "@/lib/airQuality";

const hours = (date: string) => Array.from({ length: 24 }, (_, h) => `${date}T${String(h).padStart(2, "0")}:00`);

const payload = (pm25: Array<number | null>, days = 1) => ({
  timezone: "Asia/Kolkata",
  hourly: {
    time: Array.from({ length: days }, (_, d) => hours(`2026-11-${24 + d}`)).flat(),
    pm2_5: pm25,
  },
});

const json = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status }));
const flat = (v: number, n = 24) => Array.from({ length: n }, () => v);

beforeEach(() => clearForecastCache());

describe("fetchForecast", () => {
  it("parses a valid response and builds the request for the right coordinates", async () => {
    let url = "";
    const f = await fetchForecast(
      28.6139,
      77.209,
      (u) => {
        url = String(u);
        return json(payload(flat(80)));
      },
      () => 1_000,
    );
    expect(url).toContain("latitude=28.614");
    expect(url).toContain("hourly=pm2_5");
    expect(f.pm25).toHaveLength(24);
    expect(f.source).toBe("open-meteo");
  });

  it("serves a nearby repeat request from the cache, then refetches after the TTL", async () => {
    let calls = 0;
    const fetchImpl = () => {
      calls++;
      return json(payload(flat(80)));
    };
    let now = 0;
    await fetchForecast(28.61, 77.21, fetchImpl, () => now);
    await fetchForecast(28.62, 77.22, fetchImpl, () => now); // same ~11 km cell
    expect(calls).toBe(1);
    now = 31 * 60 * 1000;
    await fetchForecast(28.61, 77.21, fetchImpl, () => now);
    expect(calls).toBe(2);
  });

  it("rejects out-of-range coordinates before any network call", async () => {
    let calls = 0;
    await expect(fetchForecast(120, 0, () => (calls++, json({})))).rejects.toBeInstanceOf(AirDataError);
    expect(calls).toBe(0);
  });

  it.each([429, 500, 503])("raises AirDataError on upstream HTTP %i", async (status) => {
    await expect(fetchForecast(10, 10, () => json({ error: true }, status))).rejects.toThrow(/Upstream responded/);
  });

  it("raises AirDataError on malformed JSON and unexpected shapes", async () => {
    await expect(fetchForecast(10, 10, () => Promise.resolve(new Response("<html>oops</html>")))).rejects.toBeInstanceOf(AirDataError);
    await expect(fetchForecast(11, 11, () => json({ hello: "world" }))).rejects.toThrow(/Unexpected air quality response/);
  });

  it("raises AirDataError on a network failure", async () => {
    await expect(fetchForecast(12, 12, () => Promise.reject(new TypeError("fetch failed")))).rejects.toThrow(/Could not reach/);
  });

  it("aborts a hung request instead of waiting forever", async () => {
    const hung = (_u: unknown, init?: RequestInit) =>
      new Promise<Response>((_, reject) => init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError"))));
    vi.useFakeTimers();
    try {
      const outcome = expect(fetchForecast(13, 13, hung as typeof fetch)).rejects.toBeInstanceOf(AirDataError);
      await vi.advanceTimersByTimeAsync(8_001); // the client's 8 s timeout
      await outcome;
    } finally {
      vi.useRealTimers();
    }
  });

  it("rejects an incomplete response", async () => {
    await expect(fetchForecast(14, 14, () => json({ timezone: "x", hourly: { time: ["2026-11-24T00:00"], pm2_5: [10] } }))).rejects.toThrow(/incomplete/);
    await expect(
      fetchForecast(15, 15, () => json({ timezone: "x", hourly: { time: hours("2026-11-24"), pm2_5: [1, 2] } })),
    ).rejects.toThrow(/incomplete/);
  });
});

describe("dayValues", () => {
  const forecast = async (values: Array<number | null>, days = 1) => fetchForecast(20 + days, 20, () => json(payload(values, days)));

  it("returns the requested day of a multi-day forecast", async () => {
    const f = await forecast([...flat(10), ...flat(20)], 2);
    expect(dayValues(f, 0)[5]).toBe(10);
    expect(dayValues(f, 1)[5]).toBe(20);
  });

  it("errors when the requested day is beyond the forecast", async () => {
    const f = await forecast(flat(10));
    expect(() => dayValues(f, 2)).toThrow(/outside the forecast/);
  });

  it("clamps negative values to zero", async () => {
    const f = await forecast(flat(-5));
    expect(dayValues(f, 0).every((v) => v === 0)).toBe(true);
  });
});

describe("fillGaps", () => {
  it("interpolates interior gaps and extends the edges", () => {
    const out = fillGaps([null, 10, null, null, 40, null]);
    expect(out).toEqual([10, 10, 20, 30, 40, 40]);
  });

  it("refuses to guess when too many hours are missing or all are", () => {
    expect(() => fillGaps(Array.from({ length: 24 }, (_, i) => (i < 10 ? 5 : null)))).toThrow(/Too many missing/);
    expect(() => fillGaps(Array.from({ length: 24 }, () => null))).toThrow(AirDataError);
  });

  it("accepts exactly the maximum tolerated gap", () => {
    const raw = Array.from({ length: 24 }, (_, i) => (i >= 9 && i < 15 ? null : 50));
    expect(fillGaps(raw)).toHaveLength(24);
  });
});

describe("simulatedDay", () => {
  it("produces 24 hours, peaks near the evening and respects the requested peak", () => {
    const day = simulatedDay(400);
    expect(day).toHaveLength(24);
    expect(Math.max(...day)).toBe(400);
    expect(day[20]).toBeGreaterThan(day[14] ?? Infinity);
  });

  it("clamps absurd inputs", () => {
    expect(Math.max(...simulatedDay(10_000))).toBe(900);
    expect(Math.max(...simulatedDay(-50))).toBe(0);
  });
});

describe("searchPlaces", () => {
  it("maps geocoding results to labelled coordinates", async () => {
    const res = await searchPlaces("Mysuru", () =>
      json({ results: [{ name: "Mysuru", latitude: 12.3, longitude: 76.6, country: "India", admin1: "Karnataka" }] }),
    );
    expect(res).toEqual([{ label: "Mysuru, Karnataka, India", lat: 12.3, lon: 76.6 }]);
  });

  it("returns no results for a too-short query without calling out", async () => {
    let calls = 0;
    expect(await searchPlaces("a", () => (calls++, json({})))).toEqual([]);
    expect(calls).toBe(0);
  });

  it("returns an empty list when nothing matches (the API omits results)", async () => {
    expect(await searchPlaces("zzzzzz", () => json({}))).toEqual([]);
  });

  it("encodes the query safely, including Hindi script", async () => {
    let url = "";
    await searchPlaces("मैसूर & <b>", (u) => {
      url = String(u);
      return json({});
    });
    expect(url).toContain(encodeURIComponent("मैसूर & <b>"));
    expect(url).not.toContain("<b>");
  });

  it("raises AirDataError on a malformed geocoding response", async () => {
    await expect(searchPlaces("Delhi", () => json({ results: "nope" }))).rejects.toBeInstanceOf(AirDataError);
  });
});
