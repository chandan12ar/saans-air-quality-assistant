import { pm25ToAqi, type NaqiBand } from "@/engine";

/** The page and hero scene theme: the six CPCB bands, plus "idle" before any plan exists. */
export type AirState = NaqiBand | "idle";

/** Mean PM2.5 of the day decides the theme; the peak is shown as text. */
export function airStateFor(hourly: readonly number[]): { air: NaqiBand; mean: number; peak: number } {
  const mean = hourly.reduce((a, b) => a + b, 0) / Math.max(1, hourly.length);
  return { air: pm25ToAqi(mean).band, mean, peak: Math.max(...hourly) };
}

/** Dust particles drawn in the scene: a few motes on a clean day, a thick drift in severe smog. */
export function particleCount(pm25: number | null): number {
  if (pm25 === null) return 14;
  return Math.round(10 + (Math.min(Math.max(pm25, 0), 400) / 400) * 170);
}

/** RGB triplet for drifting particles: bright motes in clean air, brown soot in smog. */
export function particleColor(air: AirState): string {
  return air === "good" || air === "satisfactory" || air === "idle" ? "255, 255, 255" : "92, 70, 55";
}
