import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { canAccess, homeFor, type Role } from "./lib/roles";

const AREAS = {
  "/driver": "driver", "/operator": "operator", "/admin": "admin",
  "/search": "find", "/lots": "find", "/trip": "find", "/rewards": "find", "/live": "find",
} as const;

export async function middleware(req: NextRequest) {
  let res = NextResponse.next({ request: req });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return res; // unconfigured preview: pages show a setup notice

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (list) => {
        for (const c of list) req.cookies.set(c.name, c.value);
        res = NextResponse.next({ request: req });
        for (const c of list) res.cookies.set(c.name, c.value, c.options);
      },
    },
  });

  const { data } = await supabase.auth.getUser();
  const path = req.nextUrl.pathname;
  const area = (Object.keys(AREAS) as (keyof typeof AREAS)[]).find((p) => path === p || path.startsWith(p + "/"));
  if (!area) return res;

  if (!data.user) {
    const to = req.nextUrl.clone();
    to.pathname = "/login";
    to.search = `?next=${encodeURIComponent(path)}`;
    return NextResponse.redirect(to);
  }
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", data.user.id).maybeSingle();
  if (!canAccess((profile?.role as Role) ?? null, AREAS[area])) {
    const to = req.nextUrl.clone();
    to.pathname = homeFor((profile?.role as Role) ?? null);
    to.search = "";
    return NextResponse.redirect(to);
  }
  return res;
}

export const config = { matcher: ["/driver/:path*", "/operator/:path*", "/admin/:path*", "/search/:path*", "/lots/:path*", "/trip/:path*", "/rewards/:path*", "/live/:path*"] };
