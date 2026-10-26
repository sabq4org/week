"use client";

import { useEffect, useRef } from "react";
import styles from "./SilkBackground.module.css";

type SilkBackgroundProps = { paused?: boolean };

type Band = {
  center: number;
  width: number;
  color: [number, number, number];
  alpha: number;
  speed: number;
  phase: number;
  depth: number;
};

// Vertical light curtains, left to right. Petrol/teal in the body, a touch of warm light where the band is brightest.
const BANDS: Band[] = [
  { center: 0.03, width: 0.15, color: [10, 72, 122], alpha: 0.4, speed: 0.34, phase: 0.2, depth: 0.42 },
  { center: 0.13, width: 0.09, color: [22, 124, 154], alpha: 0.42, speed: 0.28, phase: 1.3, depth: 0.7 },
  { center: 0.23, width: 0.13, color: [8, 56, 106], alpha: 0.36, speed: 0.24, phase: 2.1, depth: 0.28 },
  { center: 0.34, width: 0.17, color: [30, 136, 164], alpha: 0.5, speed: 0.31, phase: 3.6, depth: 0.78 },
  { center: 0.47, width: 0.1, color: [10, 50, 100], alpha: 0.44, speed: 0.22, phase: 4.5, depth: 0.36 },
  { center: 0.58, width: 0.18, color: [40, 154, 176], alpha: 0.56, speed: 0.27, phase: 5.5, depth: 0.86 },
  { center: 0.71, width: 0.12, color: [16, 90, 134], alpha: 0.42, speed: 0.36, phase: 1.8, depth: 0.46 },
  { center: 0.83, width: 0.17, color: [34, 142, 166], alpha: 0.48, speed: 0.25, phase: 2.8, depth: 0.72 },
  { center: 0.96, width: 0.14, color: [8, 48, 96], alpha: 0.4, speed: 0.32, phase: 0.8, depth: 0.34 },
];

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export default function SilkBackground({ paused = false }: SilkBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pausedRef = useRef(paused);
  const syncRef = useRef<(() => void) | null>(null);
  pausedRef.current = paused;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: false, desynchronized: true });
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const target = { x: 0.5, y: 0.54 };
    const pointer = { ...target };
    const velocity = { x: 0, y: 0 };
    let width = 1, height = 1, raf = 0, visible = !document.hidden;
    let start = performance.now(), lastFrame = 0, fastUntil = 0;
    let rect = canvas.getBoundingClientRect();
    let base: CanvasGradient | null = null;
    let bandFills: CanvasGradient[] = [];
    let floorGlow: CanvasGradient | null = null, floorHalo: CanvasGradient | null = null;
    let topShade: CanvasGradient | null = null, vignette: CanvasGradient | null = null;
    let light: CanvasGradient | null = null, lightX = -1, lightY = -1;

    const isMobile = () => window.innerWidth <= 767;

    const buildGradients = () => {
      const mobile = isMobile();
      base = ctx.createLinearGradient(0, 0, 0, height);
      base.addColorStop(0, "#020712");
      base.addColorStop(mobile ? 0.28 : 0.42, mobile ? "#0a2444" : "#061630");
      base.addColorStop(mobile ? 0.56 : 0.78, mobile ? "#16607c" : "#0c4058");
      base.addColorStop(1, mobile ? "#9fd0d4" : "#5fa7b2");
      bandFills = BANDS.map((band) => {
        const g = ctx.createLinearGradient(0, 0, 0, height);
        const [r, gr, b] = band.color;
        g.addColorStop(0, `rgba(${r}, ${gr}, ${b}, 0.04)`);
        g.addColorStop(0.28, `rgba(${r}, ${gr}, ${b}, ${band.alpha * 0.48})`);
        g.addColorStop(0.72, `rgba(${r + 20}, ${gr + 24}, ${b + 14}, ${band.alpha})`);
        g.addColorStop(1, `rgba(214, 232, 220, ${band.alpha * 0.62})`);
        return g;
      });
      floorGlow = ctx.createLinearGradient(0, height * 0.08, 0, height);
      floorGlow.addColorStop(0, "rgba(30, 110, 140, 0)");
      floorGlow.addColorStop(0.52, "rgba(30, 110, 140, 0)");
      floorGlow.addColorStop(0.72, "rgba(150, 206, 204, 0.08)");
      floorGlow.addColorStop(0.9, "rgba(214, 220, 200, 0.26)");
      floorGlow.addColorStop(1, "rgba(240, 232, 206, 0.42)");
      floorHalo = ctx.createRadialGradient(width * 0.5, height * 1.06, 0, width * 0.5, height * 0.98, width * 0.76);
      floorHalo.addColorStop(0, "rgba(242, 220, 160, 0.3)");
      floorHalo.addColorStop(0.42, "rgba(160, 200, 196, 0.12)");
      floorHalo.addColorStop(1, "rgba(30, 110, 140, 0)");
      topShade = ctx.createLinearGradient(0, 0, 0, height * 0.58);
      topShade.addColorStop(0, "rgba(1, 4, 9, 0.82)");
      topShade.addColorStop(0.48, "rgba(2, 6, 12, 0.32)");
      topShade.addColorStop(1, "rgba(2, 6, 12, 0)");
      vignette = ctx.createRadialGradient(width * 0.5, height * 0.46, Math.min(width, height) * 0.12, width * 0.5, height * 0.5, Math.max(width, height) * 0.78);
      vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
      vignette.addColorStop(0.66, "rgba(0, 4, 9, 0.12)");
      vignette.addColorStop(1, "rgba(0, 4, 10, 0.82)");
      light = null;
    };

    const resize = () => {
      rect = canvas.getBoundingClientRect();
      const cap = isMobile() ? 0.68 : rect.width > 1100 ? 0.78 : 0.82;
      const dpr = Math.min(window.devicePixelRatio || 1, cap);
      width = Math.max(1, Math.round(rect.width * dpr));
      height = Math.max(1, Math.round(rect.height * dpr));
      // Rebuild when the backing size changes, and on the first pass even if it already matches
      // (StrictMode re-runs this effect on a canvas that keeps its previous size).
      if (canvas.width !== width || canvas.height !== height || !base) {
        canvas.width = width;
        canvas.height = height;
        ctx.imageSmoothingEnabled = true;
        buildGradients();
        if (!raf) render(performance.now(), true);
      }
    };

    const onPointerMove = (event: PointerEvent) => {
      fastUntil = performance.now() + 450;
      if (!rect.width || !rect.height) return;
      target.x = clamp((event.clientX - rect.left) / rect.width, 0, 1);
      target.y = clamp((event.clientY - rect.top) / rect.height, 0, 1);
    };
    const onPointerLeave = () => { target.x = 0.5; target.y = 0.54; };

    const curtain = (band: Band, t: number, lift: number, sway: number) => {
      const cx = (band.center + Math.sin(t * band.speed + band.phase) * 0.018 + lift * (pointer.x - 0.5) * 0.08) * width;
      const w = band.width * width * (0.94 + Math.sin(t * 0.33 + band.phase) * 0.045 + lift * 0.08);
      const dx = Math.sin(t * band.speed * 0.86 + band.phase) * sway * width + lift * (pointer.x - band.center) * width * 0.12;
      const dy = Math.sin(t * band.speed * 0.62 + band.phase + 1.7) * sway * width * 0.72 - lift * (pointer.y - 0.5) * width * 0.035;
      const topW = w * (0.78 + band.depth * 0.08), midW = w * (0.92 + lift * 0.05), botW = w * (0.72 + band.depth * 0.1);
      const topX = cx - dx * 0.28, midX = cx + dx, botX = cx + dy;
      ctx.beginPath();
      ctx.moveTo(topX - topW, -height * 0.08);
      ctx.bezierCurveTo(topX - topW * 1.04, height * 0.26, midX - midW, height * 0.55, botX - botW, height * 1.08);
      ctx.lineTo(botX + botW, height * 1.08);
      ctx.bezierCurveTo(midX + midW, height * 0.55, topX + topW * 1.04, height * 0.26, topX + topW, -height * 0.08);
      ctx.closePath();
    };

    const render = (now: number, force = false) => {
      const mobile = isMobile();
      const interval = now < fastUntil ? 1000 / (mobile ? 30 : 60) : 1000 / (mobile ? 18 : 24);
      if (!force && now - lastFrame < interval) { schedule(); return; }
      lastFrame = now;
      const t = reduced.matches ? 0 : (now - start) / 1000;

      velocity.x = (velocity.x + (target.x - pointer.x) * 0.09) * 0.76;
      velocity.y = (velocity.y + (target.y - pointer.y) * 0.09) * 0.76;
      pointer.x += velocity.x;
      pointer.y += velocity.y;
      const motion = clamp(Math.hypot(velocity.x, velocity.y) * 18, 0, 1);

      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = base ?? "#02070f";
      ctx.fillRect(0, 0, width, height);

      // Soft, wide curtains.
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      ctx.filter = `blur(${Math.max(mobile ? 5 : 10, width * (mobile ? 0.005 : 0.009))}px)`;
      BANDS.forEach((band, i) => {
        const d = band.center - pointer.x;
        const lift = Math.exp(-(d * d) / 0.024) * (0.75 + motion * 0.85);
        ctx.fillStyle = bandFills[i] ?? "#1b6a84";
        curtain(band, t, lift, 0.09 + band.depth * 0.045);
        ctx.fill();
      });
      ctx.restore();

      // Thin bright cores.
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      ctx.filter = `blur(${Math.max(mobile ? 1 : 2, width * (mobile ? 0.0012 : 0.002))}px)`;
      BANDS.forEach((band) => {
        const d = band.center - pointer.x;
        const near = Math.exp(-(d * d) / 0.018);
        ctx.globalAlpha = 0.12 + near * 0.1;
        ctx.fillStyle = `rgb(${band.color[0] + 18}, ${band.color[1] + 22}, ${Math.min(255, band.color[2] + 12)})`;
        curtain(band, t, near * (0.75 + motion * 0.85), 0.05);
        ctx.fill();
      });
      ctx.filter = "none";
      ctx.restore();

      // Pointer light: slightly warm so the gold headline sits in it.
      const lx = pointer.x * width, ly = (0.38 + pointer.y * 0.2) * height;
      if (!light || Math.abs(lx - lightX) > 2 || Math.abs(ly - lightY) > 2) {
        light = ctx.createRadialGradient(lx, ly, 0, lx, ly, width * (0.36 + Math.abs(pointer.x - 0.5) * 0.12));
        light.addColorStop(0, "rgba(246, 228, 184, 0.22)");
        light.addColorStop(0.24, "rgba(130, 196, 204, 0.14)");
        light.addColorStop(0.7, "rgba(30, 120, 150, 0.08)");
        light.addColorStop(1, "rgba(0, 10, 20, 0)");
        lightX = lx; lightY = ly;
      }
      ctx.fillStyle = light;
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = floorGlow ?? "transparent";
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = floorHalo ?? "transparent";
      ctx.fillRect(0, 0, width, height);

      // Fold shadows between curtains.
      ctx.save();
      ctx.globalCompositeOperation = "multiply";
      ctx.filter = mobile ? "none" : `blur(${Math.max(4, width * 0.004)}px)`;
      for (let i = 0; i < 6; i += 1) {
        const x = ((i + 0.5) / 8 + Math.sin(t * 0.18 + i * 1.7) * 0.012) * width;
        const strength = 0.22 + Math.exp(-((x / width - pointer.x) ** 2) / 0.05) * 0.1;
        const half = width * (0.035 + (i % 3) * 0.012);
        if (mobile) {
          ctx.fillStyle = `rgba(2, 5, 10, ${strength * 0.42})`;
          ctx.fillRect(x - half, 0, half * 2, height);
          continue;
        }
        const fold = ctx.createLinearGradient(x - half, 0, x + half, 0);
        fold.addColorStop(0, "rgba(2, 5, 10, 0)");
        fold.addColorStop(0.5, `rgba(2, 5, 10, ${strength})`);
        fold.addColorStop(1, "rgba(2, 5, 10, 0)");
        ctx.fillStyle = fold;
        ctx.fillRect(x - half, 0, half * 2, height);
      }
      ctx.restore();

      ctx.fillStyle = topShade ?? "transparent";
      ctx.fillRect(0, 0, width, height * 0.58);
      ctx.fillStyle = vignette ?? "transparent";
      ctx.fillRect(0, 0, width, height);
      schedule();
    };

    const frame = (now: number) => { raf = 0; render(now); };
    const schedule = () => {
      if (visible && !reduced.matches && !pausedRef.current && !raf) raf = requestAnimationFrame(frame);
    };
    const stop = () => { if (raf) cancelAnimationFrame(raf); raf = 0; };
    const sync = () => {
      if (pausedRef.current) stop();
      else schedule();
    };
    const onVisibility = () => { visible = !document.hidden; if (!visible) stop(); else schedule(); };
    const onMotionChange = () => { if (reduced.matches) { stop(); render(performance.now(), true); } else { start = performance.now(); schedule(); } };

    syncRef.current = sync;
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerleave", onPointerLeave);
    document.addEventListener("visibilitychange", onVisibility);
    reduced.addEventListener("change", onMotionChange);
    resize();
    render(performance.now(), true);
    canvas.classList.add(styles.ready);

    return () => {
      syncRef.current = null;
      stop();
      observer.disconnect();
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerleave", onPointerLeave);
      document.removeEventListener("visibilitychange", onVisibility);
      reduced.removeEventListener("change", onMotionChange);
    };
  }, []);

  useEffect(() => { syncRef.current?.(); }, [paused]);

  return (
    <div className={styles.root} aria-hidden="true">
      <div className={styles.fallback} />
      <canvas ref={canvasRef} className={styles.canvas} />
      <div className={styles.sides} />
      <div className={styles.grain} />
    </div>
  );
}
