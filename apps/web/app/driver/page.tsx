import { hasSupabaseEnv } from "../../lib/env";
import { supabaseServer } from "../../lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function Page() {
  if (!hasSupabaseEnv()) return <main style={{ padding: 24 }}>Supabase is not configured for this deployment.</main>;
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  const { data: profile } = await sb.from("profiles").select("role").eq("id", user?.id ?? "").maybeSingle();
  return (
    <main style={{ padding: 24 }}>
      <h1>Driver area</h1>
      <p>Signed in as {user?.email} (role: {profile?.role ?? "unknown"}).</p>
      <form action="/auth/signout" method="post"><button type="submit">Sign out</button></form>
    </main>
  );
}
