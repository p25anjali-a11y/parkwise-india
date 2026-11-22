"use client";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "./supabase/browser";

/** True when the signed-in account is an operator (so the driver screens can offer a way back to the console). UI only; the server decides access. */
export function useCanOperate(): boolean {
  const [yes, setYes] = useState(false);
  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const sb = supabaseBrowser();
        const { data: { user } } = await sb.auth.getUser();
        if (!user) return;
        const { data: p } = await sb.from("profiles").select("role").eq("id", user.id).maybeSingle();
        if (live && (p?.role === "operator" || p?.role === "operator_admin")) setYes(true);
      } catch { /* not configured */ }
    })();
    return () => { live = false; };
  }, []);
  return yes;
}
