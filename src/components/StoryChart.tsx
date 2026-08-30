import type { Point } from "@/lib/home";
import { fmtMonthYear } from "@/lib/format";

/** رسم قصة اليوم — خط على آخر 24 فترة، RTL (الأقدم يمينًا)، بنقطة ذهبية على الأحدث. */
export function StoryChart({ points, unit }: { points: Point[]; unit: string }) {
  const pts = points.slice(-24);
  if (pts.length < 2) return null;
  const W = 800, H = 170, PAD = 10;
  const vals = pts.map((p) => p.value);
  const min = Math.min(...vals), max = Math.max(...vals);
  const span = max - min || 1;
  const step = (W - PAD * 2) / (pts.length - 1);
  const xy = (p: Point, i: number) => ({
    x: W - PAD - i * step,
    y: H - 24 - ((p.value - min) / span) * (H - 48),
  });
  const d = pts.map((p, i) => { const { x, y } = xy(p, i); return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`; }).join(" ");
  const last = xy(pts[pts.length - 1], pts.length - 1);
  const gridYs = [0.25, 0.5, 0.75].map((f) => H - 24 - f * (H - 48));
  return (
    <>
      <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} fill="none" preserveAspectRatio="none" role="img"
        aria-label={`سلسلة زمنية من ${fmtMonthYear(pts[0].period)} إلى ${fmtMonthYear(pts[pts.length - 1].period)}`}>
        <line x1="0" y1={H - 24} x2={W} y2={H - 24} stroke="#E1DED4" />
        {gridYs.map((y, i) => <line key={i} x1="0" y1={y} x2={W} y2={y} stroke="#EFECE4" />)}
        <text x={PAD} y={14} fontSize="11" fill="#8A93A2" className="num">{max.toFixed(1)}{unit === "%" ? "%" : ""}</text>
        <text x={PAD} y={H - 30} fontSize="11" fill="#8A93A2" className="num">{min.toFixed(1)}{unit === "%" ? "%" : ""}</text>
        <path d={d} stroke="#0B1F3A" strokeWidth="3" strokeLinejoin="round" />
        <circle cx={last.x} cy={last.y} r="5" fill="#C9A227" stroke="#0B1F3A" strokeWidth="2" />
      </svg>
      <div className="axis-cap">
        <span>{fmtMonthYear(pts[pts.length - 1].period)} ←</span>
        <span>→ {fmtMonthYear(pts[0].period)}</span>
      </div>
    </>
  );
}
