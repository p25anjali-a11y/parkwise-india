import { redirect } from "next/navigation";
import { hasSupabaseEnv } from "../lib/env";
import { homeFor, type Role } from "../lib/roles";
import { supabaseServer } from "../lib/supabase/server";

export const dynamic = "force-dynamic";

/** First screen is the sign-in (driver or operator). Signed-in people go to their own home: drivers to Find parking. */
export default async function Home() {
  if (!hasSupabaseEnv()) redirect("/login");
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");
  const { data: me } = await sb.from("profiles").select("role").eq("id", user.id).maybeSingle();
  redirect(homeFor((me?.role as Role) ?? "driver"));
}
