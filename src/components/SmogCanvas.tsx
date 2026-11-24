"use client";

import { useEffect, useRef } from "react";

interface Particle {
  x: number;
  y: number;
  r: number;
  vx: number;
  vy: number;
  a: number;
  phase: number;
}

interface Props {
  /** Target number of particles on screen. */
  count: number;
  /** Faster drift while a plan is being fetched. */
  fast: boolean;
  /** "r, g, b" */
  color: string;
}

const spawn = (w: number, h: number, anywhere: boolean): Particle => ({
  x: anywhere ? Math.random() * w : w + Math.random() * 40,
  y: Math.random() * h,
  r: 0.6 + Math.random() * 1.9,
  vx: -(0.18 + Math.random() * 0.55),
  vy: (Math.random() - 0.5) * 0.12,
  a: 0.18 + Math.random() * 0.4,
  phase: Math.random() * Math.PI * 2,
});

/**
 * Dust and soot drifting across the window. Decorative only: it pauses when off-screen or when the tab
 * is hidden, and draws a single still frame when the user prefers reduced motion.
 */
export function SmogCanvas({ count, fast, color }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const live = useRef({ count, fast, color });

  useEffect(() => {
    live.current = { count, fast, color };
  }, [count, fast, color]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let w = 0;
    let h = 0;
    let raf = 0;
    let visible = true;
    const particles: Particle[] = [];

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const draw = (t: number) => {
      const { count: target, fast: quick, color: rgb } = live.current;
      while (particles.length < target) particles.push(spawn(w, h, particles.length < target / 2 || reduced.matches));
      if (particles.length > target) particles.length = target;

      ctx.clearRect(0, 0, w, h);
      const speed = quick ? 3.2 : 1;
      for (const p of particles) {
        if (!reduced.matches) {
          p.x += p.vx * speed;
          p.y += p.vy + Math.sin(t / 1400 + p.phase) * 0.12;
          if (p.x < -6 || p.y < -6 || p.y > h + 6) Object.assign(p, spawn(w, h, false));
        }
        ctx.fillStyle = `rgba(${rgb}, ${p.a})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const loop = (t: number) => {
      draw(t);
      raf = requestAnimationFrame(loop);
    };
    const start = () => {
      cancelAnimationFrame(raf);
      if (reduced.matches) draw(0);
      else if (visible && !document.hidden) raf = requestAnimationFrame(loop);
    };

    resize();
    start();

    const resizeObserver = new ResizeObserver(() => {
      resize();
      if (reduced.matches) draw(0);
    });
    resizeObserver.observe(canvas);
    const visibility = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? true;
      start();
    });
    visibility.observe(canvas);
    document.addEventListener("visibilitychange", start);
    reduced.addEventListener("change", start);

    return () => {
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      visibility.disconnect();
      document.removeEventListener("visibilitychange", start);
      reduced.removeEventListener("change", start);
    };
  }, []);

  // A still frame is enough for reduced motion, but a count change must still be visible.
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      window.dispatchEvent(new Event("resize"));
    }
  }, [count]);

  return <canvas ref={canvasRef} className="smog-canvas" />;
}
