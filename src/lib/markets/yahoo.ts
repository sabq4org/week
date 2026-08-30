/**
 * أسعار السوق اليومية (تاسي، برنت، الذهب) من واجهة الرسم العامة في Yahoo Finance.
 * غير رسمية ومؤجلة ~15 دقيقة — تُعرض بهذا الوسم، وتُخزَّن كإغلاقات يومية.
 */
export interface MarketDef {
  code: string; symbol: string; titleAr: string; shortAr: string; unit: string;
  definitionAr: string; direction: "neutral" | "up_good";
}
export const MARKET_DEFS: MarketDef[] = [
  { code: "mkt.tasi", symbol: "^TASI.SR", titleAr: "مؤشر السوق السعودية (تاسي)", shortAr: "تاسي", unit: "نقطة",
    definitionAr: "مؤشر جميع الأسهم السعودية — إغلاقات يومية، بيانات مؤجلة نحو ربع ساعة.", direction: "up_good" },
  { code: "mkt.brent", symbol: "BZ=F", titleAr: "خام برنت", shortAr: "برنت", unit: "USD",
    definitionAr: "العقود الآجلة لخام برنت بالدولار للبرميل.", direction: "neutral" },
  { code: "mkt.gold", symbol: "GC=F", titleAr: "الذهب", shortAr: "الذهب", unit: "USD",
    definitionAr: "العقود الآجلة للذهب بالدولار للأونصة.", direction: "neutral" },
];

export interface MarketQuote { def: MarketDef; points: { date: string; value: number }[] }

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36";

interface YahooChart {
  chart?: { result?: { timestamp?: number[]; meta?: { regularMarketPrice?: number; regularMarketTime?: number; chartPreviousClose?: number };
    indicators?: { quote?: { close?: (number | null)[] }[] } }[] };
}

/** يجرّب مدى أضيق تلقائيًا — بعض الرموز (تاسي) لا تعيد تاريخًا على المدى الطويل. */
export async function fetchMarketWithFallback(def: MarketDef): Promise<MarketQuote> {
  const ranges = ["6mo", "3mo", "1mo", "5d"];
  let lastErr: unknown;
  for (const r of ranges) {
    try { return await fetchMarket(def, r); } catch (e) { lastErr = e; }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

export async function fetchMarket(def: MarketDef, range = "6mo"): Promise<MarketQuote> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(def.symbol)}?range=${range}&interval=1d`;
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" }, signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`yahoo ${def.symbol}: HTTP ${res.status}`);
  const j = (await res.json()) as YahooChart;
  const r = j.chart?.result?.[0];
  const ts = r?.timestamp ?? [];
  const closes = r?.indicators?.quote?.[0]?.close ?? [];
  const points: { date: string; value: number }[] = [];
  for (let i = 0; i < ts.length; i++) {
    const v = closes[i];
    if (v === null || v === undefined || !Number.isFinite(v)) continue;
    points.push({ date: new Date(ts[i] * 1000).toISOString().slice(0, 10), value: Number(v.toFixed(2)) });
  }
  const live = r?.meta?.regularMarketPrice; const liveTs = r?.meta?.regularMarketTime;
  if (live && liveTs) {
    const d = new Date(liveTs * 1000).toISOString().slice(0, 10);
    const last = points[points.length - 1];
    if (!last || last.date < d) points.push({ date: d, value: Number(live.toFixed(2)) });
    else if (last.date === d) last.value = Number(live.toFixed(2));
  }
  // بعض الرموز (تاسي) لا تعيد تاريخًا — نصنع نقطة الأمس من إغلاق الجلسة السابقة،
  // ويتراكم التاريخ الحقيقي مع الجلب اليومي.
  if (points.length === 1 && r?.meta?.chartPreviousClose) {
    const d = new Date(new Date(points[0].date + "T00:00:00Z").getTime() - 86400000).toISOString().slice(0, 10);
    points.unshift({ date: d, value: Number(r.meta.chartPreviousClose.toFixed(2)) });
  }
  if (points.length < 2) throw new Error(`yahoo ${def.symbol}: empty series`);
  return { def, points };
}
