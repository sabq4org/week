/**
 * تقارير ساما الملفية: نقاط البيع الأسبوعي (PDF) والنشرة الشهرية (Excel).
 * النشرة تُفرَّغ إلى observations كسلاسل شهرية/ربعية؛ نقاط البيع تُخزَّن تقريرًا كاملًا.
 */
import { and, desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { samaGetBuffer } from "@/lib/sama/client";
import { listReportFiles } from "@/lib/sama/reports";
import { parsePosReport } from "@/lib/sama/parsers/posReport";
import { parseMonthlyBulletin, type MonthlyMetricKey, type QuarterlyMetricKey } from "@/lib/sama/parsers/monthlyBulletin";

const { sources, datasets, metrics, series, observations, ingestRuns, posReports } = schema;

async function samaSource() {
  const [row] = await db.select().from(sources).where(eq(sources.code, "sama"));
  if (!row) throw new Error("sama source missing — run indicator ingest first");
  return row;
}
async function ensureDataset(sourceId: number, code: string, titleAr: string, titleEn: string, cadence: string) {
  const [row] = await db.insert(datasets).values({ sourceId, code, titleAr, titleEn, cadence })
    .onConflictDoUpdate({ target: datasets.code, set: { titleAr, cadence } }).returning();
  return row;
}
async function runWithLog<T extends { seen: number; fresh: number }>(datasetId: number, fn: () => Promise<T>) {
  const [run] = await db.insert(ingestRuns).values({ datasetId }).returning();
  try {
    const r = await fn();
    await db.update(ingestRuns).set({ status: "ok", finishedAt: new Date(), rowsSeen: r.seen, rowsNew: r.fresh }).where(eq(ingestRuns.id, run.id));
    return r;
  } catch (e) {
    await db.update(ingestRuns).set({ status: "failed", finishedAt: new Date(), error: e instanceof Error ? e.message : String(e) }).where(eq(ingestRuns.id, run.id));
    throw e;
  }
}

/** أحدث تقرير نقاط بيع غير مخزّن. */
export async function ingestPosWeekly() {
  const src = await samaSource();
  const ds = await ensureDataset(src.id, "sama.pos_weekly", "عمليات نقاط البيع الأسبوعية", "Weekly POS transactions", "weekly");
  return runWithLog(ds.id, async () => {
    const files = await listReportFiles("pos_weekly");
    const latest = files[0];
    const report = await parsePosReport(await samaGetBuffer(latest.url));
    const week = report.weeks[3];
    const exists = await db.select({ id: posReports.id }).from(posReports).where(eq(posReports.weekEnd, week.end)).limit(1);
    if (exists.length) return { seen: 1, fresh: 0 };
    await db.insert(posReports).values({
      weekStart: week.start, weekEnd: week.end, labelAr: week.labelAr,
      totalValueThousands: String(report.total.v[3]), totalCountThousands: String(report.total.n[3]),
      weeklyValueChangePct: String(report.total.dv), weeklyCountChangePct: String(report.total.dn),
      activities: report.activities.map((a) => ({ en: a.en, ar: a.ar, v: a.v[3], dv: a.dv, isGroup: a.isGroup, group: a.group })),
      cities: report.cities.map((c) => ({ en: c.en, ar: c.ar, v: c.v[3], dv: c.dv })),
      sourceUrl: latest.url,
    }).onConflictDoNothing();
    return { seen: 1, fresh: 1 };
  });
}

/** ما نعرضه من النشرة الشهرية — «فلوس الناس» أولًا. */
const BULLETIN_METRICS: { key: MonthlyMetricKey | QuarterlyMetricKey; quarterly?: boolean; titleAr: string; shortAr: string; unit: string; direction: "neutral" | "up_good" | "up_bad"; definitionAr: string }[] = [
  { key: "mortgage.contracts", titleAr: "عقود التمويل العقاري الجديدة للأفراد", shortAr: "قروض عقارية جديدة", unit: "عقد", direction: "neutral", definitionAr: "عدد عقود التمويل العقاري السكني الجديدة للأفراد من البنوك خلال الشهر." },
  { key: "mortgage.total", titleAr: "قيمة التمويل العقاري الجديد للأفراد", shortAr: "قيمة التمويل العقاري", unit: "SAR", direction: "neutral", definitionAr: "قيمة التمويل العقاري السكني الجديد للأفراد من البنوك خلال الشهر بالريال." },
  { key: "ecom.sales", titleAr: "مبيعات التجارة الإلكترونية عبر المدى", shortAr: "التجارة الإلكترونية", unit: "SAR", direction: "up_good", definitionAr: "قيمة مبيعات التجارة الإلكترونية باستخدام بطاقات مدى خلال الشهر." },
  { key: "atm.cashWithdrawals", titleAr: "السحوبات النقدية من الصرافات", shortAr: "سحوبات الصراف", unit: "SAR", direction: "neutral", definitionAr: "إجمالي السحوبات النقدية من أجهزة الصراف الآلي خلال الشهر." },
  { key: "sadad.value", titleAr: "مدفوعات الفواتير عبر سداد", shortAr: "فواتير سداد", unit: "SAR", direction: "neutral", definitionAr: "قيمة الفواتير المسددة عبر نظام سداد خلال الشهر." },
  { key: "pos.sales", titleAr: "مبيعات نقاط البيع الشهرية", shortAr: "نقاط البيع (شهري)", unit: "SAR", direction: "up_good", definitionAr: "قيمة عمليات نقاط البيع خلال الشهر." },
  { key: "consumer.creditCards", quarterly: true, titleAr: "أرصدة قروض البطاقات الائتمانية", shortAr: "قروض البطاقات", unit: "SAR", direction: "neutral", definitionAr: "أرصدة قروض البطاقات الائتمانية القائمة نهاية الربع." },
  { key: "consumer.total", quarterly: true, titleAr: "القروض الاستهلاكية القائمة", shortAr: "القروض الاستهلاكية", unit: "SAR", direction: "neutral", definitionAr: "إجمالي أرصدة القروض الاستهلاكية القائمة نهاية الربع." },
  { key: "bop.workersRemittances", quarterly: true, titleAr: "تحويلات العاملين للخارج", shortAr: "تحويلات العاملين", unit: "SAR", direction: "neutral", definitionAr: "تحويلات العاملين الوافدين إلى الخارج خلال الربع." },
];

function periodToDate(p: string): string {
  const q = p.match(/^(\d{4})-Q([1-4])$/);
  if (q) return `${q[1]}-${String(Number(q[2]) * 3).padStart(2, "0")}-28`;
  if (/^\d{4}-\d{2}$/.test(p)) return `${p}-28`;
  return `${p}-12-28`;
}

export async function ingestMonthlyBulletin() {
  const src = await samaSource();
  const ds = await ensureDataset(src.id, "sama.bulletin", "النشرة الإحصائية الشهرية", "Monthly statistical bulletin", "monthly");
  return runWithLog(ds.id, async () => {
    const files = await listReportFiles("monthly_bulletin");
    const latest = files.find((f) => /\.xlsx$/i.test(f.fileName));
    if (!latest) throw new Error("bulletin: no xlsx in index");
    const b = await parseMonthlyBulletin(await samaGetBuffer(latest.url));
    let seen = 0, fresh = 0;
    for (const def of BULLETIN_METRICS) {
      const pts = def.quarterly
        ? b.quarterly[def.key as QuarterlyMetricKey]
        : b.monthly[def.key as MonthlyMetricKey];
      if (!pts?.length) continue;
      const code = `bl.${String(def.key).replace(/\./g, "_")}`;
      const [metric] = await db.insert(metrics).values({
        code, titleAr: def.titleAr, titleEn: String(def.key), shortAr: def.shortAr, definitionAr: def.definitionAr,
        unit: def.unit, frequency: def.quarterly ? "quarterly" : "monthly",
        direction: def.direction, expectedGapDays: def.quarterly ? 110 : 45,
      }).onConflictDoUpdate({ target: metrics.code, set: { titleAr: def.titleAr, shortAr: def.shortAr } }).returning();
      const [s] = await db.insert(series).values({ datasetId: ds.id, metricId: metric.id, code, dims: {} })
        .onConflictDoUpdate({ target: series.code, set: { datasetId: ds.id } }).returning();
      for (const p of pts.slice(-72)) {
        seen++;
        const period = periodToDate(p.period);
        const [latestObs] = await db.select().from(observations)
          .where(and(eq(observations.seriesId, s.id), eq(observations.period, period)))
          .orderBy(desc(observations.revision)).limit(1);
        if (latestObs && Math.abs(Number(latestObs.value) - p.value) < 1e-6) continue;
        await db.insert(observations).values({
          seriesId: s.id, period, revision: latestObs ? latestObs.revision + 1 : 1,
          value: String(p.value), sourceLabel: `${def.titleAr} — ${p.period}`, sourceRef: latest.url,
        });
        fresh++;
      }
    }
    return { seen, fresh };
  });
}
