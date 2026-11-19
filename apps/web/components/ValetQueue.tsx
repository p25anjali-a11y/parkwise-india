"use client";
import { useRouter } from "next/navigation";
import { useT } from "./I18n";

export type ValetRow = { id: string; status: string; note: string | null; lot: string; arrival: string };

export function ValetQueue({ rows }: { rows: ValetRow[] }) {
  const { t } = useT();
  const router = useRouter();
  async function set(id: string, status: "accepted" | "done") {
    await fetch("/api/valet", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status }) });
    router.refresh();
  }
  if (rows.length === 0) return <p className="muted">{t("noValet")}</p>;
  return (
    <div>
      {rows.map((r) => (
        <div key={r.id} className="rowb" style={{ marginBottom: 10 }}>
          <span><strong>{r.lot}</strong><br /><span className="muted">{r.arrival}{r.note ? ` · ${r.note}` : ""}</span><br /><span className="pill demo">{r.status}</span></span>
          <span className="chips">
            {r.status === "requested" && <button type="button" className="chip on" onClick={() => set(r.id, "accepted")}>{t("accept")}</button>}
            {r.status !== "done" && <button type="button" className="chip" onClick={() => set(r.id, "done")}>{t("markDone")}</button>}
          </span>
        </div>
      ))}
    </div>
  );
}
