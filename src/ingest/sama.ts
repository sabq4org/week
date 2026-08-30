/**
 * جلب ساما → قاعدة البيانات. idempotent: القيمة نفسها للفترة نفسها لا تُكرَّر،
 * والقيمة المختلفة للفترة نفسها تُسجَّل مراجعة جديدة (revision+1) ولا تستبدل القديمة.
 */
import { and, eq, desc } from "drizzle-orm";
import { db, schema } from "@/db";
import { INDICATOR_DEFS, SAMA_INDICATOR_KEYS, fetchIndicatorSeries, fetchIndicatorSnapshots } from "@/lib/sama/indicators";
import { FX_CODES, FX_NAMES_AR, fetchFxHistory, fetchFxToday } from "@/lib/sama/fx";
import { fetchSamaNews } from "@/lib/sama/news";

const { sources, datasets, metrics, series, observations, ingestRuns } = schema;

async function ensureSource() {
  const [row] = await db.insert(sources).values({
    code: "sama", nameAr: "البنك المركزي السعودي (ساما)", nameEn: "Saudi Central Bank (SAMA)",
    baseUrl: "https://www.sama.gov.sa", license: "بيانات رسمية منشورة للعموم — يلزم الإسناد",
    attribution: "المصدر: البنك المركزي السعودي",
  }).onConflictDoUpdate({ target: sources.code, set: { nameAr: "البنك المركزي السعودي (ساما)" } }).returning();
  return row;
}

async function ensureDataset(sourceId: number, code: string, titleAr: string, titleEn: string, cadence: string) {
  const [row] = await db.insert(datasets).values({ sourceId, code, titleAr, titleEn, cadence })
    .onConflictDoUpdate({ target: datasets.code, set: { titleAr, titleEn, cadence } }).returning();
  return row;
}

async function ensureMetric(m: typeof metrics.$inferInsert) {
  const [row] = await db.insert(metrics).values(m)
    .onConflictDoUpdate({ target: metrics.code, set: { ...m } }).returning();
  return row;
}

async function ensureSeries(datasetId: number, metricId: number, code: string, dims: Record<string, string> = {}) {
  const [row] = await db.insert(series).values({ datasetId, metricId, code, dims })
    .onConflictDoUpdate({ target: series.code, set: { datasetId, metricId } }).returning();
  return row;
}

/** يعيد true إن سُجِّل صف جديد (قيمة جديدة أو مراجعة). */
async function upsertObservation(seriesId: number, period: string, value: number, sourceLabel?: string, sourceRef?: string): Promise<boolean> {
  const [latest] = await db.select().from(observations)
    .where(and(eq(observations.seriesId, seriesId), eq(observations.period, period)))
    .orderBy(desc(observations.revision)).limit(1);
  if (latest && Math.abs(Number(latest.value) - value) < 1e-9) return false;
  await db.insert(observations).values({
    seriesId, period, revision: latest ? latest.revision + 1 : 1,
    value: String(value), sourceLabel: sourceLabel ?? null, sourceRef: sourceRef ?? null,
  });
  return true;
}

async function runWithLog(datasetId: number, fn: () => Promise<{ seen: number; fresh: number }>) {
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

export async function ingestSamaIndicators() {
  const src = await ensureSource();
  const ds = await ensureDataset(src.id, "sama.indicators", "مؤشرات ساما الرئيسية", "SAMA headline indicators", "monthly");
  return runWithLog(ds.id, async () => {
    const snaps = await fetchIndicatorSnapshots();
    let seen = 0, fresh = 0;
    for (const key of SAMA_INDICATOR_KEYS) {
      const def = INDICATOR_DEFS[key];
      const metric = await ensureMetric({
        code: def.metricCode, titleAr: def.titleAr, titleEn: def.titleEn, shortAr: def.shortAr, definitionAr: def.definitionAr,
        unit: def.unit, frequency: def.frequency, stripOrder: def.stripOrder, direction: def.direction, expectedGapDays: def.expectedGapDays,
      });
      const s = await ensureSeries(ds.id, metric.id, def.metricCode);
      const points = await fetchIndicatorSeries(key);
      for (const p of points) { seen++; if (await upsertObservation(s.id, p.date, p.value, p.label, def.listUrl)) fresh++; }
      const snap = snaps.find((x) => x.key === key);
      if (snap?.asOf) { seen++; if (await upsertObservation(s.id, snap.asOf, snap.value, snap.samaTitle, def.listUrl)) fresh++; }
    }
    return { seen, fresh };
  });
}

export async function ingestSamaFx() {
  const src = await ensureSource();
  const ds = await ensureDataset(src.id, "sama.fx", "أسعار الصرف الرسمية", "Official exchange rates", "daily");
  return runWithLog(ds.id, async () => {
    const rates = await fetchFxToday();
    let seen = 0, fresh = 0;
    for (const code of FX_CODES) {
      const r = rates.find((x) => x.code === code); if (!r) continue;
      const nameAr = FX_NAMES_AR[code] ?? r.nameAr;
      const metric = await ensureMetric({
        code: `fx.${code.toLowerCase()}`, titleAr: `سعر ${nameAr} بالريال`, titleEn: `${code}/SAR`, shortAr: nameAr,
        definitionAr: "ريال سعودي لكل وحدة من العملة، بحسب البنك المركزي.", unit: "SAR", frequency: "daily",
        stripOrder: code === "EUR" ? 6 : null, direction: "neutral", expectedGapDays: 4,
      });
      const s = await ensureSeries(ds.id, metric.id, `fx.${code.toLowerCase()}`, { currency: code });
      seen++; if (await upsertObservation(s.id, r.date, r.rate, nameAr, "op=exchangeRates")) fresh++;
      try {
        // تعبئة تاريخية دفعية: آخر 120 يومًا، revision=1، والتعارض يُتجاهل (قيمة اليوم المتغيرة تمر عبر upsertObservation أعلاه)
        const hist = (await fetchFxHistory(code)).slice(-120);
        seen += hist.length;
        if (hist.length) {
          const inserted = await db.insert(observations).values(hist.map((h) => ({
            seriesId: s.id, period: h.date, revision: 1, value: String(h.rate),
            sourceLabel: nameAr, sourceRef: "op=exchangeHistoryByCode",
          }))).onConflictDoNothing().returning({ p: observations.period });
          fresh += inserted.length;
        }
      } catch { /* التاريخ اختياري؛ سعر اليوم كافٍ */ }
    }
    return { seen, fresh };
  });
}

export async function ingestSamaNews() {
  const src = await ensureSource();
  const ds = await ensureDataset(src.id, "sama.news", "بيانات البنك المركزي وأخباره", "SAMA official news", "daily");
  return runWithLog(ds.id, async () => {
    const items = await fetchSamaNews();
    let fresh = 0;
    for (const n of items) {
      const r = await db.insert(schema.officialNews).values({
        sourceId: src.id, title: n.title, summary: n.summary || null, url: n.url, publishedAt: new Date(n.publishedAt),
      }).onConflictDoNothing().returning();
      if (r.length) fresh++;
    }
    return { seen: items.length, fresh };
  });
}

export async function ingestAll() {
  const results: Record<string, unknown> = {};
  for (const [name, fn] of [["sama.indicators", ingestSamaIndicators], ["sama.fx", ingestSamaFx], ["sama.news", ingestSamaNews]] as const) {
    try { results[name] = await fn(); } catch (e) { results[name] = { error: e instanceof Error ? e.message : String(e) }; }
  }
  return results;
}
