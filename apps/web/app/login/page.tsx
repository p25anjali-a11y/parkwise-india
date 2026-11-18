"use client";
import { useState } from "react";
import { supabaseBrowser } from "../../lib/supabase/browser";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"in" | "up">("in");
  const [msg, setMsg] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    const sb = supabaseBrowser();
    const { error } =
      mode === "in"
        ? await sb.auth.signInWithPassword({ email, password })
        : await sb.auth.signUp({ email, password });
    if (error) return setMsg(error.message);
    if (mode === "up") return setMsg("Check your email to confirm your account, then sign in.");
    const next = new URLSearchParams(window.location.search).get("next");
    window.location.href = next && next.startsWith("/") ? next : "/driver";
  }

  return (
    <main style={{ maxWidth: 360, margin: "64px auto", padding: 16 }}>
      <h1>{mode === "in" ? "Sign in" : "Create account"}</h1>
      <form onSubmit={submit} style={{ display: "grid", gap: 12 }}>
        <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input type="password" placeholder="Password (min 8 chars)" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required />
        <button type="submit">{mode === "in" ? "Sign in" : "Sign up"}</button>
      </form>
      <p style={{ color: "#b00" }}>{msg}</p>
      <button onClick={() => setMode(mode === "in" ? "up" : "in")} style={{ background: "none", border: 0, textDecoration: "underline", cursor: "pointer" }}>
        {mode === "in" ? "New here? Create an account" : "Have an account? Sign in"}
      </button>
    </main>
  );
}
