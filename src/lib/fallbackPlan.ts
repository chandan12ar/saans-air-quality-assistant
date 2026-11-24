import { pm25ToAqi, type ActionId, type Ledger } from "@/engine";
import { BAND_LABEL, type Language } from "./labels";
import type { AiPlan } from "./schemas";

interface ActionText {
  title: string;
  how: string;
}

const TEXT: Record<Language, Record<ActionId, ActionText>> = {
  en: {
    shift_outdoor: { title: "Shift outdoor time to the cleaner hours", how: "Do walks, play or exercise when the air is cleanest, not at the peak." },
    close_windows: { title: "Keep windows closed when the air is bad", how: "Closing windows during polluted hours keeps outdoor smoke and dust out of the home." },
    run_purifier: { title: "Run your purifier while you are home", how: "Keep windows closed and run it in the room where you spend most time." },
    diy_filter: { title: "Build a DIY box-fan air filter", how: "Strap a MERV-13 filter to a box fan and run it in the main room. A low-cost purifier substitute." },
    mask_unavoidable: { title: "Wear a fitted N95/FFP2 mask if you must be outside", how: "A well-fitted respirator helps most during unavoidable outdoor hours." },
    swap_commute: { title: "Switch the commute to metro or bus", how: "Public transport cuts emissions compared with a private vehicle." },
  },
  hi: {
    shift_outdoor: { title: "बाहर का समय साफ़ घंटों में ले जाएँ", how: "सैर, खेल या व्यायाम उस समय करें जब हवा सबसे साफ़ हो।" },
    close_windows: { title: "प्रदूषण के घंटों में खिड़कियाँ बंद रखें", how: "जब बाहर की हवा खराब हो, खिड़कियाँ बंद रखने से घर में धुआँ और धूल कम आती है।" },
    run_purifier: { title: "घर पर रहते समय प्यूरीफ़ायर चलाएँ", how: "खिड़कियाँ बंद रखकर उस कमरे में चलाएँ जहाँ आप सबसे ज़्यादा समय रहते हैं।" },
    diy_filter: { title: "बॉक्स-फ़ैन एयर फ़िल्टर बनाएँ", how: "एक पंखे पर MERV-13 फ़िल्टर बाँधकर मुख्य कमरे में चलाएँ। यह सस्ता विकल्प है।" },
    mask_unavoidable: { title: "बाहर जाना ज़रूरी हो तो N95 मास्क पहनें", how: "सही फ़िट वाला N95/FFP2 मास्क खराब हवा में बाहर बिताए घंटों में मदद करता है।" },
    swap_commute: { title: "मेट्रो या बस से आना-जाना", how: "निजी वाहन की जगह सार्वजनिक परिवहन से उत्सर्जन कम होता है।" },
  },
};

const STRINGS = {
  en: {
    cleanSummary: (place: string) => `Air quality in ${place} looks acceptable on this day, so no special precautions are needed. Keep your normal routine.`,
    summary: (place: string, band: string, hour: number) =>
      `Air in ${place} reaches the "${band}" band around ${String(hour).padStart(2, "0")}:00. This plan comes from the exposure engine, not an AI model, and lists the changes that cut household exposure the most.`,
    peak: "Stay indoors with windows closed",
    peakWhy: "This is the most polluted hour of the day.",
    best: "Best hour for outdoor activity",
    bestWhy: "This is the cleanest daytime hour.",
    caveats: [
      "The AI assistant was unavailable, so this plan is rule-based and not personalised in wording.",
      "Estimates from modelled data, not medical advice. If anyone has trouble breathing, seek medical care.",
    ],
  },
  hi: {
    cleanSummary: (place: string) => `${place} में इस दिन हवा ठीक-ठाक है, इसलिए विशेष सावधानी की ज़रूरत नहीं। अपनी सामान्य दिनचर्या जारी रखें।`,
    summary: (place: string, band: string, hour: number) =>
      `${place} में हवा लगभग ${String(hour).padStart(2, "0")}:00 बजे "${band}" श्रेणी में पहुँचती है। यह योजना एक्सपोज़र इंजन से बनी है, AI मॉडल से नहीं।`,
    peak: "घर के अंदर रहें, खिड़कियाँ बंद रखें",
    peakWhy: "यह दिन का सबसे प्रदूषित घंटा है।",
    best: "बाहर की गतिविधि के लिए सबसे अच्छा समय",
    bestWhy: "यह दिन का सबसे साफ़ घंटा है।",
    caveats: [
      "AI सहायक उपलब्ध नहीं था, इसलिए यह नियम-आधारित योजना है।",
      "यह मॉडल के अनुमान हैं, चिकित्सीय सलाह नहीं। साँस लेने में दिक्कत हो तो डॉक्टर से मिलें।",
    ],
  },
} as const;

const TIMELINE_ACTIONS: ActionId[] = ["shift_outdoor", "mask_unavoidable", "swap_commute"];
const INDOOR_ACTIONS: ActionId[] = ["close_windows", "run_purifier", "diy_filter"];

function argExtreme(values: readonly number[], from: number, to: number, pick: "min" | "max"): number {
  let best = from;
  for (let h = from; h <= to; h++) {
    const v = values[h] ?? 0;
    const b = values[best] ?? 0;
    if (pick === "min" ? v < b : v > b) best = h;
  }
  return best;
}

/**
 * Deterministic plan used when Gemini is unavailable or its output fails validation.
 * Built only from the ledger, so it can never contain invented figures.
 */
export function buildFallbackPlan(args: {
  ledger: Ledger;
  hourly: readonly number[];
  language: Language;
  placeLabel: string;
}): AiPlan {
  const { ledger, hourly, language, placeLabel } = args;
  const t = STRINGS[language];
  const place = placeLabel.slice(0, 60);
  const peakHour = argExtreme(hourly, 0, 23, "max");
  const bestHour = argExtreme(hourly, 6, 19, "min");
  const band = BAND_LABEL[language][pm25ToAqi(hourly[peakHour] ?? 0).band];

  const applicable = ledger.actions.filter((a) => a.applied);
  const has = (id: ActionId) => applicable.some((a) => a.id === id);

  if (ledger.nothingToDo) {
    return {
      summary: t.cleanSummary(place),
      timeline: [{ hour: bestHour, title: t.best, why: t.bestWhy }],
      indoorHacks: [],
      sustainableSwaps: [],
      questions: [],
      caveats: [...t.caveats],
    };
  }

  const timeline: AiPlan["timeline"] = [];
  timeline.push({ hour: bestHour, title: t.best, why: t.bestWhy, ...(has("shift_outdoor") ? { actionId: "shift_outdoor" as const } : {}) });
  timeline.push({ hour: peakHour, title: t.peak, why: t.peakWhy, ...(has("close_windows") ? { actionId: "close_windows" as const } : {}) });
  for (const id of TIMELINE_ACTIONS.filter((a) => a !== "shift_outdoor" && has(a))) {
    timeline.push({ hour: id === "swap_commute" ? 8 : peakHour, title: TEXT[language][id].title, why: TEXT[language][id].how, actionId: id });
  }

  return {
    summary: t.summary(place, band, peakHour),
    timeline: timeline.slice(0, 10),
    indoorHacks: INDOOR_ACTIONS.filter(has).map((id) => ({ title: TEXT[language][id].title, how: TEXT[language][id].how, actionId: id })),
    sustainableSwaps: has("swap_commute")
      ? [{ title: TEXT[language].swap_commute.title, why: TEXT[language].swap_commute.how, actionId: "swap_commute" as const }]
      : [],
    questions: [],
    caveats: [...t.caveats],
  };
}
