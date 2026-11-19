import Link from "next/link";
import { Mascot } from "../components/Mascot";
import { LangSwitch } from "../components/I18n";
import { getLang } from "../lib/lang";

export default async function Home() {
  const { t } = await getLang();
  return (
    <main className="shell">
      <div className="top">
        <div className="row">
          <Mascot size={80} />
          <div>
            <h1>Parkwise India</h1>
            <p>{t("heroTitle")}</p>
          </div>
        </div>
        <div style={{ marginTop: 14 }}><LangSwitch /></div>
      </div>
      <div className="card lift">
        <p style={{ marginTop: 0 }}>{t("heroSub")}</p>
        <div className="chips" style={{ marginBottom: 14 }}>
          <span className="pill green">{t("offPeak")}</span>
          <span className="pill orange">{t("standard")}</span>
          <span className="pill red">{t("peak")}</span>
        </div>
        <Link href="/search" className="btn blue block">{t("findParking")}</Link>
        <p style={{ textAlign: "center", marginBottom: 0 }}><Link href="/login">{t("signIn")}</Link></p>
      </div>
      <h2 style={{ margin: "8px 0 10px" }}>{t("howTitle")}</h2>
      {[["01", "how1", "how1s"], ["02", "how2", "how2s"], ["03", "how3", "how3s"]].map(([ico, a, b]) => (
        <div key={a} className="card step" >
          <span className="num">{ico}</span>
          <div><h3 style={{ marginBottom: 2 }}>{t(a!)}</h3><div className="muted">{t(b!)}</div></div>
        </div>
      ))}
      <Link href="/login" className="btn ghost block" style={{ marginTop: 6 }}>{t("iRunLot")}</Link>
    </main>
  );
}
