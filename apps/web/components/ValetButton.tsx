"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "./I18n";

export function ValetButton({ reservationId, valet }: { reservationId: string; valet?: { id: string; status: string } | null }) {
  const { t } = useT();
  const router = useRouter();
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState("");
  async function ask() {
    const r = await fetch("/api/valet", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reservationId, note: note || undefined }) });
    if (r.ok) router.refresh(); else setMsg((await r.json()).error ?? "Error");
  }
  async function cancel() { await fetch(`/api/valet?id=${valet!.id}`, { method: "DELETE" }); router.refresh(); }
  if (valet) {
    const key = valet.status === "accepted" ? "valetAccepted" : valet.status === "done" ? "valetDone" : "valetRequested";
    return (
      <div data-testid="valet" style={{ marginTop: 10 }}>
        <span className={`pill ${valet.status === "done" ? "green" : valet.status === "accepted" ? "orange" : "demo"}`}>{t(key)}</span>{" "}
        {valet.status === "requested" && <button type="button" className="chip" onClick={cancel}>{t("valetCancel")}</button>}
      </div>
    );
  }
  return (
    <div data-testid="valet" style={{ marginTop: 10 }}>
      <label className="f">{t("valetNote")}<input value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} /></label>
      <button type="button" className="btn ghost block" onClick={ask}>{t("valetAsk")}</button>
      <p className="muted" style={{ marginBottom: 0 }}>{t("valetHint")}</p>
      {msg && <p role="alert" className="err">{msg}</p>}
    </div>
  );
}
