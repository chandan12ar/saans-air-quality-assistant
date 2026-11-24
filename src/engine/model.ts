import {
  AGE_BREATHING_SCALE,
  BREATHING_M3_PER_H,
  COMMUTE_EXPOSURE_FACTOR,
  DEPOSITION_PER_H,
  HOME_ACH,
  MASK_EFFECTIVENESS,
  OTHER_INDOOR_ACH,
  PENETRATION,
  PURIFIER_DERATE,
  SCENARIOS,
} from "./constants";
import type { HourSlot, Home, Person, ScenarioName } from "./types";

export interface DoseResult {
  /** Total PM2.5 inhaled over the 24 hours, micrograms. */
  totalUg: number;
  perHourUg: number[];
}

const at = (values: readonly number[], i: number): number => values[i] ?? 0;

/**
 * Inhaled PM2.5 dose for one person over a 24-hour day.
 *
 * Indoor air at home follows a well-mixed mass balance, solved exactly per hour:
 *   dC/dt = a·P·Cout − (a + k + q)·C
 * with a = air changes per hour, P = penetration, k = deposition, q = CADR/V.
 * Away from home, windows are treated as closed and the purifier follows its flag.
 */
export function computeDose(
  outdoor: readonly number[],
  slots: readonly HourSlot[],
  person: Person,
  home: Home,
  scenario: ScenarioName = "central",
): DoseResult {
  if (outdoor.length !== 24 || slots.length !== 24) {
    throw new RangeError("computeDose expects exactly 24 hourly values and 24 hourly slots");
  }
  if (outdoor.some((c) => !Number.isFinite(c) || c < 0)) {
    throw new RangeError("Outdoor PM2.5 values must be finite and non-negative");
  }

  const s = SCENARIOS.value[scenario];
  const penetration = Math.min(1, PENETRATION.value * s.penetration);
  const volume = Math.max(home.roomVolumeM3, 5);
  const deposition = DEPOSITION_PER_H.value;

  const homeStep = (hour: number) => {
    const slot = slots[hour];
    const open = slot?.place === "home" && slot.windowsOpen === true;
    const ach = open ? HOME_ACH.value.open : HOME_ACH.value[home.windows] * s.ach;
    const pen = open ? 1 : penetration;
    const q = slot?.purifier ? (home.purifierCadr * PURIFIER_DERATE.value * s.purifier) / volume : 0;
    const decay = ach + deposition + q;
    return { decay, css: (ach * pen * at(outdoor, hour)) / decay };
  };

  let cin = homeStep(0).css;
  const perHour: number[] = [];

  for (let h = 0; h < 24; h++) {
    const slot = slots[h];
    if (!slot) throw new RangeError(`Missing slot for hour ${h}`);
    const cout = at(outdoor, h);
    const { decay, css } = homeStep(h);
    const decayed = Math.exp(-decay);
    const meanIn = css + ((cin - css) * (1 - decayed)) / decay;
    cin = css + (cin - css) * decayed;

    let exposure: number;
    switch (slot.place) {
      case "home":
        exposure = meanIn;
        break;
      case "outdoor":
        exposure = cout;
        break;
      case "commute":
        exposure = cout * COMMUTE_EXPOSURE_FACTOR.value[slot.commuteMode ?? "walk"];
        break;
      case "indoor_other": {
        const ach = OTHER_INDOOR_ACH.value * s.ach;
        exposure = ((ach * penetration) / (ach + deposition)) * cout;
        break;
      }
    }

    const breathing = BREATHING_M3_PER_H.value[slot.activity] * AGE_BREATHING_SCALE.value[person.ageBand];
    const maskable = slot.place === "outdoor" || slot.place === "commute";
    const maskFactor = slot.mask && maskable ? 1 - Math.min(0.95, MASK_EFFECTIVENESS.value * s.mask) : 1;
    perHour.push(exposure * breathing * maskFactor);
  }

  return { totalUg: perHour.reduce((sum, v) => sum + v, 0), perHourUg: perHour };
}
