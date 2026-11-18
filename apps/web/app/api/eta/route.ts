import { NextResponse } from "next/server";
import { configuredOr503 } from "../../../lib/env";
import { limited } from "../../../lib/rate-limit";
import { z } from "zod";
import { selectRoutingProvider } from "@parkwise/providers";
import { supabaseServer } from "../../../lib/supabase/server";

const q = z.object({ lotId: z.string().uuid(), lat: z.coerce.number().min(-90).max(90), lng: z.coerce.number().min(-180).max(180) });

export async function GET(req: Request) {
  const unconfigured = configuredOr503();
  if (unconfigured) return unconfigured;
  const tooMany = limited(req, "eta", 30);
  if (tooMany) return tooMany;
  const p = q.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!p.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const sb = await supabaseServer();
  const { data: lot } = await sb.from("lots").select("lat,lng").eq("id", p.data.lotId).eq("status", "approved").maybeSingle();
  if (!lot) return NextResponse.json({ error: "not found" }, { status: 404 });
  const { provider } = selectRoutingProvider(process.env);
  const eta = await provider.eta({ lat: p.data.lat, lng: p.data.lng }, { lat: lot.lat, lng: lot.lng });
  return NextResponse.json(eta);
}
