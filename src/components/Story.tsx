"use client";

import { useEffect, useRef, useState } from "react";
import { STORY_SKY } from "./airTheme";
import type { StringKey, Translate } from "./i18n";

const SCALE_MAX = 300;
const STAGES: Array<{ until: number; title: StringKey; body: StringKey }> = [
  { until: 40, title: "storyCleanTitle", body: "storyCleanBody" },
  { until: 150, title: "storyStdTitle", body: "storyStdBody" },
  { until: Infinity, title: "storySevereTitle", body: "storySevereBody" },
];

/** Scroll progress (0..1) to PM2.5: WHO's 15, India's 60, then past CPCB "Severe". */
function pmAt(p: number): number {
  if (p < 0.12) return 15;
  if (p < 0.45) return 15 + ((p - 0.12) / 0.33) * 45;
  if (p < 0.88) return 60 + ((p - 0.45) / 0.43) * 240;
  return 300;
}

/**
 * One pinned scene: while it is on screen, scrolling drives a single PM2.5 figure from clean air
 * to severe smog, a marker along the CPCB colour scale, and (through the data-sky anchors) the sky.
 * The animated figure is aria-hidden; the three facts are also given as plain text for screen readers.
 */
export function Story({ t }: { t: Translate }) {
  const sectionRef = useRef<HTMLElement>(null);
  const numRef = useRef<HTMLSpanElement>(null);
  const dotRef = useRef<HTMLSpanElement>(null);
  const [stage, setStage] = useState(0);

  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const el = sectionRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, -r.top / Math.max(1, r.height - window.innerHeight)));
      const pm = pmAt(p);
      if (numRef.current) numRef.current.textContent = pm >= 300 ? "250+" : String(Math.round(pm));
      if (dotRef.current) dotRef.current.style.left = `${(Math.min(pm, SCALE_MAX) / SCALE_MAX) * 100}%`;
      setStage(STAGES.findIndex((s) => pm < s.until));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  const current = STAGES[stage] ?? STAGES[0]!;

  return (
    <>
      <section className="meter" ref={sectionRef} aria-labelledby="meter-title">
        {/* Invisible anchors: the sky interpolates between these as the scene scrolls. */}
        <span id="story-clean" className="meter-anchor" style={{ top: "8%" }} data-sky={STORY_SKY.clean} />
        <span id="story-standard" className="meter-anchor" style={{ top: "45%" }} data-sky={STORY_SKY.standard} />
        <span id="story-severe" className="meter-anchor" style={{ top: "86%" }} data-sky={STORY_SKY.severe} />

        <div className="meter-sticky">
          <h2 id="meter-title" className="sr-only">
            {t("scrollHint")}
          </h2>
          <ul className="sr-only">
            {STAGES.map((s) => (
              <li key={s.title}>
                {t(s.title)}: {t(s.body)}
              </li>
            ))}
          </ul>
          <div aria-hidden="true" className="meter-scene">
            <p className="meter-num">
              <span ref={numRef}>15</span>
              <span className="unit">µg/m³</span>
            </p>
            <p className="meter-label" key={`l${stage}`}>
              {t(current.title)}
            </p>
            <div className="meter-scale">
              <span ref={dotRef} className="meter-dot" />
              <i style={{ left: `${(15 / SCALE_MAX) * 100}%` }}>15 WHO</i>
              <i style={{ left: `${(60 / SCALE_MAX) * 100}%` }}>60 India</i>
              <i style={{ left: `${(250 / SCALE_MAX) * 100}%` }}>250 Severe</i>
            </div>
            <p className="meter-body" key={`b${stage}`}>
              {t(current.body)}
            </p>
          </div>
        </div>
      </section>

      <section className="story-step story-home" data-sky={STORY_SKY.home} aria-labelledby="story-home">
        <div>
          <h2 id="story-home" className="story-statement">
            {t("storyHomeTitle")}
          </h2>
          <p className="story-body">{t("storyHomeBody")}</p>
        </div>
      </section>
    </>
  );
}
