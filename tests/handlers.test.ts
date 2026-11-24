import { describe, expect, it } from "vitest";
import { AirDataError } from "@/lib/airQuality";
import { BoundedTtlCache } from "@/lib/boundedCache";
import { clientKey, createPlacesHandler, createPlanHandler } from "@/lib/handlers";
import { createRateLimiter } from "@/lib/rateLimit";
import { demoRequest, makeDeps, okResult, scriptedGemini } from "./fixtures";

const allow = () => ({ allowed: true, retryAfterSeconds: 0 });

const post = (body: unknown, headers: Record<string, string> = {}) =>
  new Request("http://localhost/api/plan", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

describe("POST /api/plan", () => {
  const handler = (call = scriptedGemini([okResult()]).call) => createPlanHandler({ plan: makeDeps(call), limiter: allow });

  it("returns 200 with no-store caching for a valid request", async () => {
    const res = await handler()(post(demoRequest()));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const json = (await res.json()) as { meta: { aiUsed: boolean }; ledger: unknown };
    expect(json.meta.aiUsed).toBe(true);
    expect(json.ledger).toBeDefined();
  });

  it("rejects malformed JSON", async () => {
    const res = await handler()(post("{not json"));
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe("invalid_json");
  });

  it("rejects out-of-range and missing fields without echoing the input", async () => {
    const bad = { ...demoRequest(), lat: 999, placeLabel: "SECRET-PLACE" };
    const res = await handler()(post(bad));
    expect(res.status).toBe(400);
    const text = await res.text();
    expect(text).toContain("lat");
    expect(text).not.toContain("SECRET-PLACE");
  });

  it("rejects an empty profile", async () => {
    const res = await handler()(post({ lat: 1, lon: 1, placeLabel: "x", profile: {} }));
    expect(res.status).toBe(400);
  });

  it("rejects notes longer than 300 characters", async () => {
    const res = await handler()(post({ ...demoRequest(), notes: "x".repeat(301) }));
    expect(res.status).toBe(400);
  });

  it("rejects an oversized body before parsing", async () => {
    const res = await handler()(post(`{"pad":"${"a".repeat(9000)}"}`));
    expect(res.status).toBe(413);
  });

  it("accepts Hindi script and emoji in notes", async () => {
    const res = await handler()(post({ ...demoRequest(), notes: "मेरा बच्चा 😷 खाँसता है", language: "hi" }));
    expect(res.status).toBe(200);
  });

  it("returns 429 with Retry-After once the limit is hit", async () => {
    const limiter = createRateLimiter({ limit: 2, windowMs: 60_000, now: () => 0 });
    const h = createPlanHandler({ plan: makeDeps(null, { models: [] }), limiter });
    const headers = { "x-forwarded-for": "1.2.3.4" };
    expect((await h(post(demoRequest(), headers))).status).toBe(200);
    expect((await h(post(demoRequest(), headers))).status).toBe(200);
    const res = await h(post(demoRequest(), headers));
    expect(res.status).toBe(429);
    expect(Number(res.headers.get("retry-after"))).toBeGreaterThan(0);
    expect((await h(post(demoRequest(), { "x-forwarded-for": "5.6.7.8" }))).status).toBe(200);
  });

  it("maps an upstream air-data outage to 502 with a helpful message", async () => {
    const deps = makeDeps(null, { fetchForecast: () => Promise.reject(new AirDataError("Upstream responded 500")) });
    const res = await createPlanHandler({ plan: deps, limiter: allow })(post(demoRequest()));
    expect(res.status).toBe(502);
    expect(await res.text()).toContain("simulator");
  });

  it("returns a generic 500 without leaking internals on an unexpected error", async () => {
    const deps = makeDeps(null, {
      fetchForecast: () => {
        throw new Error("db password is hunter2");
      },
    });
    const res = await createPlanHandler({ plan: deps, limiter: allow })(post(demoRequest()));
    expect(res.status).toBe(500);
    expect(await res.text()).not.toContain("hunter2");
  });
});

describe("GET /api/places", () => {
  const get = (q: string) => new Request(`http://localhost/api/places?q=${encodeURIComponent(q)}`);

  it("validates the query length", async () => {
    const h = createPlacesHandler({ limiter: allow, search: () => Promise.resolve([]) });
    expect((await h(get("a"))).status).toBe(400);
    expect((await h(get("x".repeat(81)))).status).toBe(400);
    expect((await h(new Request("http://localhost/api/places"))).status).toBe(400);
  });

  it("returns results, including for Hindi script", async () => {
    const h = createPlacesHandler({ limiter: allow, search: (q) => Promise.resolve([{ label: q, lat: 1, lon: 2 }]) });
    const res = await h(get("मैसूर"));
    expect(res.status).toBe(200);
    expect(((await res.json()) as { results: unknown[] }).results).toHaveLength(1);
  });

  it("returns an empty list for an unknown or ambiguous place without erroring", async () => {
    const h = createPlacesHandler({ limiter: allow, search: () => Promise.resolve([]) });
    const res = await h(get("zzzzzzzz"));
    expect(res.status).toBe(200);
    expect(((await res.json()) as { results: unknown[] }).results).toEqual([]);
  });

  it("maps a geocoding outage to 502", async () => {
    const h = createPlacesHandler({ limiter: allow, search: () => Promise.reject(new AirDataError("x")) });
    expect((await h(get("Delhi"))).status).toBe(502);
  });
});

describe("clientKey", () => {
  it("uses the first forwarded address, then x-real-ip, then a constant", () => {
    expect(clientKey(new Request("http://x", { headers: { "x-forwarded-for": "9.9.9.9, 1.1.1.1" } }))).toBe("9.9.9.9");
    expect(clientKey(new Request("http://x", { headers: { "x-real-ip": "8.8.8.8" } }))).toBe("8.8.8.8");
    expect(clientKey(new Request("http://x"))).toBe("unknown");
  });
});

describe("createRateLimiter", () => {
  it("allows up to the limit, blocks, then recovers after the window", () => {
    let t = 0;
    const check = createRateLimiter({ limit: 2, windowMs: 1000, now: () => t });
    expect(check("a").allowed).toBe(true);
    expect(check("a").allowed).toBe(true);
    const blocked = check("a");
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBe(1);
    t = 1001;
    expect(check("a").allowed).toBe(true);
  });

  it("keeps memory bounded", () => {
    const check = createRateLimiter({ limit: 1, windowMs: 1000, maxKeys: 3, now: () => 0 });
    for (let i = 0; i < 10; i++) check(`k${i}`);
    expect(check("k0").allowed).toBe(true); // oldest key was evicted
  });
});

describe("BoundedTtlCache", () => {
  it("expires entries and evicts the oldest beyond its bound", () => {
    let t = 0;
    const c = new BoundedTtlCache<number>(2, 100, () => t);
    c.set("a", 1);
    c.set("b", 2);
    c.set("c", 3);
    expect(c.get("a")).toBeUndefined();
    expect(c.size).toBe(2);
    t = 101;
    expect(c.get("b")).toBeUndefined();
    expect(c.size).toBe(1);
  });
});
