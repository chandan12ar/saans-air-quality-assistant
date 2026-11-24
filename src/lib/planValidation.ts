import type { ActionEffect, ActionId, Ledger } from "@/engine";
import type { EnrichedPlan, FailureKind } from "./planTypes";
import { AiPlanSchema, type AiPlan } from "./schemas";

/**
 * Digits in Latin or Devanagari script, followed (optionally after a space) by a unit
 * that would make the number an impact claim. The model must never produce these:
 * all impact figures come from the engine and are attached by action id.
 */
const DIGIT = "[0-9०-९]";
const UNIT =
  "(?:%|percent|per\\s?cent|प्रतिशत|µg|μg|ug\\b|mcg|micrograms?|grams?\\b|g\\s?co|kg\\b|tonnes?\\b|kilograms?|co2|co₂|सीओ\\s?2|x\\s?(?:less|fewer|lower|more))";
const UNGROUNDED_RE = new RegExp(`${DIGIT}[0-9०-९.,]*\\s*${UNIT}`, "i");
const PERCENT_ANYWHERE_RE = /[%％]/;
const MARKUP_RE = /https?:\/\/|www\.|<\/?[a-z][^>]*>|\]\(|javascript:/i;

/** Control, zero-width and bidi-override characters have no place in prompt data. */
const isHiddenChar = (code: number): boolean =>
  code <= 0x1f ||
  (code >= 0x7f && code <= 0x9f) ||
  (code >= 0x200b && code <= 0x200f) ||
  (code >= 0x202a && code <= 0x202e) ||
  (code >= 0x2066 && code <= 0x2069);

export function sanitizeFreeText(input: string, maxLength: number): string {
  return Array.from(input, (ch) => (isHiddenChar(ch.codePointAt(0) ?? 0) ? " " : ch))
    .join("")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

/** Collects every free-text string the model produced. */
export function planTexts(plan: AiPlan): string[] {
  return [
    plan.summary,
    ...plan.timeline.flatMap((t) => [t.title, t.why]),
    ...plan.indoorHacks.flatMap((h) => [h.title, h.how]),
    ...plan.sustainableSwaps.flatMap((s) => [s.title, s.why]),
    ...plan.questions,
    ...plan.caveats,
  ];
}

/** Returns the offending snippets: numbers carrying %, µg, CO2 or similar impact units. */
export function findUngroundedNumbers(plan: AiPlan): string[] {
  const hits: string[] = [];
  for (const text of planTexts(plan)) {
    const m = UNGROUNDED_RE.exec(text);
    if (m) hits.push(m[0].trim());
    else if (PERCENT_ANYWHERE_RE.test(text)) hits.push("%");
  }
  return hits;
}

export type Validation =
  | { ok: true; plan: AiPlan }
  | { ok: false; kind: FailureKind; detail: string };

export function parseModelJson(text: string): { ok: true; value: unknown } | { ok: false } {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  try {
    return { ok: true, value: JSON.parse(cleaned) as unknown };
  } catch {
    return { ok: false };
  }
}

/** Full validation of a raw model response: shape, grounded actions, no invented numbers, no markup. */
export function validateModelOutput(text: string, allowedActions: ReadonlySet<ActionId>): Validation {
  const parsed = parseModelJson(text);
  if (!parsed.ok) return { ok: false, kind: "invalid_json", detail: "Response was not valid JSON" };

  const shape = AiPlanSchema.safeParse(parsed.value);
  if (!shape.success) {
    const first = shape.error.issues[0];
    return { ok: false, kind: "invalid_schema", detail: `${first?.path.join(".") ?? "plan"}: ${first?.message ?? "invalid"}` };
  }
  const plan = shape.data;

  const refs = [...plan.timeline, ...plan.indoorHacks, ...plan.sustainableSwaps].map((i) => i.actionId);
  const bad = refs.find((id) => id !== undefined && !allowedActions.has(id));
  if (bad) return { ok: false, kind: "invalid_action", detail: `Action "${bad}" is not available for this household/day` };

  const ungrounded = findUngroundedNumbers(plan);
  if (ungrounded.length) {
    return { ok: false, kind: "ungrounded_numbers", detail: `Model wrote its own impact figures: ${ungrounded.slice(0, 3).join(", ")}` };
  }
  if (planTexts(plan).some((t) => MARKUP_RE.test(t))) {
    return { ok: false, kind: "unsafe_content", detail: "Response contained links or markup" };
  }
  return { ok: true, plan };
}

/** Attaches engine-computed impact to every item that references an action id. */
export function attachImpact(plan: AiPlan, ledger: Ledger): EnrichedPlan {
  const byId = new Map<ActionId, ActionEffect>(ledger.actions.map((a) => [a.id, a]));
  const withImpact = <T extends { actionId?: ActionId }>(item: T) => {
    const impact = item.actionId ? byId.get(item.actionId) : undefined;
    return impact ? { ...item, impact } : { ...item };
  };
  return {
    summary: plan.summary,
    timeline: [...plan.timeline].sort((a, b) => a.hour - b.hour).map(withImpact),
    indoorHacks: plan.indoorHacks.map(withImpact),
    sustainableSwaps: plan.sustainableSwaps.map(withImpact),
    questions: plan.questions,
    caveats: plan.caveats,
  };
}
