const AR_MONTHS = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];

export function fmtMonthYear(iso: string): string {
  const [y, m] = iso.split("-").map(Number);
  return `${AR_MONTHS[(m ?? 1) - 1]} ${y}`;
}
export function fmtDay(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${AR_MONTHS[(m ?? 1) - 1]} ${y}`;
}
export function fmtNum(n: number, digits = 2): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: digits, minimumFractionDigits: 0 });
}
export function fmtDelta(n: number, unit: string): string {
  const sign = n > 0 ? "+" : n < 0 ? "−" : "";
  const abs = Math.abs(n);
  if (unit === "%") return `${sign}${fmtNum(abs, 2)} نقطة`;
  return `${sign}${fmtNum(abs, 2)}%`;
}
export function fmtRelative(d: Date): string {
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  if (mins < 2) return "قبل لحظات";
  if (mins < 60) return `قبل ${mins} دقيقة`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return hours === 1 ? "قبل ساعة" : `قبل ${hours} ساعات`;
  const days = Math.round(hours / 24);
  if (days === 1) return "أمس";
  return `قبل ${days} أيام`;
}
export function daysBetween(isoA: string, b: Date): number {
  return Math.floor((b.getTime() - new Date(isoA + "T00:00:00Z").getTime()) / 86400000);
}
