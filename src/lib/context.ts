import { buildDefaultSlots, type PlanContext } from "@/engine";
import type { Profile } from "./schemas";

/** Builds the engine input from a household profile and a day of hourly PM2.5. Shared by server and browser. */
export function contextFor(profile: Profile, hourly: readonly number[]): PlanContext {
  return {
    outdoor: hourly,
    slots: buildDefaultSlots(profile),
    person: { ageBand: profile.ageBand },
    home: { windows: profile.windows, purifierCadr: profile.purifierCadr, roomVolumeM3: profile.roomVolumeM3 },
    commuteKm: profile.commuteKm,
  };
}
