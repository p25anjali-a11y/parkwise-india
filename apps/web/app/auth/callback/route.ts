import { NextResponse } from "next/server";
import { configuredOr503 } from "../../../lib/env";
import { supabaseServer } from "../../../lib/supabase/server";

/** Email links (password reset) land here with a one-time code; swap it for a session, then go to a fixed in-app page. */
export async function GET(req: Request) {
  const off = configuredOr503();
  if (off) return off;
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") === "/auth/reset" ? "/auth/reset" : "/login";
  if (code) {
    const sb = await supabaseServer();
    const { error } = await sb.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
  }
  return NextResponse.redirect(new URL("/auth/reset?expired=1", url.origin));
}
