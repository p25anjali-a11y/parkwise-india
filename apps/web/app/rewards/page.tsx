import Link from "next/link";
import { headers } from "next/headers";
import { ClaimReferral } from "../../components/ClaimReferral";
import { ShareReferral } from "../../components/ShareReferral";
import { hasSupabaseEnv } from "../../lib/env";
import { getLang } from "../../lib/lang";
import { REFERRAL_GET_PAISE, REFERRAL_GIVE_PAISE, REFERRAL_MIN_BOOKING_PAISE, referralLink, rupees } from "../../lib/referral";
import { supabaseAdmin } from "../../lib/supabase/admin";
import { supabaseServer } from "../../lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function Rewards() {
  const { t } = await getLang();
  if (!hasSupabaseEnv()) return <main className="shell"><div className="card">Supabase is not configured for this deployment.</div></main>;
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  const steps = [["01", "refStep1", "refStep1s"], ["02", "refStep2", "refStep2s"], ["03", "refStep3", "refStep3s"]] as const;
  const how = (
    <>
      <h2 style={{ margin: "8px 0 10px" }}>{t("howTitle")}</h2>
      {steps.map(([n, a, b]) => (
        <div key={a} className="card step"><span className="num">{n}</span><div><h3 style={{ marginBottom: 2 }}>{t(a, { give: rupees(REFERRAL_GIVE_PAISE), get: rupees(REFERRAL_GET_PAISE) })}</h3><div className="muted">{t(b, { min: rupees(REFERRAL_MIN_BOOKING_PAISE) })}</div></div></div>
      ))}
    </>
  );
  const head = <div className="top"><h1>{t("rewardsTitle")}</h1><p>{t("rewardsSub", { give: rupees(REFERRAL_GIVE_PAISE), get: rupees(REFERRAL_GET_PAISE) })}</p></div>;
  if (!user) {
    return (
      <main className="shell">
        {head}
        <div className="card lift"><p style={{ marginTop: 0 }}>{t("rewardsSignIn")}</p><Link href="/login?next=/rewards" className="btn block">{t("signIn")}</Link></div>
        {how}
      </main>
    );
  }
  const admin = supabaseAdmin();
  const { data: code } = admin ? await admin.rpc("get_or_create_referral_code", { p_user: user.id }) : { data: null };
  const [{ data: ledger, error: e1 }, { data: refs }] = await Promise.all([
    sb.from("wallet_ledger").select("amount_paise,reason,created_at").order("created_at", { ascending: false }).limit(20),
    sb.from("referrals").select("id,status,created_at,referrer_id").eq("referrer_id", user.id).order("created_at", { ascending: false }).limit(50),
  ]);
  const unavailable = !!e1; // migration 0010 not applied on this database yet
  const balance = (ledger ?? []).reduce((n, r) => n + r.amount_paise, 0);
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host") ?? "localhost:3000"}`;
  return (
    <main className="shell">
      {head}
      <ClaimReferral />
      {unavailable || !code ? (
        <div className="card lift" role="note">{t("rewardsOff")}</div>
      ) : (
        <>
          <div className="card lift"><ShareReferral code={code as string} link={referralLink(origin, code as string)} text={t("shareInviteText", { get: rupees(REFERRAL_GET_PAISE) })} /></div>
          <div className="card">
            <h2>{t("walletTitle")}</h2>
            <div className="wallet" data-testid="wallet">{rupees(balance)}</div>
            <p className="muted" style={{ marginBottom: 0 }}>{t("walletNote")}</p>
          </div>
          <div className="card" data-testid="invites">
            <h2>{t("invitesTitle")}</h2>
            {(refs ?? []).length === 0 && <p className="muted" style={{ margin: 0 }}>{t("noInvites")}</p>}
            {(refs ?? []).map((r, i) => (
              <div className="rowb" key={r.id} style={{ marginBottom: 8 }}>
                <span>{t("friendN", { n: (refs ?? []).length - i })} <span className="muted">· {new Date(r.created_at).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}</span></span>
                <span className={`pill ${r.status === "rewarded" ? "green" : "grey"}`}>{r.status === "rewarded" ? t("refRewarded") : t("refSignedUp")}</span>
              </div>
            ))}
          </div>
        </>
      )}
      {how}
    </main>
  );
}
