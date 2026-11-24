import type { ActionEffect, Ledger, NaqiBand } from "@/engine";
import type { AiPlan } from "./schemas";

export type WithImpact<T> = T & { impact?: ActionEffect };

/** The AI plan after the server has attached engine-computed impact by action id. */
export interface EnrichedPlan {
  summary: string;
  timeline: Array<WithImpact<AiPlan["timeline"][number]>>;
  indoorHacks: Array<WithImpact<AiPlan["indoorHacks"][number]>>;
  sustainableSwaps: Array<WithImpact<AiPlan["sustainableSwaps"][number]>>;
  questions: string[];
  caveats: string[];
}

export type FailureKind =
  | "not_configured"
  | "rate_limited"
  | "timeout"
  | "blocked"
  | "empty"
  | "invalid_json"
  | "invalid_schema"
  | "ungrounded_numbers"
  | "invalid_action"
  | "unsafe_content"
  | "upstream_error";

export interface AttemptTrace {
  model: string;
  ok: boolean;
  latencyMs: number;
  /** Raw model output text, exactly as received (may be absent on transport errors). */
  raw?: string;
  failure?: { kind: FailureKind; detail: string };
}

export interface AiTrace {
  systemInstruction: string;
  /** The exact structured input sent to the model. */
  input: unknown;
  attempts: AttemptTrace[];
}

export interface DaySummary {
  date: string;
  minPm25: number;
  meanPm25: number;
  maxPm25: number;
  band: NaqiBand;
}

export interface PlanMeta {
  source: "open-meteo" | "simulated";
  simulated: boolean;
  fetchedAt: string;
  aiUsed: boolean;
  model?: string;
  latencyMs?: number;
  cached: boolean;
  fallbackReason?: { kind: FailureKind; message: string };
  attribution: string;
}

export interface PlanResponse {
  place: string;
  date: string;
  hourly: number[];
  days: DaySummary[];
  ledger: Ledger;
  plan: EnrichedPlan;
  meta: PlanMeta;
  trace: AiTrace;
}
