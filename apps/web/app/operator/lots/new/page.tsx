"use client";
import { useActionState } from "react";
import { createLot } from "./actions";
import { CATEGORIES, CITIES } from "../../../../lib/lot-schema";

export default function NewLot() {
  const [state, action, pending] = useActionState(createLot, {});
  const f = { display: "grid", gap: 4, fontWeight: 700 } as const;
  return (
    <main className="shell">
      <div className="top"><h1>➕ Add a lot</h1><p>It goes live after a platform admin approves it.</p></div>
      <form action={action} className="card lift" style={{ display: "grid", gap: 12 }}>
        <label style={f}>Name<input name="name" required minLength={3} /></label>
        <label style={f}>City<select name="city">{CITIES.map((c) => <option key={c}>{c}</option>)}</select></label>
        <label style={f}>Address<input name="address" /></label>
        <label style={f}>Category<select name="category">{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></label>
        <label style={f}>Latitude<input name="lat" type="number" step="any" required /></label>
        <label style={f}>Longitude<input name="lng" type="number" step="any" required /></label>
        <label style={f}>Car capacity<input name="carCapacity" type="number" min={1} required /></label>
        <label style={f}>Reservable share (%)<input name="reservablePct" type="number" min={0} max={100} defaultValue={20} /></label>
        <label style={f}>Base rate (₹ per hour)<input name="baseRupeesPerHour" type="number" min={1} step="0.5" defaultValue={60} /></label>
        <button disabled={pending} type="submit" className="btn blue block">{pending ? "Saving…" : "Create draft lot"}</button>
        {state.error && <p role="alert" className="err">{state.error}</p>}
      </form>
    </main>
  );
}
