import { createPlacesHandler } from "@/lib/handlers";
import { placesLimiter } from "@/lib/serverDeps";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = createPlacesHandler({ limiter: placesLimiter() });
