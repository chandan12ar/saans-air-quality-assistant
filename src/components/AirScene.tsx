"use client";

import { useMemo } from "react";
import { particleColor, particleCount, type AirState } from "./airTheme";
import { SmogCanvas } from "./SmogCanvas";

interface Building {
  x: number;
  w: number;
  h: number;
  dome: boolean;
}

/** Deterministic pseudo-random skyline so server and client markup match. */
function skyline(seed: number, minH: number, maxH: number): Building[] {
  let s = seed;
  const rand = () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
  const out: Building[] = [];
  let x = -10;
  while (x < 610) {
    const w = 16 + Math.floor(rand() * 26);
    out.push({ x, w, h: minH + Math.floor(rand() * (maxH - minH)), dome: rand() > 0.82 });
    x += w + Math.floor(rand() * 4);
  }
  return out;
}

function Skyline({ className, buildings }: { className: string; buildings: Building[] }) {
  return (
    <svg className={`skyline ${className}`} viewBox="0 0 600 140" preserveAspectRatio="none" focusable="false">
      {buildings.map((b, i) => (
        <g key={i}>
          <rect x={b.x} y={140 - b.h} width={b.w} height={b.h} />
          {b.dome && <path d={`M${b.x + 2} ${140 - b.h} a${(b.w - 4) / 2} ${(b.w - 4) / 2} 0 0 1 ${b.w - 4} 0z`} />}
        </g>
      ))}
    </svg>
  );
}

function Cloud({ className }: { className: string }) {
  return (
    <svg className={`cloud ${className}`} viewBox="0 0 200 84" focusable="false">
      <path d="M34 76c-18 0-30-10-30-24 0-13 10-23 24-25 4-15 18-25 34-25 14 0 26 7 31 18 4-3 10-5 16-5 15 0 27 11 28 25 17 1 30 12 30 25 0 9-6 11-14 11z" />
    </svg>
  );
}

interface Props {
  air: AirState;
  pm25: number | null;
  busy: boolean;
  title: string;
  detail: string;
}

/**
 * The hero: a window onto the user's sky. Everything here is decorative and driven by CSS variables
 * set from the air quality (see globals.css, [data-air]); the readout text carries the information.
 */
export function AirScene({ air, pm25, busy, title, detail }: Props) {
  const far = useMemo(() => skyline(7, 30, 78), []);
  const near = useMemo(() => skyline(23, 18, 56), []);

  return (
    <div className="window">
      <div className="glass" aria-hidden="true">
        <div className="sky" />
        <div className="sun">
          <span />
        </div>
        <Cloud className="c1" />
        <Cloud className="c2" />
        <Cloud className="c3" />
        <Cloud className="c4" />
        <Skyline className="far" buildings={far} />
        <Skyline className="near" buildings={near} />
        <div className="haze h1" />
        <div className="haze h2" />
        <div className="haze h3" />
        <SmogCanvas count={particleCount(pm25)} fast={busy} color={particleColor(air)} />
        <div className="shine" />
      </div>
      <div className="frame" aria-hidden="true" />
      <div className="sill" aria-hidden="true" />
      <div className="seep" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </div>
      <p className="readout">
        <span>{title}</span>
        <strong>{detail}</strong>
      </p>
    </div>
  );
}
