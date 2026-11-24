"use client";

import { useEffect, useRef, useState } from "react";

/**
 * A full-page sky rendered on the GPU: sun, clouds, distant skyline, smog banks and drifting dust.
 *
 * It has no props. Any element on the page can declare the sky it wants with
 * `data-sky="sun,haze,cloud"` (each 0..1). The sky follows whichever of those elements sits
 * at the middle of the viewport, interpolating between neighbours as the user scrolls, and
 * eases toward that target so changes feel like weather rather than a cut.
 *
 * Decorative only (aria-hidden). Falls back to a CSS gradient without WebGL, pauses when the
 * tab is hidden, and with reduced motion freezes the clouds and jumps straight to each state.
 */

const VERT = `attribute vec2 a; void main(){ gl_Position = vec4(a, 0.0, 1.0); }`;

const FRAG = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 uRes;
uniform float uTime;
uniform float uSun;
uniform float uHaze;
uniform float uCloud;

float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); f = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm3(vec2 p) {
  float v = 0.0; float a = 0.5; mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 3; i++) { v += a * noise(p); p = m * p; a *= 0.5; }
  return v;
}
float fbm(vec2 p) {
  float v = 0.0; float a = 0.5; mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 5; i++) { v += a * noise(p); p = m * p; a *= 0.5; }
  return v;
}

