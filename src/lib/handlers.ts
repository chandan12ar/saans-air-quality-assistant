import { AirDataError, searchPlaces as defaultSearchPlaces, type GeoResult } from "./airQuality";
import { buildPlan, PlanError, type PlanDeps } from "./planService";
import type { RateLimitResult } from "./rateLimit";
import { PlanRequestSchema } from "./schemas";

const MAX_BODY_CHARS = 8_000;
const NO_STORE = { "Cache-Control": "no-store" };

type Limiter = (key: string) => RateLimitResult;

function errorResponse(status: number, code: string, message: string, extra?: Record<string, unknown>, headers?: Record<string, string>): Response {
  return Response.json({ error: { code, message, ...extra } }, { status, headers: { ...NO_STORE, ...headers } });
}

export function clientKey(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || req.headers.get("x-real-ip")?.trim() || "unknown";
}

function limited(limiter: Limiter, req: Request): Response | null {
  const verdict = limiter(clientKey(req));
  if (verdict.allowed) return null;
  return errorResponse(429, "rate_limited", "Too many requests. Please wait a moment and try again.", undefined, {
    "Retry-After": String(verdict.retryAfterSeconds),
  });
}

export function createPlanHandler(deps: { plan: PlanDeps; limiter: Limiter }) {
  return async (req: Request): Promise<Response> => {
    const blocked = limited(deps.limiter, req);
    if (blocked) return blocked;

    const text = await req.text();
    if (text.length > MAX_BODY_CHARS) return errorResponse(413, "too_large", "Request is too large.");

    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      return errorResponse(400, "invalid_json", "Request body must be valid JSON.");
    }

    const parsed = PlanRequestSchema.safeParse(body);
    if (!parsed.success) {
      const issues = parsed.error.issues.slice(0, 8).map((i) => ({ path: i.path.join("."), message: i.message }));
      return errorResponse(400, "invalid_request", "Some fields are missing or out of range.", { issues });
    }

    try {
      const result = await buildPlan(parsed.data, deps.plan);
      return Response.json(result, { headers: NO_STORE });
    } catch (err) {
      if (err instanceof PlanError) return errorResponse(err.status, err.code, err.message);
      console.error("plan handler failed", err instanceof Error ? err.name : "unknown");
      return errorResponse(500, "internal", "Something went wrong while building the plan.");
    }
  };
}

export function createPlacesHandler(deps: { limiter: Limiter; search?: (q: string) => Promise<GeoResult[]> }) {
  const search = deps.search ?? ((q: string) => defaultSearchPlaces(q));
  return async (req: Request): Promise<Response> => {
    const blocked = limited(deps.limiter, req);
    if (blocked) return blocked;

    const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
    if (q.length < 2 || q.length > 80) return errorResponse(400, "invalid_query", "Type 2 to 80 characters to search.");

    try {
      return Response.json({ results: await search(q) }, { headers: NO_STORE });
    } catch (err) {
      if (err instanceof AirDataError) return errorResponse(502, "geocoding_unavailable", "Place search is unavailable right now.");
      return errorResponse(500, "internal", "Something went wrong while searching places.");
    }
  };
}
