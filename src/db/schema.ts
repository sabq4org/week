/**
 * Economy Week — نواة نموذج البيانات (الإصدار 0.1).
 * القاعدة الذهبية: كل رقم له مصدر ووقت جلب ومراجعة. القيم المُنقّحة تُسجَّل
 * كمراجعة جديدة ولا تُستبدل.
 */
import {
  pgTable, serial, text, integer, numeric, timestamp, date, jsonb, boolean, primaryKey, index, uniqueIndex,
} from "drizzle-orm/pg-core";

export const sources = pgTable("sources", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),           // sama, gastat, moj, tadawul
  nameAr: text("name_ar").notNull(),
  nameEn: text("name_en").notNull(),
  baseUrl: text("base_url").notNull(),
  license: text("license"),
  attribution: text("attribution"),
});

export const datasets = pgTable("datasets", {
  id: serial("id").primaryKey(),
  sourceId: integer("source_id").notNull().references(() => sources.id),
  code: text("code").notNull().unique(),           // sama.indicators, sama.fx
  titleAr: text("title_ar").notNull(),
  titleEn: text("title_en").notNull(),
  cadence: text("cadence").notNull(),              // daily | weekly | monthly | quarterly | decision
  status: text("status").notNull().default("active"),
  licenseRef: text("license_ref"),
});

export const ingestRuns = pgTable("ingest_runs", {
  id: serial("id").primaryKey(),
  datasetId: integer("dataset_id").notNull().references(() => datasets.id),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  status: text("status").notNull().default("running"), // running | ok | failed
  rowsSeen: integer("rows_seen").notNull().default(0),
  rowsNew: integer("rows_new").notNull().default(0),
  error: text("error"),
  schemaFingerprint: text("schema_fingerprint"),
}, (t) => [index("ingest_runs_dataset_started_idx").on(t.datasetId, t.startedAt)]);

export const metrics = pgTable("metrics", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),           // sama.repo, sama.inflation, fx.usd
  titleAr: text("title_ar").notNull(),
  titleEn: text("title_en").notNull(),
  shortAr: text("short_ar").notNull(),
  definitionAr: text("definition_ar"),
  unit: text("unit").notNull(),                    // % | SAR | index
  frequency: text("frequency").notNull(),          // daily | monthly | quarterly | decision
  aggregation: text("aggregation").notNull().default("last"),
  /** ترتيب الظهور في الشريط؛ null = لا يظهر */
  stripOrder: integer("strip_order"),
  /** كيف نقرأ الارتفاع: up_good | up_bad | neutral */
  direction: text("direction").notNull().default("neutral"),
  /** عدد الأيام المتوقع بين إصدارين — لاكتشاف التأخر */
  expectedGapDays: integer("expected_gap_days"),
});

export const series = pgTable("series", {
  id: serial("id").primaryKey(),
  datasetId: integer("dataset_id").notNull().references(() => datasets.id),
  metricId: integer("metric_id").notNull().references(() => metrics.id),
  code: text("code").notNull().unique(),
  dims: jsonb("dims").$type<Record<string, string>>().notNull().default({}),
  status: text("status").notNull().default("active"),
});

export const observations = pgTable("observations", {
  seriesId: integer("series_id").notNull().references(() => series.id),
  period: date("period").notNull(),
  revision: integer("revision").notNull().default(1),
  value: numeric("value", { precision: 20, scale: 6 }).notNull(),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
  sourceLabel: text("source_label"),
  sourceRef: text("source_ref"),
  qualityStatus: text("quality_status").notNull().default("ok"),
}, (t) => [
  primaryKey({ columns: [t.seriesId, t.period, t.revision] }),
  index("observations_series_period_idx").on(t.seriesId, t.period),
]);

export const events = pgTable("events", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(),                    // policy | release | shock
  occurredAt: date("occurred_at").notNull(),
  titleAr: text("title_ar").notNull(),
  titleEn: text("title_en"),
  sourceRef: text("source_ref"),
  confidence: text("confidence").notNull().default("confirmed"),
  metricCodes: jsonb("metric_codes").$type<string[]>().notNull().default([]),
});

export const stories = pgTable("stories", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  lang: text("lang").notNull().default("ar"),
  title: text("title").notNull(),
  dek: text("dek"),
  body: text("body"),
  whyItMatters: text("why_it_matters"),
  metricCodes: jsonb("metric_codes").$type<string[]>().notNull().default([]),
  aiDraft: boolean("ai_draft").notNull().default(false),
  reviewStatus: text("review_status").notNull().default("published"), // draft | published
  publishedAt: timestamp("published_at", { withTimezone: true }),
  issueId: integer("issue_id"),
}, (t) => [index("stories_published_idx").on(t.publishedAt)]);

export const issues = pgTable("issues", {
  id: serial("id").primaryKey(),
  number: integer("number").notNull().unique(),
  title: text("title").notNull(),
  dek: text("dek"),
  status: text("status").notNull().default("draft"),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  numberOfWeekLabel: text("number_of_week_label"),
  numberOfWeekValue: text("number_of_week_value"),
  numberOfWeekNote: text("number_of_week_note"),
  chartOfWeekNote: text("chart_of_week_note"),
  chartOfWeekMetric: text("chart_of_week_metric"),
});

export const subscribers = pgTable("subscribers", {
  id: serial("id").primaryKey(),
  email: text("email").notNull(),
  lang: text("lang").notNull().default("ar"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
}, (t) => [uniqueIndex("subscribers_email_idx").on(t.email)]);

export const officialNews = pgTable("official_news", {
  id: serial("id").primaryKey(),
  sourceId: integer("source_id").notNull().references(() => sources.id),
  title: text("title").notNull(),
  summary: text("summary"),
  url: text("url").notNull().unique(),
  publishedAt: timestamp("published_at", { withTimezone: true }).notNull(),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
  kind: text("kind").notNull().default("news"),
}, (t) => [index("official_news_published_idx").on(t.publishedAt)]);

/** تقارير نقاط البيع الأسبوعية — التقرير وحدة واحدة (قطاعات + مدن) لا سلسلة. */
export const posReports = pgTable("pos_reports", {
  id: serial("id").primaryKey(),
  weekStart: date("week_start").notNull(),
  weekEnd: date("week_end").notNull().unique(),
  labelAr: text("label_ar").notNull(),
  totalValueThousands: numeric("total_value_thousands", { precision: 20, scale: 2 }).notNull(),
  totalCountThousands: numeric("total_count_thousands", { precision: 20, scale: 2 }).notNull(),
  weeklyValueChangePct: numeric("weekly_value_change_pct", { precision: 8, scale: 2 }).notNull(),
  weeklyCountChangePct: numeric("weekly_count_change_pct", { precision: 8, scale: 2 }).notNull(),
  activities: jsonb("activities").$type<{ en: string; ar: string; v: number; dv: number; isGroup?: boolean; group?: string }[]>().notNull(),
  cities: jsonb("cities").$type<{ en: string; ar: string; v: number; dv: number }[]>().notNull(),
  sourceUrl: text("source_url").notNull(),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("pos_reports_week_idx").on(t.weekEnd)]);
