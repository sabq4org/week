import { NextResponse } from "next/server";
import { db, schema } from "@/db";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  const email = String(form?.get("email") ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.redirect(new URL("/?subscribed=invalid", req.url), 303);
  }
  await db.insert(schema.subscribers).values({ email }).onConflictDoNothing();
  return NextResponse.redirect(new URL("/?subscribed=1", req.url), 303);
}
