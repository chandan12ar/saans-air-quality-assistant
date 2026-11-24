import type { CommuteMode, HourSlot } from "./types";

export interface RoutineProfile {
  commuteMode: CommuteMode;
  /** One-way commute distance in km. */
  commuteKm: number;
  /** Away from home on weekdays for work or school. */
  awayDuringDay: boolean;
  outdoorActivity: "morning" | "evening" | "none";
  windowsOpenHabit: boolean;
}

/** Builds a typical 24-hour day from a household's routine. Pure and deterministic. */
export function buildDefaultSlots(p: RoutineProfile): HourSlot[] {
  const slots: HourSlot[] = [];
  for (let h = 0; h < 24; h++) {
    const homeSlot = (activity: HourSlot["activity"]): HourSlot => ({
      place: "home",
      activity,
      windowsOpen: p.windowsOpenHabit && h >= 6 && h <= 22,
    });

    if (h < 6 || h === 23) slots.push({ place: "home", activity: "rest", windowsOpen: false });
    else if (p.outdoorActivity === "morning" && h === 6) slots.push({ place: "outdoor", activity: "moderate", movable: true });
    else if (p.awayDuringDay && h === 8) slots.push({ place: "commute", activity: "light", commuteMode: p.commuteMode });
    else if (p.awayDuringDay && h >= 9 && h <= 16) slots.push({ place: "indoor_other", activity: "light" });
    else if (p.awayDuringDay && h === 17) slots.push({ place: "commute", activity: "light", commuteMode: p.commuteMode });
    else if (p.outdoorActivity === "evening" && h === 18) slots.push({ place: "outdoor", activity: "moderate", movable: true });
    else slots.push(homeSlot("light"));
  }
  return slots;
}
