import { z } from "zod";

export const ProfileSchema = z.object({
  ageBand: z.enum(["child", "adult", "older"]),
  hasRespiratoryCondition: z.boolean().default(false),
  windows: z.enum(["tight", "typical", "leaky"]),
  purifierCadr: z.number().min(0).max(2000).default(0),
  roomVolumeM3: z.number().min(5).max(200).default(30),
  commuteMode: z.enum(["walk", "two_wheeler", "bus", "metro", "car_closed"]),
  commuteKm: z.number().min(0).max(100).default(0),
  awayDuringDay: z.boolean(),
  outdoorActivity: z.enum(["morning", "evening", "none"]),
  windowsOpenHabit: z.boolean(),
  budget: z.enum(["low", "medium", "high"]).default("medium"),
});
export type Profile = z.infer<typeof ProfileSchema>;

export const PlanRequestSchema = z.object({
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  placeLabel: z.string().trim().min(1).max(120),
  dayOffset: z.number().int().min(0).max(2).default(0),
  /** When set, replaces live data with a clearly labelled synthetic smog day. */
  simulatePeakPm25: z.number().min(0).max(900).optional(),
  language: z.enum(["en", "hi"]).default("en"),
  profile: ProfileSchema,
  /** Free text from the user. Treated as untrusted data, never as instructions. */
  notes: z.string().max(300).optional(),
});
export type PlanRequest = z.infer<typeof PlanRequestSchema>;

const ACTION_IDS = ["shift_outdoor", "close_windows", "run_purifier", "diy_filter", "mask_unavoidable", "swap_commute"] as const;

/** What Gemini is allowed to return. It cannot return impact numbers; the server attaches those. */
export const AiPlanSchema = z.object({
  summary: z.string().min(1).max(400),
  timeline: z
    .array(
      z.object({
        hour: z.number().int().min(0).max(23),
        title: z.string().min(1).max(80),
        why: z.string().min(1).max(240),
        actionId: z.enum(ACTION_IDS).optional(),
      }),
    )
    .max(10),
  indoorHacks: z
    .array(z.object({ title: z.string().min(1).max(80), how: z.string().min(1).max(260), actionId: z.enum(ACTION_IDS).optional() }))
    .max(6),
  sustainableSwaps: z
    .array(z.object({ title: z.string().min(1).max(80), why: z.string().min(1).max(260), actionId: z.enum(ACTION_IDS).optional() }))
    .max(5),
  questions: z.array(z.string().max(160)).max(3),
  caveats: z.array(z.string().max(200)).max(3),
});
export type AiPlan = z.infer<typeof AiPlanSchema>;
