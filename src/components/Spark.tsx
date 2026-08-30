/** سباركلاين SVG — الزمن RTL: الأقدم يمينًا والأحدث يسارًا (عرف المشروع). */
export function Spark({ points, color, w = 72, h = 22 }: { points: { value: number }[]; color: string; w?: number; h?: number }) {
  if (points.length < 2) return <svg width={w} height={h} />;
  const vals = points.map((p) => p.value);
  const min = Math.min(...vals), max = Math.max(...vals);
  const span = max - min || 1;
  const step = w / (points.length - 1);
  // الأحدث عند x=0 (يسار) والأقدم عند x=w (يمين)
  const d = points.map((p, i) => {
    const x = w - i * step;
    const y = h - 3 - ((p.value - min) / span) * (h - 6);
    return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} fill="none" aria-hidden>
      <path d={d} stroke={color} strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}
