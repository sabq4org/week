/** أسعار الصرف الرسمية من ساما (ريال لكل وحدة) — يومية أيام العمل. */
import { parseSamaNumber, portalHandlerUrl, samaGetJson } from "./client";

export interface FxRate { code: string; nameAr: string; rate: number; prevRate: number | null; date: string; prevDate: string | null }
interface RawFx { CurrencyCode?: string; Title?: string; CurrencyRate?: number; PrevRate?: number; PrevDate?: string | null; CurrencyDate?: string }

export const FX_CODES = ["USD", "EUR", "GBP", "AED", "KWD", "EGP", "INR", "JPY", "CNY"] as const;

/** أسماء عربية موحّدة (ساما تكتب «جنية استرليني») */
export const FX_NAMES_AR: Record<string, string> = {
  USD: "الدولار الأمريكي", EUR: "اليورو", GBP: "الجنيه الإسترليني", AED: "الدرهم الإماراتي",
  KWD: "الدينار الكويتي", EGP: "الجنيه المصري", INR: "الروبية الهندية", JPY: "الين الياباني", CNY: "اليوان الصيني",
};

function isoDay(raw: string | null | undefined): string | null {
  const m = raw ? String(raw).match(/^(\d{4}-\d{2}-\d{2})/) : null;
  return m ? m[1] : null;
}

export async function fetchFxToday(): Promise<FxRate[]> {
  const raw = await samaGetJson<unknown>(portalHandlerUrl({ op: "exchangeRates", isArabic: true, limt: 100 }));
  if (!Array.isArray(raw)) throw new Error("SAMA fx: response is not an array");
  const out: FxRate[] = []; const seen = new Set<string>();
  for (const it of raw as RawFx[]) {
    const code = String(it.CurrencyCode ?? "").replace(/=+$/, "").trim().toUpperCase();
    const rate = parseSamaNumber(it.CurrencyRate); const date = isoDay(it.CurrencyDate);
    if (!code || rate === null || rate <= 0 || !date || date.startsWith("0001") || seen.has(code)) continue;
    seen.add(code);
    const prev = parseSamaNumber(it.PrevRate);
    out.push({ code, nameAr: String(it.Title ?? "").trim(), rate, prevRate: prev && prev > 0 ? prev : null, date, prevDate: isoDay(it.PrevDate) });
  }
  if (!out.some((r) => r.code === "USD")) throw new Error("SAMA fx: USD missing — shape changed?");
  return out;
}

/** تاريخ عملة يوميًا من ساما — تصاعديًا. */
export async function fetchFxHistory(code: string): Promise<{ date: string; rate: number }[]> {
  const raw = await samaGetJson<unknown>(portalHandlerUrl({ op: "exchangeHistoryByCode", curr: `${code}=` }));
  if (!Array.isArray(raw)) throw new Error(`SAMA fx history ${code}: not an array`);
  const out: { date: string; rate: number }[] = [];
  for (const it of raw as { CurrencyRate?: number; CurrencyDate?: string }[]) {
    const rate = parseSamaNumber(it.CurrencyRate); const date = isoDay(it.CurrencyDate);
    if (rate === null || rate <= 0 || !date || date.startsWith("0001")) continue;
    out.push({ date, rate });
  }
  out.sort((a, b) => a.date.localeCompare(b.date));
  return out.filter((p, i) => i === 0 || p.date !== out[i - 1].date);
}
