import type { Point } from "@/lib/home";
import { fmtDay, fmtMonthYear, fmtNum } from "@/lib/format";
import s from "./OpsRoom.module.css";

type Tone = "good" | "bad" | "flat";
const STROKE: Record<Tone, string> = { good: "#7FD6C8", bad: "#F08A6E", flat: "#E7D7A8" };

const fmtPeriod = (p: string) => (p.length > 7 ? fmtDay(p) : fmtMonthYear(p));

/**
 * الرسم البطل: خط ومساحة على آخر 36 قراءة. الزمن RTL (الأقدم يمينًا، الأحدث يسارًا)
 * بحسب عرف المشروع، والنقطة الأخيرة ذهبية. SVG خالص يُرسم على الخادم.
 */
export function HeroChart({ points, unit, tone }: { points: Point[]; unit: string; tone: Tone }) {
  const pts = points.slice(-36);
  if (pts.length < 2) return null;
  const W = 1000, H = 300, PT = 28, PB = 34, PX = 14;
  const vals = pts.map((p) => p.value);
  const min = Math.min(...vals), max = Math.max(...vals);
  const span = max - min || 1;
  const step = (W - PX * 2) / (pts.length - 1);
  const xy = (p: Point, i: number) => ({ x: W - PX - i * step, y: H - PB - ((p.value - min) / span) * (H - PT - PB) });
  const line = pts.map((p, i) => { const { x, y } = xy(p, i); return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`; }).join(" ");
  const first = xy(pts[0], 0), last = xy(pts[pts.length - 1], pts.length - 1);
  const area = `${line} L${last.x.toFixed(1)} ${H - PB} L${first.x.toFixed(1)} ${H - PB} Z`;
  const stroke = STROKE[tone];
  const suffix = unit === "%" ? "%" : "";
  const oldest = fmtPeriod(pts[0].period), newest = fmtPeriod(pts[pts.length - 1].period);
  return (
    <figure className={s.chart}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={`سلسلة زمنية من ${oldest} إلى ${newest}، بين ${fmtNum(min)}${suffix} و${fmtNum(max)}${suffix}`}>
        <defs>
          <linearGradient id="opsHeroArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={stroke} stopOpacity=".28" />
            <stop offset="1" stopColor={stroke} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((f) => { const y = H - PB - f * (H - PT - PB); return <line key={f} x1="0" x2={W} y1={y} y2={y} stroke="rgba(255,255,255,.07)" />; })}
        <line x1="0" x2={W} y1={H - PB} y2={H - PB} stroke="rgba(255,255,255,.18)" />
        <path d={area} fill="url(#opsHeroArea)" />
        <path d={line} stroke={stroke} strokeWidth="3" fill="none" strokeLinejoin="round" />
        <line x1={last.x} x2={last.x} y1={PT} y2={H - PB} stroke="#E7D7A8" strokeDasharray="3 5" opacity=".6" />
        <circle cx={last.x} cy={last.y} r="7" fill="#C9A227" stroke="#040c18" strokeWidth="3" />
        <text x={W - PX} y={16} fontSize="13" fill="rgba(255,255,255,.55)" textAnchor="end" className="num">{fmtNum(max)}{suffix}</text>
        <text x={W - PX} y={H - PB - 6} fontSize="13" fill="rgba(255,255,255,.55)" textAnchor="end" className="num">{fmtNum(min)}{suffix}</text>
      </svg>
      <figcaption className={s.axis}>
        <span>{newest} · الأحدث</span>
        <span>{oldest} · الأقدم</span>
      </figcaption>
    </figure>
  );
}
