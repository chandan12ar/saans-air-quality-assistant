import { CPCB_PM25_BANDS } from "./constants";

export type NaqiBand = (typeof CPCB_PM25_BANDS.value)[number]["band"];

export interface AqiReading {
  band: NaqiBand;
  /** CPCB-style 0-500 sub-index estimated from PM2.5 alone. */
  subIndex: number;
}

/**
 * Maps a PM2.5 concentration (µg/m³) to a CPCB-style band and sub-index.
 * This is an estimate from model output, not an official station AQI.
 */
export function pm25ToAqi(concentration: number): AqiReading {
  if (!Number.isFinite(concentration) || concentration < 0) {
    throw new RangeError(`Invalid PM2.5 concentration: ${concentration}`);
  }
  const bands = CPCB_PM25_BANDS.value;
  let lower = 0;
  for (const b of bands) {
    if (concentration <= b.cMax) {
      const span = b.cMax - lower;
      const frac = span === 0 ? 0 : (concentration - lower) / span;
      return { band: b.band, subIndex: Math.round(b.iLow + frac * (b.iHigh - b.iLow)) };
    }
    lower = b.cMax;
  }
  return { band: "severe", subIndex: 500 };
}

const ORDER: NaqiBand[] = ["good", "satisfactory", "moderate", "poor", "very_poor", "severe"];

/** True when `band` is at least as bad as `threshold`. */
export function bandAtLeast(band: NaqiBand, threshold: NaqiBand): boolean {
  return ORDER.indexOf(band) >= ORDER.indexOf(threshold);
}
