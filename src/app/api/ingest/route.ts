import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { ingestAll } from "@/ingest/sama";
import { ingestMarkets } from "@/ingest/markets";
import { ingestMonthlyBulletin, ingestPosWeekly } from "@/ingest/reports";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

function authorized(req: Request) {
  const secret = process.env.INGEST_SECRET;
  if (!secret) return false;
  const h = req.headers.get("authorization") ?? "";
  const q = new URL(req.url).searchParams.get("key") ?? "";
  return h === `Bearer ${secret}` || q === secret;
}

export async function POST(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const results = await ingestAll();
  const r = results as Record<string, unknown>;
  try { r["markets"] = await ingestMarkets(); } catch (e) { r["markets"] = { error: String(e) }; }
  try { r["pos_weekly"] = await ingestPosWeekly(); } catch (e) { r["pos_weekly"] = { error: String(e) }; }
  try { r["bulletin"] = await ingestMonthlyBulletin(); } catch (e) { r["bulletin"] = { error: String(e) }; }
  revalidatePath("/");
  return NextResponse.json({ ok: true, results });
}
export const GET = POST;
