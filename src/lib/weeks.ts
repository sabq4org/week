/** حسابات الأسبوع — حتمية وقابلة للاختبار. الأسبوع بمعيار ISO 8601 (يبدأ الاثنين). */

export const WEEKDAYS_AR = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

/** رقم الأسبوع ISO للتاريخ المعطى. */
export function isoWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
  return Math.ceil(((d.getTime() - yearStart) / 86400000 + 1) / 7);
}

/** أيام متبقية حتى الخميس القادم (موعد إغلاق العدد). الخميس نفسه يُعد أسبوعًا كاملًا. */
export function daysUntilThursday(date: Date): number {
  const diff = (4 - date.getDay() + 7) % 7;
  return diff === 0 ? 7 : diff;
}

/** آخر n أسابيع تصاعديًا وينتهي بالأسبوع الحالي. */
export function recentWeeks(date: Date, n: number): number[] {
  const now = isoWeek(date);
  return Array.from({ length: n }, (_, i) => ((now - (n - 1) + i - 1 + 52) % 52) + 1);
}
