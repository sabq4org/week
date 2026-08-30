/**
 * بيانات الصفحة الرئيسية — كل شيء من قاعدة البيانات، والحسابات حتمية هنا
 * (لا نموذج لغوي). كل بطاقة تحمل مصدرها ووقت جلبها.
 */
import { desc, eq, inArray, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { daysBetween, fmtDay, fmtDelta, fmtMonthYear, fmtNum, fmtRelative } from "./format";

const { metrics, series, observations, ingestRuns, issues, officialNews, posReports } = schema;

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
      valueText: m.unit === "%" ? `${fmtNum(last.value)}%`
        : m.unit === "USD" ? `$${fmtNum(last.value)}`
        : m.unit === "نقطة" ? fmtNum(last.value, 0)
        : fmtNum(last.value, 4),
      period: last.period, periodLabel: m.frequency === "daily" ? fmtDay(last.period) : fmtMonthYear(last.period),
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

export const STRIP_CODES = ["mkt.tasi", "mkt.brent", "mkt.gold", "fx.eur", "fx.gbp", "fx.jpy"];
export const MACRO_CODES = ["sama.inflation", "sama.m3_growth", "sama.repo", "sama.gdp_growth"];

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

/** أخبار البنك المركزي الرسمية — الأحدث أولًا. */
export async function officialNewsFeed(limit = 6) {
  return db.select().from(officialNews).orderBy(desc(officialNews.publishedAt)).limit(limit);
}

export interface DailyBrief { text: string; asOf: Date }
/** «موجز اليوم» — جملة مولّدة بقوالب من حركة اليوم الفعلية (تاسي/برنت/ذهب/عملات). */
export function buildDailyBrief(cards: MetricCard[]): DailyBrief | null {
  const get = (c: string) => cards.find((x) => x.code === c);
  const tasi = get("mkt.tasi"), brent = get("mkt.brent"), gold = get("mkt.gold");
  const parts: string[] = [];
  if (tasi?.delta != null && tasi.spark.length > 1) {
    const prev = tasi.spark[tasi.spark.length - 2].value;
    const pct = (tasi.delta / prev) * 100;
    parts.push(`تاسي ${pct >= 0 ? "يرتفع" : "يتراجع"} ${fmtNum(Math.abs(pct))}% إلى ${fmtNum(tasi.value, 0)} نقطة`);
  }
  if (brent?.delta != null && brent.spark.length > 1) {
    const prev = brent.spark[brent.spark.length - 2].value;
    parts.push(`برنت عند $${fmtNum(brent.value)} (${brent.delta >= 0 ? "+" : "−"}${fmtNum(Math.abs((brent.delta / prev) * 100))}%)`);
  }
  if (gold?.delta != null && gold.spark.length > 1) {
    const prev = gold.spark[gold.spark.length - 2].value;
    parts.push(`الذهب ${gold.delta >= 0 ? "يصعد" : "يهبط"} ${fmtNum(Math.abs((gold.delta / prev) * 100))}%`);
  }
  // أكبر حركة عملة أمام الريال
  const fx = cards.filter((c) => c.code.startsWith("fx.") && c.delta != null && c.spark.length > 1)
    .map((c) => ({ c, pct: (c.delta! / c.spark[c.spark.length - 2].value) * 100 }))
    .filter((x) => Math.abs(x.pct) >= 0.05)
    .sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct))[0];
  if (fx) parts.push(`${fx.c.shortAr} ${fx.pct >= 0 ? "+" : "−"}${fmtNum(Math.abs(fx.pct))}% أمام الريال`);
  if (!parts.length) return null;
  const asOf = cards.filter((c) => c.frequency === "daily" && c.fetchedAt).map((c) => c.fetchedAt!).sort((a, b) => b.getTime() - a.getTime())[0] ?? new Date();
  return { text: parts.join(" · "), asOf };
}

export interface ArchiveNote { line: string; sub: string }
/** «من الأرشيف» — مقارنات حقيقية من عمق السلاسل المخزنة. */
export function buildArchive(cards: MetricCard[]): ArchiveNote[] {
  const notes: ArchiveNote[] = [];
  for (const code of ["sama.repo", "sama.inflation", "sama.m3_growth"]) {
    const c = cards.find((x) => x.code === code);
    if (!c || c.spark.length < 6) continue;
    const oldest = c.spark[0];
    const yearsBack = Math.max(1, Math.round((new Date(c.period).getTime() - new Date(oldest.period).getTime()) / (365 * 86400000)));
    if (Math.abs(oldest.value - c.value) < 0.01) continue;
    const dir = c.value > oldest.value ? "ارتفع" : "انخفض";
    notes.push({
      line: `${c.shortAr}: ${dir} من ${fmtNum(oldest.value)}% إلى ${fmtNum(c.value)}%`,
      sub: `${fmtMonthYear(oldest.period)} ← ${fmtMonthYear(c.period)} (${yearsBack} ${yearsBack > 2 ? "سنوات" : "سنة"} من السجل)`,
    });
  }
  return notes.slice(0, 3);
}

export { fmtRelative };

// ===== فلوس الناس =====

export interface PosSector { ar: string; billions: number; dv: number; sharePct: number }
export interface PosWeekView {
  labelAr: string; weekEnd: string; totalBillions: number; opsMillions: number;
  dv: number; dn: number; sectors: PosSector[]; topCities: { ar: string; billions: number; dv: number }[];
  sourceUrl: string; fetchedAt: Date;
}

