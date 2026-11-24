import { pm25ToAqi, type NaqiBand } from "@/engine";

/** The page theme: the six CPCB bands, plus "idle" before any plan exists. */
export type AirState = NaqiBand | "idle";

/** Mean PM2.5 of the day decides the theme; the peak is shown as text. */
export function airStateFor(hourly: readonly number[]): { air: NaqiBand; mean: number; peak: number; peakHour: number } {
  const mean = hourly.reduce((a, b) => a + b, 0) / Math.max(1, hourly.length);
  const peak = Math.max(...hourly);
  return { air: pm25ToAqi(mean).band, mean, peak, peakHour: hourly.indexOf(peak) };
}

/** How much smog the sky shows for a PM2.5 level: none at the WHO guideline, full at "Severe". */
export function hazeForPm25(pm25: number): number {
  const t = Math.min(1, Math.max(0, (pm25 - 12) / 250));
  return Math.round(Math.pow(t, 0.75) * 100) / 100;
}

/** `data-sky` value: sun elevation, haze, cloud cover (each 0..1). */
export const sky = (sun: number, haze: number, cloud: number) => `${sun},${haze},${cloud}`;

/** The story's sky at each step: sunrise, clean day, haze at India's standard, severe smog, then the planner. */
export const STORY_SKY = {
  hero: sky(0.04, 0.04, 0.55),
  clean: sky(0.5, 0, 0.6),
  standard: sky(0.46, hazeForPm25(60), 0.5),
  severe: sky(0.3, 1, 0.2),
  home: sky(0.38, 0.45, 0.3),
};

/** Official CPCB AQI colours, used for the band dots and the AQI scale. */
export const BAND_COLOR: Record<NaqiBand, string> = {
  good: "#00b050",
  satisfactory: "#92d050",
  moderate: "#ffff00",
  poor: "#ff9900",
  very_poor: "#ff0000",
  severe: "#c00000",
};
