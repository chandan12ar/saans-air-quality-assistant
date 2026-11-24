import type { Language } from "@/lib/labels";
import type { PlanRequest, Profile } from "@/lib/schemas";

export interface PlaceChoice {
  label: string;
  lat: number;
  lon: number;
}

export interface FormState {
  place: PlaceChoice | null;
  language: Language;
  dayOffset: 0 | 1 | 2;
  simulate: boolean;
  simulatePeak: number;
  profile: Profile;
  notes: string;
}

export const DEFAULT_PROFILE: Profile = {
  ageBand: "adult",
  hasRespiratoryCondition: false,
  windows: "typical",
  purifierCadr: 0,
  roomVolumeM3: 30,
  commuteMode: "metro",
  commuteKm: 8,
  awayDuringDay: true,
  outdoorActivity: "none",
  windowsOpenHabit: false,
  budget: "medium",
};

export const INITIAL_FORM: FormState = {
  place: null,
  language: "en",
  dayOffset: 0,
  simulate: false,
  simulatePeak: 300,
  profile: DEFAULT_PROFILE,
  notes: "",
};

export function toRequest(form: FormState, place: PlaceChoice): Omit<PlanRequest, "notes"> & { notes?: string } {
  const notes = form.notes.trim();
  return {
    lat: place.lat,
    lon: place.lon,
    placeLabel: place.label,
    dayOffset: form.dayOffset,
    language: form.language,
    profile: form.profile,
    ...(form.simulate ? { simulatePeakPm25: form.simulatePeak } : {}),
    ...(notes ? { notes } : {}),
  };
}

export interface Preset {
  id: "delhi" | "lucknow";
  place: PlaceChoice;
  profile: Profile;
}

export const PRESETS: Preset[] = [
  {
    id: "delhi",
    place: { label: "New Delhi, Delhi, India", lat: 28.61, lon: 77.21 },
    profile: {
      ageBand: "child",
      hasRespiratoryCondition: true,
      windows: "leaky",
      purifierCadr: 0,
      roomVolumeM3: 30,
      commuteMode: "two_wheeler",
      commuteKm: 8,
      awayDuringDay: true,
      outdoorActivity: "evening",
      windowsOpenHabit: true,
      budget: "medium",
    },
  },
  {
    id: "lucknow",
    place: { label: "Lucknow, Uttar Pradesh, India", lat: 26.85, lon: 80.95 },
    profile: {
      ageBand: "older",
      hasRespiratoryCondition: false,
      windows: "typical",
      purifierCadr: 250,
      roomVolumeM3: 25,
      commuteMode: "walk",
      commuteKm: 1,
      awayDuringDay: false,
      outdoorActivity: "morning",
      windowsOpenHabit: true,
      budget: "low",
    },
  },
];