void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  float aspect = uRes.x / uRes.y;
  vec2 p = vec2((uv.x - 0.5) * aspect, uv.y);
  float haze = clamp(uHaze, 0.0, 1.0);
  float day = smoothstep(0.0, 0.42, uSun);

  // Sky: Rayleigh-blue by day, warm at sunrise, brown-grey as smog builds.
  vec3 zenith = mix(vec3(0.07, 0.11, 0.26), vec3(0.08, 0.25, 0.55), day);
  vec3 horizon = mix(vec3(0.96, 0.52, 0.30), vec3(0.47, 0.67, 0.86), day);
  zenith = mix(zenith, vec3(0.24, 0.21, 0.19), haze * 0.85);
  horizon = mix(horizon, vec3(0.60, 0.47, 0.35), haze * 0.92);
  vec3 col = mix(horizon, zenith, pow(clamp(uv.y, 0.0, 1.0), 0.6));

  // Sun: extinction reddens and dims it in smog; forward scattering widens the glow.
  vec2 sunPos = vec2(0.34 * aspect, mix(0.08, 0.74, uSun));
  float d = length(p - sunPos);
  vec3 sunCol = mix(vec3(1.0, 0.94, 0.80), vec3(1.0, 0.40, 0.16), clamp(haze * 1.05 + (1.0 - day) * 0.45, 0.0, 1.0));
  col += sunCol * exp(-d * mix(5.5, 2.4, haze)) * mix(0.50, 0.32, haze);
  col += sunCol * exp(-d * d * mix(16.0, 5.0, haze)) * 0.35;
  // Clouds: domain-warped fbm drifting slowly. Thin edges catch the sun, thick cores sit in shadow.
  vec2 cp = p * vec2(1.0, 1.9) + vec2(uTime * 0.010, 0.0);
  float warp = fbm3(cp * 1.4 + vec2(uTime * 0.003, 0.0));
  float n = fbm(cp * 2.6 + warp * 1.2);
  float cover = mix(0.54, 0.36, uCloud);
  float cloud = smoothstep(cover, cover + 0.28, n) * smoothstep(0.30, 0.62, uv.y);
  float thick = smoothstep(cover, cover + 0.5, n);
  float lit = clamp(1.0 - d * 0.55, 0.15, 1.0);
  vec3 cloudCol = mix(vec3(0.88, 0.90, 0.95) * mix(0.72, 1.0, day), sunCol, 0.28 * lit);
  cloudCol *= mix(1.08, 0.74, thick * 0.85);
  cloudCol += sunCol * 0.22 * (1.0 - thick) * lit;
  cloudCol *= mix(0.92, 1.04, noise(cp * 3.0 + 3.1));
  cloudCol = mix(cloudCol, vec3(0.52, 0.45, 0.39), haze * 0.75);
  col = mix(col, cloudCol, cloud * mix(0.92, 0.40, haze));

  // A low, two-layer skyline with atmospheric perspective; smog swallows the far layer first.
  float fx = floor(uv.x * 118.0 + 17.0);
  float fh = 0.028 + hash(vec2(fx, 11.0)) * 0.03 + step(0.9, hash(vec2(fx, 5.0))) * 0.028;
  float farCity = 1.0 - smoothstep(fh - 0.0015, fh + 0.0015, uv.y);
  col = mix(col, mix(horizon * 0.72 + vec3(0.02), horizon * 0.92, haze), farCity * 0.6 * (1.0 - haze * 0.9));
  float nx = floor(uv.x * 74.0);
  float nh = 0.014 + hash(vec2(nx, 3.0)) * 0.026 + step(0.91, hash(vec2(nx, 7.0))) * 0.034;
  float nearCity = 1.0 - smoothstep(nh - 0.0015, nh + 0.0015, uv.y);
  vec3 nearCol = mix(vec3(0.04, 0.05, 0.08) + horizon * 0.22, horizon * 0.8, haze * 0.85);
  col = mix(col, nearCol, nearCity * (1.0 - haze * 0.55));

  // Smog banks: low, drifting, densest near the ground.
  float banks = fbm3(vec2(p.x * 1.2 - uTime * 0.012, uv.y * 3.6 + uTime * 0.004));
  float density = haze * ((1.0 - smoothstep(0.0, 0.85, uv.y)) * 0.8 + 0.2) * (0.55 + 0.65 * banks);
  vec3 smog = mix(vec3(0.66, 0.56, 0.45), sunCol * 0.85, 0.22 * exp(-d * 2.0));
  col = mix(col, smog, clamp(density, 0.0, 0.9));

  // The sun disc seen through the smog in front of it: dimmer and redder, but never darker than the sky around it.
  float disc = 1.0 - smoothstep(0.042, 0.050, d);
  vec3 discCol = max(sunCol * mix(1.55, 1.1, haze), col * 1.12);
  col = mix(col, discCol, disc * mix(1.0, 0.75, haze));

  // Dust: sparse particles drifting sideways, more of them in worse air.
  vec2 cell = (gl_FragCoord.xy + vec2(-uTime * 18.0, sin(uTime * 0.4) * 4.0)) / 22.0;
  vec2 id = floor(cell);
  vec2 dp = vec2(hash(id + 1.3), hash(id + 2.7));
  float present = step(1.0 - haze * 0.32 - 0.03, hash(id));
  float dust = (1.0 - smoothstep(0.0, 0.10, length(fract(cell) - dp))) * present;
  col = mix(col, mix(vec3(1.0), vec3(0.28, 0.22, 0.17), haze), dust * mix(0.25, 0.45, haze));

  // Darken the top for legible white text, light vignette, fine grain against banding.
  col *= mix(0.70, 1.0, (1.0 - smoothstep(0.50, 1.0, uv.y)));
  col *= 0.90 + 0.10 * (1.0 - smoothstep(0.25, 1.25, length(uv - vec2(0.5, 0.45))));
  col += (hash(gl_FragCoord.xy + fract(uTime)) - 0.5) * 0.018;
  gl_FragColor = vec4(col, 1.0);
}
`;

interface SkyState {
  sun: number;
  haze: number;
  cloud: number;
}

const DEFAULT: SkyState = { sun: 0.05, haze: 0.05, cloud: 0.35 };

function parseSky(value: string | null): SkyState | null {
  if (!value) return null;
  const [sun, haze, cloud] = value.split(",").map(Number);
  if (![sun, haze, cloud].every((v) => Number.isFinite(v))) return null;
  return { sun: sun as number, haze: haze as number, cloud: cloud as number };
}

/** The sky the page asks for at the current scroll position. */
export function readScrollSky(): SkyState {
  const mid = window.innerHeight * 0.5;
  const anchors = Array.from(document.querySelectorAll<HTMLElement>("[data-sky]"))
    .map((el) => {
      const r = el.getBoundingClientRect();
      return { y: r.top + Math.min(r.height, window.innerHeight) * 0.5, sky: parseSky(el.getAttribute("data-sky")) };
    })
    .filter((a): a is { y: number; sky: SkyState } => a.sky !== null && Number.isFinite(a.y))
    .sort((a, b) => a.y - b.y);
  if (anchors.length === 0) return DEFAULT;
  const first = anchors[0];
  const last = anchors[anchors.length - 1];
  if (!first || !last) return DEFAULT;
  if (mid <= first.y) return first.sky;
  if (mid >= last.y) return last.sky;
  for (let i = 0; i < anchors.length - 1; i++) {
    const a = anchors[i];
    const b = anchors[i + 1];
    if (a && b && mid >= a.y && mid <= b.y) {
      const raw = b.y === a.y ? 0 : (mid - a.y) / (b.y - a.y);
      const t = raw * raw * (3 - 2 * raw);
      return { sun: a.sky.sun + (b.sky.sun - a.sky.sun) * t, haze: a.sky.haze + (b.sky.haze - a.sky.haze) * t, cloud: a.sky.cloud + (b.sky.cloud - a.sky.cloud) * t };
    }
  }
  return last.sky;
}

function compile(gl: WebGLRenderingContext, type: number, src: string): WebGLShader | null {
  const s = gl.createShader(type);
  if (!s) return null;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (gl.getShaderParameter(s, gl.COMPILE_STATUS)) return s;
  console.warn("Sky shader failed to compile; using the CSS sky.", gl.getShaderInfoLog(s));
  return null;
}

export function Sky() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fallbackRef = useRef<HTMLDivElement>(null);
  const [webgl, setWebgl] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl", { antialias: false, alpha: false, preserveDrawingBuffer: false, powerPreference: "low-power" });
    const vs = gl && compile(gl, gl.VERTEX_SHADER, VERT);
    const fs = gl && compile(gl, gl.FRAGMENT_SHADER, FRAG);
    const program = gl && vs && fs ? gl.createProgram() : null;
    if (!gl || !vs || !fs || !program) {
      setWebgl(false);
      return;
    }
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      setWebgl(false);
      return;
    }
    gl.useProgram(program);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(program, "a");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const u = {
      res: gl.getUniformLocation(program, "uRes"),
      time: gl.getUniformLocation(program, "uTime"),
      sun: gl.getUniformLocation(program, "uSun"),
      haze: gl.getUniformLocation(program, "uHaze"),
      cloud: gl.getUniformLocation(program, "uCloud"),
    };

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const current: SkyState = { ...readScrollSky() };
    let raf = 0;
    let last = performance.now();
    let clock = 0;
    // Adaptive quality: slow frames first lower the resolution, then freeze the drift so a weak
    // device (or software rendering) only redraws when the air actually changes.
    let quality = 0.55;
    let slowFrames = 0;
    let frozen = false;
    const drawn = { sun: -1, haze: -1, cloud: -1 };

    // The sky is soft, so rendering below screen resolution and letting CSS scale it costs nothing visually.
    const resize = () => {
      const scale = Math.min(window.devicePixelRatio || 1, 1.5) * quality;
      canvas.width = Math.max(2, Math.round(Math.min(window.innerWidth, 1600) * scale));
      canvas.height = Math.max(2, Math.round(window.innerHeight * scale * (Math.min(window.innerWidth, 1600) / window.innerWidth)));
      gl.viewport(0, 0, canvas.width, canvas.height);
    };

    const draw = () => {
      gl.uniform2f(u.res, canvas.width, canvas.height);
      gl.uniform1f(u.time, clock);
      gl.uniform1f(u.sun, current.sun);
      gl.uniform1f(u.haze, current.haze);
      gl.uniform1f(u.cloud, current.cloud);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      Object.assign(drawn, current);
      canvas.dataset.haze = current.haze.toFixed(2);
    };

    const frame = (now: number) => {
      const elapsed = now - last;
      const dt = Math.min(0.1, elapsed / 1000);
      last = now;
      if (!frozen) {
        slowFrames = elapsed > 45 ? slowFrames + 1 : Math.max(0, slowFrames - 1);
        if (slowFrames > 8) {
          slowFrames = 0;
          if (quality > 0.3) {
            quality = 0.3;
            resize();
          } else {
            frozen = true;
            canvas.dataset.quality = "still";
          }
        }
        clock += dt;
      }
      const target = readScrollSky();
      const k = 1 - Math.exp(-dt * 2.4);
      current.sun += (target.sun - current.sun) * k;
      current.haze += (target.haze - current.haze) * k;
      current.cloud += (target.cloud - current.cloud) * k;
      const changed = Math.abs(current.haze - drawn.haze) + Math.abs(current.sun - drawn.sun) + Math.abs(current.cloud - drawn.cloud) > 0.004;
      if (!frozen || changed) draw();
      raf = requestAnimationFrame(frame);
    };

    const still = () => {
      Object.assign(current, readScrollSky());
      draw();
    };

    const start = () => {
      cancelAnimationFrame(raf);
      if (document.hidden) return;
      if (reduced.matches) {
        still();
        return;
      }
      last = performance.now();
      raf = requestAnimationFrame(frame);
    };

    const onScroll = () => {
      if (reduced.matches) still();
    };

    resize();
    draw();
    start();
    window.addEventListener("resize", resize);
    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("visibilitychange", start);
    reduced.addEventListener("change", start);
    // Results and the simulator change data-sky without scrolling: watch for that too.
    const observer = new MutationObserver(() => {
      if (reduced.matches) still();
    });
    observer.observe(document.body, { subtree: true, attributes: true, attributeFilter: ["data-sky"], childList: true });

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      window.removeEventListener("resize", resize);
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("visibilitychange", start);
      reduced.removeEventListener("change", start);
   };
  }, []);

  // CSS fallback: a gradient whose haze follows the same scroll anchors.
  useEffect(() => {
    if (webgl) return;
    const el = fallbackRef.current;
    if (!el) return;
    const update = () => el.style.setProperty("--haze", readScrollSky().haze.toFixed(3));
    update();
    window.addEventListener("scroll", update, { passive: true });
    const observer = new MutationObserver(update);
    observer.observe(document.body, { subtree: true, attributes: true, attributeFilter: ["data-sky"], childList: true });
    return () => {
      window.removeEventListener("scroll", update);
      observer.disconnect();
    };
  }, [webgl]);

  return (
    <div className="sky" aria-hidden="true">
      {webgl ? <canvas ref={canvasRef} className="sky-canvas" /> : <div ref={fallbackRef} className="sky-fallback" />}
    </div>
  );
}
