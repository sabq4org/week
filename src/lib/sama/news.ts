/** أخبار البنك المركزي الرسمية — القائمة نفسها التي تعرضها رئيسية ساما. */
import { portalHandlerUrl, samaGetJson } from "./client";

export interface SamaNewsItem { title: string; summary: string; url: string; publishedAt: string }

interface RawNews { Title?: string; Comments?: string; LinkFilename?: string; FilterPublishingDate?: string; SAMAPublishingDate?: string }

export async function fetchSamaNews(): Promise<SamaNewsItem[]> {
  const url = portalHandlerUrl({
    op: "LoadItems", listUrl: "/ar-sa/MediaCenter/News/Pages", viewName: "HomeNews",
    lang: "ar", calType: "miladi", df: "dd/MM/yyyy",
  });
  const raw = await samaGetJson<unknown>(url);
  if (!Array.isArray(raw)) throw new Error("SAMA news: response is not an array");
  const out: SamaNewsItem[] = [];
  for (const it of raw as RawNews[]) {
    const title = String(it.Title ?? "").trim();
    const file = String(it.LinkFilename ?? "").trim();
    // FilterPublishingDate: MM/dd/yyyy HH:mm:ss
    const m = String(it.FilterPublishingDate ?? "").match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?/);
    if (!title || !file || !m) continue;
    const iso = `${m[3]}-${m[1]}-${m[2]}T${m[4] ?? "12"}:${m[5] ?? "00"}:00+03:00`;
    out.push({
      title,
      summary: String(it.Comments ?? "").trim(),
      url: `https://www.sama.gov.sa/ar-sa/MediaCenter/News/Pages/${file}`,
      publishedAt: iso,
    });
  }
  if (!out.length) throw new Error("SAMA news: no parseable items");
  return out;
}
