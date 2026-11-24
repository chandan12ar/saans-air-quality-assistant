import { createPlanHandler } from "@/lib/handlers";
import { defaultPlanDeps, planLimiter } from "@/lib/serverDeps";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const POST = createPlanHandler({ plan: defaultPlanDeps(), limiter: planLimiter() });
