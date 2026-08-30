/** جلب أسعار السوق اليومية (Yahoo) إلى observations — نفس عرف المراجعات. */
import { and, eq, desc } from "drizzle-orm";
import { db, schema } from "@/db";
import { MARKET_DEFS, fetchMarketWithFallback } from "@/lib/markets/yahoo";

const { sources, datasets, metrics, series, observations, ingestRuns } = schema;

export async function ingestMarkets() {
  const [src] = await db.insert(sources).values({
    code: "yahoo", nameAr: "أسواق (Yahoo Finance)", nameEn: "Markets (Yahoo Finance)",
    baseUrl: "https://finance.yahoo.com", license: "بيانات مؤجلة ~15 دقيقة — للعرض التحريري مع الإسناد",
    attribution: "المصدر: Yahoo Finance (مؤجل)",
  }).onConflictDoUpdate({ target: sources.code, set: { nameAr: "أسواق (Yahoo Finance)" } }).returning();
  const [ds] = await db.insert(datasets).values({
    sourceId: src.id, code: "mkt.daily", titleAr: "أسعار السوق اليومية", titleEn: "Daily market closes", cadence: "daily",
  }).onConflictDoUpdate({ target: datasets.code, set: { cadence: "daily" } }).returning();

  const [run] = await db.insert(ingestRuns).values({ datasetId: ds.id }).returning();
  try {
    let seen = 0, fresh = 0;
    const errors: string[] = [];
    for (const def of MARKET_DEFS) {
      let q;
      try { q = await fetchMarketWithFallback(def); } catch (e) { errors.push(`${def.code}: ${e instanceof Error ? e.message : e}`); continue; }
      const [metric] = await db.insert(metrics).values({
        code: def.code, titleAr: def.titleAr, titleEn: def.symbol, shortAr: def.shortAr,
        definitionAr: def.definitionAr, unit: def.unit, frequency: "daily",
        stripOrder: null, direction: def.direction, expectedGapDays: 5,
      }).onConflictDoUpdate({ target: metrics.code, set: { titleAr: def.titleAr, unit: def.unit } }).returning();
      const [s] = await db.insert(series).values({ datasetId: ds.id, metricId: metric.id, code: def.code, dims: { symbol: def.symbol } })
        .onConflictDoUpdate({ target: series.code, set: { datasetId: ds.id } }).returning();
      for (const p of q.points) {
        seen++;
        const [latest] = await db.select().from(observations)
          .where(and(eq(observations.seriesId, s.id), eq(observations.period, p.date)))
          .orderBy(desc(observations.revision)).limit(1);
        if (latest && Math.abs(Number(latest.value) - p.value) < 1e-9) continue;
        await db.insert(observations).values({
          seriesId: s.id, period: p.date, revision: latest ? latest.revision + 1 : 1,
          value: String(p.value), sourceLabel: def.titleAr, sourceRef: def.symbol,
        });
        fresh++;
      }
    }
    await db.update(ingestRuns).set({ status: errors.length === MARKET_DEFS.length ? "failed" : "ok", finishedAt: new Date(), rowsSeen: seen, rowsNew: fresh, error: errors.length ? errors.join(" | ") : null }).where(eq(ingestRuns.id, run.id));
    return { seen, fresh, errors };
  } catch (e) {
    await db.update(ingestRuns).set({ status: "failed", finishedAt: new Date(), error: e instanceof Error ? e.message : String(e) }).where(eq(ingestRuns.id, run.id));
    throw e;
  }
}
