export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ status: "ok", service: "parkwise-web", time: new Date().toISOString() });
}
