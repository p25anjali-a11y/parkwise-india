import Link from "next/link";
import { JoinOperator } from "../../components/JoinOperator";
import { CITIES } from "../../lib/lot-schema";
import { getLang } from "../../lib/lang";
import { redirect } from "next/navigation";
import { hasSupabaseEnv } from "../../lib/env";
import { supabaseServer } from "../../lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function Join() {
  const { t } = await getLang();
  if (hasSupabaseEnv()) {
    const { data: { user } } = await (await supabaseServer()).auth.getUser();
    if (!user) redirect("/login?next=/become-operator");
  }
  return (
    <main className="shell">
      <div className="top"><h1>🏢 {t("joinTitle")}</h1><p>{t("joinSub")}</p></div>
      <div className="card lift"><JoinOperator cities={CITIES} /></div>
      <p style={{ textAlign: "center" }}><Link href="/driver">← {t("switchDriver")}</Link></p>
    </main>
  );
}
