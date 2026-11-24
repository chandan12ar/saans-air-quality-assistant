"use client";

import { useEffect, useRef } from "react";
import { STORY_SKY } from "./airTheme";
import type { StringKey, Translate } from "./i18n";

const STEPS: Array<{ id: string; sky: string; figure: string; unit: boolean; title: StringKey; body: StringKey }> = [
  { id: "clean", sky: STORY_SKY.clean, figure: "15", unit: true, title: "storyCleanTitle", body: "storyCleanBody" },
  { id: "standard", sky: STORY_SKY.standard, figure: "60", unit: true, title: "storyStdTitle", body: "storyStdBody" },
  { id: "severe", sky: STORY_SKY.severe, figure: "250+", unit: true, title: "storySevereTitle", body: "storySevereBody" },
];

/**
 * The scroll story. Each step declares the sky it wants (data-sky), so scrolling through it
 * takes the sky from clean blue to severe smog. Text reveals once as it enters the viewport.
 */
export function Story({ t }: { t: Translate }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const items = Array.from(root.querySelectorAll<HTMLElement>(".reveal"));
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: "0px 0px -15% 0px", threshold: 0.2 },
    );
    items.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <div className="story" ref={ref}>
      {STEPS.map((s) => (
        <section key={s.id} className="story-step" data-sky={s.sky} aria-labelledby={`story-${s.id}`}>
          <div className="reveal">
            <p className="figure">
              {s.figure}
              {s.unit && <span className="unit">µg/m³</span>}
            </p>
            <h2 id={`story-${s.id}`}>{t(s.title)}</h2>
            <p className="story-body">{t(s.body)}</p>
          </div>
        </section>
      ))}
      <section className="story-step story-home" data-sky={STORY_SKY.home} aria-labelledby="story-home">
        <div className="reveal">
          <h2 id="story-home" className="story-statement">
            {t("storyHomeTitle")}
          </h2>
          <p className="story-body">{t("storyHomeBody")}</p>
        </div>
      </section>
    </div>
  );
}