/** أحدث تقرير نقاط بيع — القطاعات المعروضة هي صفوف المستوى الأعلى (مجموعات + مستقلة). */
export async function getPosWeek(): Promise<PosWeekView | null> {
  const [r] = await db.select().from(posReports).orderBy(desc(posReports.weekEnd)).limit(1);
  if (!r) return null;
  const total = Number(r.totalValueThousands);
  const top = r.activities.filter((a) => (a.isGroup || (!a.group && !a.isGroup)) && a.en !== "Others" && a.ar !== "أخرى");
  const sectors = top
    .map((a) => ({ ar: a.ar, billions: a.v / 1e6, dv: a.dv, sharePct: (a.v / total) * 100 }))
    .sort((a, b) => b.billions - a.billions).slice(0, 8);
  const topCities = [...r.cities].sort((a, b) => b.v - a.v).slice(0, 5)
    .map((c) => ({ ar: c.ar, billions: c.v / 1e6, dv: c.dv }));
  return {
    labelAr: r.labelAr, weekEnd: r.weekEnd, totalBillions: total / 1e6,
    opsMillions: Number(r.totalCountThousands) / 1e3,
    dv: Number(r.weeklyValueChangePct), dn: Number(r.weeklyCountChangePct),
    sectors, topCities, sourceUrl: r.sourceUrl, fetchedAt: r.fetchedAt,
  };
}

export interface Headline { title: string; sub: string; tone: "good" | "bad" | "flat"; periodLabel: string }

function bn(v: number): string { return fmtNum(v / 1e9, v >= 1e10 ? 1 : 2); }

/** «مانشيتات الأرقام» — عناوين مولّدة بقوالب من بيانات النشرة الشهرية. */
export function buildHeadlines(cards: MetricCard[]): Headline[] {
  const out: Headline[] = [];
  const get = (code: string) => cards.find((c) => c.code === code);

  const mc = get("bl.mortgage_contracts"), mv = get("bl.mortgage_total");
  if (mc && mv) {
    const dPct = mc.delta != null && mc.spark.length > 1 ? (mc.delta / mc.spark[mc.spark.length - 2].value) * 100 : null;
    out.push({
      title: `البنوك وقّعت ${fmtNum(mc.value, 0)} عقد تمويل عقاري جديدًا بقيمة ${bn(mv.value)} مليار ريال في ${mc.periodLabel.split(" ")[0]}`,
      sub: dPct != null ? `عدد العقود ${dPct >= 0 ? "ارتفع" : "انخفض"} ${fmtNum(Math.abs(dPct))}% عن الشهر السابق` : "",
      tone: dPct != null && dPct >= 0 ? "good" : "bad", periodLabel: mc.periodLabel,
    });
  }
  const ec = get("bl.ecom_sales");
  if (ec && ec.delta != null && ec.spark.length > 1) {
    const dPct = (ec.delta / ec.spark[ec.spark.length - 2].value) * 100;
    out.push({
      title: `${bn(ec.value)} مليار ريال تسوّق إلكتروني عبر «مدى» في شهر واحد`,
      sub: `${dPct >= 0 ? "+" : "−"}${fmtNum(Math.abs(dPct))}% عن الشهر السابق — ${ec.periodLabel}`,
      tone: dPct >= 0 ? "good" : "bad", periodLabel: ec.periodLabel,
    });
  }
  const cc = get("bl.consumer_creditCards");
  if (cc) {
    const dPct = cc.delta != null && cc.spark.length > 1 ? (cc.delta / cc.spark[cc.spark.length - 2].value) * 100 : null;
    out.push({
      title: `${bn(cc.value)} مليار ريال أرصدة قائمة على البطاقات الائتمانية`,
      sub: dPct != null ? `${dPct >= 0 ? "زيادة" : "انخفاض"} ${fmtNum(Math.abs(dPct))}% خلال ربع — نهاية ${cc.periodLabel}` : `نهاية ${cc.periodLabel}`,
      tone: "flat", periodLabel: cc.periodLabel,
    });
  }
  const rm = get("bl.bop_workersRemittances");
  if (rm && rm.delta != null && rm.spark.length > 1) {
    const dPct = (rm.delta / rm.spark[rm.spark.length - 2].value) * 100;
    out.push({
      title: `تحويلات العاملين للخارج بلغت ${bn(rm.value)} مليار ريال في ربع واحد`,
      sub: `${dPct >= 0 ? "+" : "−"}${fmtNum(Math.abs(dPct))}% عن الربع السابق — ${rm.periodLabel}`,
      tone: "flat", periodLabel: rm.periodLabel,
    });
  }
  const atm = get("bl.atm_cashWithdrawals"), sad = get("bl.sadad_value");
  if (atm && sad) {
    out.push({
      title: `مقابل كل ريال يُسحب كاش من الصراف، يدفع السعوديون ${fmtNum(sad.value / atm.value, 1)} ريال فواتير عبر سداد`,
      sub: `الصراف ${bn(atm.value)} مليار · سداد ${bn(sad.value)} مليار — ${atm.periodLabel}`,
      tone: "flat", periodLabel: atm.periodLabel,
    });
  }
  return out;
}

/** مانشيت نقاط البيع الرئيسي. */
export function posHeadline(pos: PosWeekView): { title: string; sub: string } {
  const top = pos.sectors[0];
  const dir = pos.dv >= 0 ? "ارتفاعًا" : "تراجعًا";
  return {
    title: `${fmtNum(pos.totalBillions, 1)} مليار ريال أنفقها السعوديون عبر نقاط البيع في أسبوع`,
    sub: `${pos.labelAr}: ${fmtNum(pos.opsMillions, 0)} مليون عملية (${pos.dv >= 0 ? "+" : "−"}${fmtNum(Math.abs(pos.dv))}% ${dir} بالقيمة أسبوعيًا) · الصدارة: ${top?.ar ?? "—"} بحصة ${fmtNum(top?.sharePct ?? 0, 0)}%`,
  };
}
