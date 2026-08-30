/**
 * المؤشرات الخمسة التي تعرضها صفحة ساما الرئيسية + سلاسلها التاريخية.
 * المصدر: PortalHandler.ashx (op=getMultiListItems / op=LoadItems&viewName=Chart).
 */
import { parseSamaDate, parseSamaNumber, portalHandlerUrl, samaGetJson } from "./client";

export const SAMA_INDICATOR_KEYS = ["repo", "reverseRepo", "inflation", "gdp", "m3Growth"] as const;
export type SamaIndicatorKey = (typeof SAMA_INDICATOR_KEYS)[number];

export interface IndicatorDef {
  key: SamaIndicatorKey;
  metricCode: string;
  listUrl: string;
  valueField: string;
  dateField: string;
  titleAr: string;
  titleEn: string;
  shortAr: string;
  definitionAr: string;
  unit: "%";
  frequency: "decision" | "monthly" | "quarterly";
  direction: "up_good" | "up_bad" | "neutral";
  expectedGapDays: number;
  stripOrder: number;
}

export const INDICATOR_DEFS: Record<SamaIndicatorKey, IndicatorDef> = {
  inflation: {
    key: "inflation", metricCode: "sama.inflation",
    listUrl: "/ar-sa/Statistics/Indices/Lists/InflationRate",
    valueField: "SAMAInflationRate", dateField: "SAMALastUpdatedDate",
    titleAr: "معدل التضخم السنوي", titleEn: "Annual inflation rate", shortAr: "التضخم السنوي",
    definitionAr: "التغير السنوي في الرقم القياسي لأسعار المستهلك كما ينشره البنك المركزي نقلًا عن الهيئة العامة للإحصاء.",
    unit: "%", frequency: "monthly", direction: "up_bad", expectedGapDays: 45, stripOrder: 1,
  },
  m3Growth: {
    key: "m3Growth", metricCode: "sama.m3_growth",
    listUrl: "/ar-sa/Statistics/Indices/Lists/MoneySupply",
    valueField: "SAMAMoneySupplyRate", dateField: "SAMALastUpdatedDate",
    titleAr: "نمو عرض النقود (ن3) السنوي", titleEn: "Money supply (M3) growth, y/y", shortAr: "نمو عرض النقود ن3",
    definitionAr: "التغير السنوي في عرض النقود بتعريفه الواسع (ن3).",
    unit: "%", frequency: "monthly", direction: "neutral", expectedGapDays: 45, stripOrder: 2,
  },
  repo: {
    key: "repo", metricCode: "sama.repo",
    listUrl: "/ar-sa/MonetaryPolicy/Lists/OfficialRepoRate",
    valueField: "SAMAOfficialRepoRate", dateField: "SAMAPublishDate",
    titleAr: "معدل اتفاقية إعادة الشراء (الريبو)", titleEn: "Official repo rate", shortAr: "الريبو",
    definitionAr: "سعر الفائدة الرئيس الذي يقرض به البنك المركزي البنوك المحلية.",
    unit: "%", frequency: "decision", direction: "neutral", expectedGapDays: 0, stripOrder: 3,
  },
  reverseRepo: {
    key: "reverseRepo", metricCode: "sama.reverse_repo",
    listUrl: "/ar-sa/MonetaryPolicy/Lists/ReverseRepoRate",
    valueField: "SAMAReverseRepoRate", dateField: "SAMAPublishDate",
    titleAr: "معدل اتفاقية إعادة الشراء المعاكس", titleEn: "Reverse repo rate", shortAr: "الريبو العكسي",
    definitionAr: "سعر الفائدة الذي يودع به البنوك فوائضها لدى البنك المركزي.",
    unit: "%", frequency: "decision", direction: "neutral", expectedGapDays: 0, stripOrder: 4,
  },
  gdp: {
    key: "gdp", metricCode: "sama.gdp_growth",
    listUrl: "/ar-sa/Statistics/Indices/Lists/GrossDomesticIncome",
    valueField: "SAMAGDPRate", dateField: "SAMALastUpdatedDate",
    titleAr: "نمو الناتج المحلي الإجمالي (سنوي)", titleEn: "Real GDP growth, y/y", shortAr: "نمو الناتج المحلي",
    definitionAr: "النمو الحقيقي السنوي للناتج المحلي الإجمالي للربع الأخير المنشور.",
    unit: "%", frequency: "quarterly", direction: "up_good", expectedGapDays: 110, stripOrder: 5,
  },
};

export interface IndicatorSnapshot {
  key: SamaIndicatorKey;
  value: number;
  valueText: string;
  samaTitle: string;
  asOf: string | null;
  sourceId: number | null;
}
export interface IndicatorPoint { date: string; value: number; label?: string }

interface RawMultiItem { Id?: number; ListUrl?: string; Title?: string; Rate?: string; LastUpdateDate?: string }

const LIST_TO_KEY: Record<string, SamaIndicatorKey> = Object.fromEntries(
  SAMA_INDICATOR_KEYS.map((k) => [INDICATOR_DEFS[k].listUrl.toLowerCase(), k]),
) as Record<string, SamaIndicatorKey>;

export async function fetchIndicatorSnapshots(): Promise<IndicatorSnapshot[]> {
  const url = portalHandlerUrl({
    op: "getMultiListItems",
    listsUrl: SAMA_INDICATOR_KEYS.map((k) => INDICATOR_DEFS[k].listUrl).join(","),
    viewName: "Home", lang: "ar",
  });
  const raw = await samaGetJson<unknown>(url);
  if (!Array.isArray(raw)) throw new Error("SAMA indicators: response is not an array");
  const out: IndicatorSnapshot[] = [];
  for (const item of raw as RawMultiItem[]) {
    const key = LIST_TO_KEY[String(item.ListUrl || "").toLowerCase()];
    if (!key) continue;
    const value = parseSamaNumber(item.Rate);
    if (value === null) continue;
    out.push({
      key, value,
      valueText: String(item.Rate ?? "").trim(),
      samaTitle: String(item.Title ?? "").trim(),
      asOf: parseSamaDate(item.LastUpdateDate),
      sourceId: typeof item.Id === "number" ? item.Id : null,
    });
  }
  const missing = SAMA_INDICATOR_KEYS.filter((k) => !out.some((o) => o.key === k));
  if (missing.length) throw new Error(`SAMA indicators: missing ${missing.join(",")}`);
  return out;
}

export async function fetchIndicatorSeries(key: SamaIndicatorKey): Promise<IndicatorPoint[]> {
  const def = INDICATOR_DEFS[key];
  const url = portalHandlerUrl({ op: "LoadItems", listUrl: def.listUrl, viewName: "Chart" });
  const raw = await samaGetJson<unknown>(url);
  if (!Array.isArray(raw)) throw new Error(`SAMA series ${key}: response is not an array`);
  const points: IndicatorPoint[] = [];
  for (const row of raw as Record<string, unknown>[]) {
    const value = parseSamaNumber(row[def.valueField]);
    const date = parseSamaDate(String(row[def.dateField] ?? ""));
    if (value === null || !date) continue;
    points.push({ date, value, label: typeof row.Title === "string" ? row.Title.trim() : undefined });
  }
  points.sort((a, b) => a.date.localeCompare(b.date));
  return points.filter((p, i) => i === 0 || p.date !== points[i - 1].date);
}
