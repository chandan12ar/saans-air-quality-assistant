export type AgeBand = "child" | "adult" | "older";
export type Activity = "rest" | "light" | "moderate";
export type Place = "home" | "outdoor" | "commute" | "indoor_other";
export type CommuteMode = "walk" | "two_wheeler" | "bus" | "metro" | "car_closed";
export type WindowType = "tight" | "typical" | "leaky";
export type ScenarioName = "optimistic" | "central" | "pessimistic";

export interface HourSlot {
  place: Place;
  activity: Activity;
  commuteMode?: CommuteMode;
  /** Home hours only. */
  windowsOpen?: boolean;
  purifier?: boolean;
  mask?: boolean;
  /** An outdoor activity (walk, play, exercise) that could be shifted to another hour. */
  movable?: boolean;
}

export interface Person {
  ageBand: AgeBand;
}

export interface Home {
  windows: WindowType;
  /** Rated clean air delivery rate of an existing purifier, m³/h. 0 means none. */
  purifierCadr: number;
  roomVolumeM3: number;
}

export interface Range {
  low: number;
  central: number;
  high: number;
}

export type ActionId =
  | "shift_outdoor"
  | "close_windows"
  | "run_purifier"
  | "diy_filter"
  | "mask_unavoidable"
  | "swap_commute";

export interface ActionEffect {
  id: ActionId;
  /** Daily inhaled PM2.5 avoided, micrograms. Can be negative (a trade-off). */
  avoidedUg: Range;
  /** Grams CO2e avoided per day; only set for actions that change emissions. */
  co2eAvoidedG?: number;
  /** True when the action is part of the recommended plan; false for opt-in trade-offs. */
  applied: boolean;
  detail: string;
  /** shift_outdoor only: the hours the activity moves from and to. */
  moves?: Array<{ from: number; to: number }>;
}

export interface Ledger {
  baselineUg: Range;
  plannedUg: Range;
  /** Percentage reduction of the planned day versus baseline. */
  reductionPct: Range;
  actions: ActionEffect[];
  /** True when no action reduces exposure meaningfully (for example a clean-air day). */
  nothingToDo: boolean;
}
