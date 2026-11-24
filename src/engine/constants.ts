/**
 * Every number the engine depends on lives here, tagged with its provenance.
 *  - "sourced":    taken from an official standard (URL given)
 *  - "assumption": a modelling assumption; shown to users as such and to be
 *                  replaced when a citation is found. Never presented as fact.
 */
export type Provenance =
  | { kind: "sourced"; source: string }
  | { kind: "assumption"; note: string };

export interface Const<T> {
  value: T;
  provenance: Provenance;
}

const sourced = <T>(value: T, source: string): Const<T> => ({ value, provenance: { kind: "sourced", source } });
const assumed = <T>(value: T, note: string): Const<T> => ({ value, provenance: { kind: "assumption", note } });

const CPCB = "CPCB National Air Quality Index (cpcb.nic.in), 24-hour averaging";

/** Upper concentration bound (µg/m³) of each CPCB band, with the sub-index range it maps to. */
export const CPCB_PM25_BANDS = sourced(
  [
    { band: "good", cMax: 30, iLow: 0, iHigh: 50 },
    { band: "satisfactory", cMax: 60, iLow: 51, iHigh: 100 },
    { band: "moderate", cMax: 90, iLow: 101, iHigh: 200 },
    { band: "poor", cMax: 120, iLow: 201, iHigh: 300 },
    { band: "very_poor", cMax: 250, iLow: 301, iHigh: 400 },
    { band: "severe", cMax: 500, iLow: 401, iHigh: 500 },
  ] as const,
  `${CPCB}, PM2.5`,
);

export const WHO_2021_PM25 = sourced(
  { h24: 15, annual: 5 },
  "WHO global air quality guidelines 2021 (µg/m³)",
);

/** Breathing rate in m³/hour by activity. Adult central values; scaled for age band below. */
export const BREATHING_M3_PER_H = assumed(
  { rest: 0.5, light: 0.9, moderate: 1.8 },
  "Typical adult inhalation rates; replace with US EPA Exposure Factors Handbook values when cited.",
);

export const AGE_BREATHING_SCALE = assumed(
  { child: 0.7, adult: 1, older: 0.9 },
  "Rough scaling of breathing volume by age band.",
);

/** Air changes per hour of the home. */
export const HOME_ACH = assumed(
  { tight: 0.3, typical: 0.6, leaky: 1.2, open: 4 },
  "Illustrative ranges for Indian apartments; windows open assumed well ventilated.",
);

export const PENETRATION = assumed(0.8, "Fraction of outdoor PM2.5 passing through the building envelope.");
export const DEPOSITION_PER_H = assumed(0.2, "Indoor PM2.5 loss to surfaces, per hour.");
export const OTHER_INDOOR_ACH = assumed(0.8, "Office/school air exchange when not at home.");

export const MASK_EFFECTIVENESS = assumed(0.6, "Real-world fit-adjusted N95/FFP2 reduction; lab values are higher.");
export const PURIFIER_DERATE = assumed(0.7, "Fraction of the rated CADR achieved in a real room.");
export const DIY_FILTER_CADR_M3_PER_H = assumed(200, "Box-fan plus MERV-13 filter DIY unit; conservative.");
export const DEFAULT_ROOM_VOLUME_M3 = assumed(30, "A bedroom-sized room.");

/** Fraction of outdoor PM2.5 reaching the occupant, by commute mode. */
export const COMMUTE_EXPOSURE_FACTOR = assumed(
  { walk: 1, two_wheeler: 1, bus: 0.9, metro: 0.8, car_closed: 0.6 },
  "In-vehicle filtration and enclosure effects; to be refined with a citation.",
);

/** Approximate grams CO2e per passenger-km, to compare commute modes. */
export const COMMUTE_G_CO2E_PER_KM = assumed(
  { walk: 0, two_wheeler: 50, bus: 40, metro: 30, car_closed: 170 },
  "Approximate per-passenger values; replace with an official source before quoting as fact.",
);

/** Scenario multipliers used to give every result a range instead of false precision. */
export const SCENARIOS = assumed(
  {
    optimistic: { ach: 0.7, penetration: 0.9, mask: 1.15, purifier: 1.2 },
    central: { ach: 1, penetration: 1, mask: 1, purifier: 1 },
    pessimistic: { ach: 1.4, penetration: 1.1, mask: 0.75, purifier: 0.7 },
  },
  "Uncertainty envelope applied to the assumed parameters above.",
);
