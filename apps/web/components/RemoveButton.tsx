"use client";
import { useRouter } from "next/navigation";
import { useT } from "./I18n";

export function RemoveButton({ url }: { url: string }) {
  const { t } = useT();
  const router = useRouter();
  return <button type="button" className="chip" onClick={async () => { await fetch(url, { method: "DELETE" }); router.refresh(); }}>{t("remove")}</button>;
}
