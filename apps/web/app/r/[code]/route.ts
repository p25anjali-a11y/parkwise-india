import { NextResponse } from "next/server";
import { normaliseCode, REF_COOKIE } from "../../../lib/referral";

/** Invite link: remember the code for 7 days (readable by the page so it can claim after sign-up), then go to sign-up. */
export async function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const code = normaliseCode((await params).code);
  const to = new URL(code ? "/login?mode=up" : "/login", req.url);
  const res = NextResponse.redirect(to);
  if (code) res.cookies.set(REF_COOKIE, code, { path: "/", maxAge: 7 * 86_400, sameSite: "lax", httpOnly: false, secure: new URL(req.url).protocol === "https:" });
  return res;
}
