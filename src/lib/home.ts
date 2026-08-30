/**
 * بيانات الصفحة الرئيسية — كل شيء من قاعدة البيانات، والحسابات حتمية هنا
 * (لا نموذج لغوي). كل بطاقة تحمل مصدرها ووقت جلبها.
 */
import { desc, eq, inArray, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { daysBetween, fmtDelta, fmtMonthYear, fmtNum } from "./format";

const { metrics, series, observations, ingestRuns, datasets, issues } = schema;

export interface Point { period: string; value: number }
export interface MetricCard {
  code: string; titleAr: string; shortAr: string; unit: string; frequency: string;
  direction: string; value: number; valueText: string; period: string; periodLabel: string;
  delta: number | null; deltaText: string | null; deltaTone: "good" | "bad" | "flat";
  fresh: boolean; staleDays: number | null; spark: Point[]; fetchedAt: Date | null;
  sourceLabel: string | null; definitionAr: string | null; expectedGapDays: number | null;
}

/** أحدث مراجعة لكل فترة ثم آخر 30 فترة تصاعديًا. */
async function latestPoints(seriesId: number, limit = 30): Promise<(Point & { fetchedAt: Date; sourceLabel: string | null })[]> {
  const rows = await db.execute(sql`
    select distinct on (period) period::text as period, value, fetched_at, source_label
    from observations where series_id = ${seriesId}
    order by period desc, revision desc limit ${limit}`);
  return (rows.rows as { period: string; value: string; fetched_at: Date; source_label: string | null }[])
    .map((r) => ({ period: r.period, value: Number(r.value), fetchedAt: new Date(r.fetched_at), sourceLabel: r.source_label }))
    .reverse();
}

function toneFor(direction: string, delta: number): "good" | "bad" | "flat" {
  if (Math.abs(delta) < 1e-9) return "flat";
  if (direction === "up_good") return delta > 0 ? "good" : "bad";
  if (direction === "up_bad") return delta > 0 ? "bad" : "good";
  return delta > 0 ? "good" : "bad"; // محايد: أخضر للصعود شكليًا
}

export async function getMetricCards(codes?: string[]): Promise<MetricCard[]> {
  const ms = await db.select({ m: metrics, s: series }).from(metrics)
    .innerJoin(series, eq(series.metricId, metrics.id))
    .where(codes ? inArray(metrics.code, codes) : sql`true`);
  const now = new Date();
  const cards: MetricCard[] = [];
  for (const { m, s } of ms) {
    const pts = await latestPoints(s.id);
    if (!pts.length) continue;
    const last = pts[pts.length - 1];
    const prev = pts.length > 1 ? pts[pts.length - 2] : null;
    const delta = prev ? last.value - prev.value : null;
    const stale = m.expectedGapDays ? daysBetween(last.period, now) - m.expectedGapDays : null;
    cards.push({
      code: m.code, titleAr: m.titleAr, shortAr: m.shortAr, unit: m.unit, frequency: m.frequency,
      direction: m.direction, value: last.value,
      valueText: m.unit === "%" ? `${fmtNum(last.value)}%` : fmtNum(last.value, 4),
      period: last.period, periodLabel: fmtMonthYear(last.period),
      delta, deltaText: delta === null ? null : m.unit === "%" ? fmtDelta(delta, "%") : fmtDelta(prev ? (delta / prev.value) * 100 : 0, "SAR"),
      deltaTone: delta === null ? "flat" : toneFor(m.direction, delta),
      fresh: stale === null ? true : stale <= 0,
      staleDays: stale !== null && stale > 0 ? stale : null,
      spark: pts.map(({ period, value }) => ({ period, value })),
      fetchedAt: last.fetchedAt, sourceLabel: last.sourceLabel,
      definitionAr: m.definitionAr, expectedGapDays: m.expectedGapDays,
    });
  }
  return cards;
}

export const STRIP_CODES = ["sama.inflation", "sama.m3_growth", "sama.repo", "sama.gdp_growth", "fx.eur", "fx.gbp"];

/** «أهم الأرقام المتغيرة»: أكبر التغيرات المطلقة النسبية بين آخر قراءتين. */
export function topChanges(cards: MetricCard[], n = 5): MetricCard[] {
  return cards.filter((c) => c.delta !== null && Math.abs(c.delta) > 1e-9)
    .sort((a, b) => Math.abs(b.delta! / (Math.abs(b.value) || 1)) - Math.abs(a.delta! / (Math.abs(a.value) || 1)))
    .slice(0, n);
}

export interface Release { titleAr: string; datasetAr: string; period: string; fetchedAt: Date; impact: "high" | "mid" }
/** «ما صدر»: أحدث فترة لكل مقياس مع وقت الجلب. */
export function releases(cards: MetricCard[]): Release[] {
  return [...cards]
    .sort((a, b) => b.period.localeCompare(a.period))
    .slice(0, 5)
    .map((c) => ({
      titleAr: c.sourceLabel?.trim() || `${c.titleAr} — ${c.periodLabel}`,
      datasetAr: "ساما", period: c.period, fetchedAt: c.fetchedAt ?? new Date(),
      impact: ["sama.inflation", "sama.repo", "sama.gdp_growth"].includes(c.code) ? "high" : "mid",
    }));
}

export interface CalendarItem { titleAr: string; due: string; lateDays: number | null; noteAr: string }
export function calendar(cards: MetricCard[]): CalendarItem[] {
  const now = new Date();
  const items: CalendarItem[] = [];
  for (const c of cards) {
    if (!c.expectedGapDays || c.frequency === "decision" || c.unit !== "%") continue;
    const due = new Date(new Date(c.period + "T00:00:00Z").getTime() + c.expectedGapDays * 86400000);
    const late = Math.floor((now.getTime() - due.getTime()) / 86400000);
    items.push({
      titleAr: `ساما: ${c.shortAr} — التحديث القادم`,
      due: due.toISOString().slice(0, 10),
      lateDays: late > 0 ? late : null,
      noteAr: late > 0 ? `متأخر ${late} يومًا عن الإيقاع المعتاد` : `آخر قراءة: ${c.periodLabel}`,
    });
  }
  return items.sort((a, b) => (b.lateDays ? 1 : 0) - (a.lateDays ? 1 : 0) || a.due.localeCompare(b.due)).slice(0, 5);
}

export interface Story {
  title: string; dek: string; why: string; metric: MetricCard; tags: string;
}
/** قصة اليوم — قواعد حتمية فوق السلاسل؛ الصياغة قوالب لا نموذج. */
export function buildStory(cards: MetricCard[]): Story | null {
  const infl = cards.find((c) => c.code === "sama.inflation");
  const m3 = cards.find((c) => c.code === "sama.m3_growth");
  const repo = cards.find((c) => c.code === "sama.repo");
  if (!infl) return null;
  // طول ثبات التضخم على القراءة الأخيرة
  let streak = 1;
  for (let i = infl.spark.length - 2; i >= 0; i--) {
    if (Math.abs(infl.spark[i].value - infl.value) < 0.05) streak++; else break;
  }
  const inflTxt = `${fmtNum(infl.value)}%`;
  if (streak >= 3) {
    return {
      title: `التضخم مستقر عند ${inflTxt} للشهر ${["", "", "الثاني", "الثالث", "الرابع", "الخامس", "السادس"][Math.min(streak, 6)] ?? streak}`,
      dek: `قراءة ${infl.periodLabel} لم تتحرك تقريبًا عن الأشهر السابقة${m3 ? `، بينما ينمو عرض النقود (ن3) بمعدل ${fmtNum(m3.value)}% سنويًا` : ""}.`,
      why: `استقرار التضخم مع ${repo ? `ثبات الريبو عند ${fmtNum(repo.value)}%` : "ثبات أسعار الفائدة"} يعني أن الضغط السعري محليًا لا يجاري توسّع السيولة — الفجوة بينهما — ${fmtNum((m3?.value ?? 0) - infl.value)} نقطة — هي الرقم الذي يستحق المراقبة. التزامن لا يثبت السببية.`,
      metric: infl, tags: "أسعار · ساما · تحليل بيانات",
    };
  }
  const dir = (infl.delta ?? 0) > 0 ? "يرتفع" : "يتباطأ";
  return {
    title: `التضخم ${dir} إلى ${inflTxt} في ${infl.periodLabel}`,
    dek: `تغيّر ${infl.deltaText ?? ""} عن الشهر السابق${m3 ? `، مع نمو عرض النقود ${fmtNum(m3.value)}%` : ""}.`,
    why: `اتجاه التضخم هو المدخل الأول لقراءة قرارات الفائدة المقبلة وكلفة المعيشة. المقارنة هنا شهر إلى شهر على القراءة السنوية.`,
    metric: infl, tags: "أسعار · ساما · تحليل بيانات",
  };
}

export interface SourceHealth { updated: number; pending: number; lastRun: Date | null }
export async function sourceHealth(cards: MetricCard[]): Promise<SourceHealth> {
  const [run] = await db.select().from(ingestRuns).orderBy(desc(ingestRuns.startedAt)).limit(1);
  return {
    updated: cards.filter((c) => c.fresh).length,
    pending: cards.filter((c) => !c.fresh).length,
    lastRun: run?.finishedAt ?? run?.startedAt ?? null,
  };
}

export async function latestIssue() {
  const [row] = await db.select().from(issues).where(eq(issues.status, "published")).orderBy(desc(issues.number)).limit(1);
  return row ?? null;
}
