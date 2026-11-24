import type { NaqiBand } from "@/engine";

export type Language = "en" | "hi";

export const BAND_LABEL: Record<Language, Record<NaqiBand, string>> = {
  en: {
    good: "Good",
    satisfactory: "Satisfactory",
    moderate: "Moderate",
    poor: "Poor",
    very_poor: "Very poor",
    severe: "Severe",
  },
  hi: {
    good: "अच्छा",
    satisfactory: "संतोषजनक",
    moderate: "मध्यम",
    poor: "खराब",
    very_poor: "बहुत खराब",
    severe: "गंभीर",
  },
};

/** Shape glyph per band so colour is never the only signal. */
export const BAND_ICON: Record<NaqiBand, string> = {
  good: "●",
  satisfactory: "◆",
  moderate: "▲",
  poor: "■",
  very_poor: "⬢",
  severe: "✖",
};
