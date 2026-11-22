import { expect, test } from "@playwright/test";

test("health endpoint answers", async ({ request }) => {
  const r = await request.get("/api/health");
  expect(r.ok()).toBe(true);
  expect(await r.json()).toMatchObject({ status: "ok", service: "parkwise-web" });
});

test("first page is the sign-in with a driver / operator choice", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole("button", { name: "I'm a driver" })).toBeVisible();
  await expect(page.getByRole("button", { name: "I run a parking place" })).toBeVisible();
});

test("operator sign-up asks for a GSTIN and rejects a bad one", async ({ page }) => {
  await page.goto("/login?mode=up");
  await page.getByRole("button", { name: "I run a parking place" }).click();
  await expect(page.getByLabel(/GSTIN/)).toBeVisible();
  await page.getByLabel("Email").fill("owner@example.com");
  await page.getByLabel("Password").fill("longenough1");
  await page.getByLabel("Business name").fill("Test Mall Parking");
  await page.getByLabel(/GSTIN/).fill("27AAACP1234C1Z9");
  await page.getByRole("button", { name: "Sign up" }).click();
  await expect(page.locator("p.err")).toContainText("GSTIN");
});

test("invite link remembers the code and goes to sign-up", async ({ page, context }) => {
  await page.goto("/r/ab12cd34");
  await expect(page).toHaveURL(/\/login\?mode=up/);
  await expect(page.getByRole("heading", { name: "Create account" })).toBeVisible();
  expect((await context.cookies()).find((c) => c.name === "pw_ref")?.value).toBe("AB12CD34");
});

test("invite link with a bad code does not set a cookie", async ({ page, context }) => {
  await page.goto("/r/%3Cscript%3E");
  expect((await context.cookies()).some((c) => c.name === "pw_ref")).toBe(false);
});

test("how it works links to search and login", async ({ page }) => {
  await page.goto("/how");
  await expect(page.getByRole("heading", { name: "Parkwise India" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Find parking/ })).toHaveAttribute("href", "/search");
  await expect(page.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login");
});

test("search page explains when the backend is not configured", async ({ page }) => {
  await page.goto("/search");
  await expect(page.getByText("Supabase is not configured")).toBeVisible();
});

test("login form toggles between sign in and sign up", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await page.getByRole("button", { name: /Create an account/ }).click();
  await expect(page.getByRole("heading", { name: "Create account" })).toBeVisible();
  await expect(page.getByLabel("Password (min 8 chars)")).toHaveAttribute("minlength", "8");
  await expect(page.getByLabel(/Car model/)).toBeVisible();
  await expect(page.getByLabel(/Number plate/)).toBeVisible();
});

test("PWA manifest and icons are served", async ({ request }) => {
  const m = await request.get("/manifest.webmanifest");
  expect(m.ok()).toBe(true);
  const j = await m.json();
  expect(j.name).toBe("Parkwise India");
  expect(j.icons.map((i: { sizes: string }) => i.sizes)).toEqual(["192x192", "512x512"]);
  expect((await request.get("/icon-512.png")).ok()).toBe(true);
});

test("security headers are set", async ({ request }) => {
  const h = (await request.get("/")).headers();
  expect(h["x-frame-options"]).toBe("DENY");
  expect(h["x-content-type-options"]).toBe("nosniff");
  expect(h["strict-transport-security"]).toContain("max-age");
  expect(h["x-powered-by"]).toBeUndefined();
});

test("operator and rewards areas explain themselves when unconfigured or signed out", async ({ page }) => {
  await page.goto("/rewards");
  await expect(page.getByText(/Supabase is not configured|Sign in to get your invite code/)).toBeVisible();
});

test("operator export and referral claim refuse anonymous callers", async ({ request }) => {
  expect([401, 503]).toContain((await request.get("/api/operator/export")).status());
  expect([401, 503]).toContain((await request.post("/api/referrals/claim", { data: { code: "AB12CD34" } })).status());
});

test("unknown routes show the friendly 404", async ({ page }) => {
  const r = await page.goto("/definitely-not-a-page");
  expect(r?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Not found" })).toBeVisible();
});

test("protected API routes refuse anonymous callers", async ({ request }) => {
  expect([401, 503]).toContain((await request.post("/api/reservations", { data: { quoteId: "00000000-0000-4000-8000-000000000001" } })).status());
  expect((await request.get("/api/cron/forecast")).status()).toBe(401);
  expect((await request.get("/api/cron/ingest")).status()).toBe(401);
  expect((await request.get("/api/cron/expire-holds")).status()).toBe(401);
  expect((await request.post("/api/demo", { data: { scenario: "reset" } })).status()).not.toBe(200);
  expect((await request.post("/api/admin/import", { data: { kind: "calendar", csv: "x" } })).status()).not.toBe(200);
});

test("input validation rejects malformed requests", async ({ request }) => {
  // 400 when the backend is configured, 503 when it is not (the local no-env run). Never a 200 or a 500.
  for (const url of ["/api/quote?lotId=not-a-uuid", "/api/availability?lotId=nope", "/api/eta?lotId=nope&lat=1&lng=1"]) {
    expect([400, 503]).toContain((await request.get(url)).status());
  }
});

test("feed webhook does not reveal whether an endpoint exists", async ({ request }) => {
  const r = await request.post("/api/feeds/00000000-0000-4000-8000-0000000000ff", { data: { events: [] } });
  expect(r.status()).toBe(404);
});

test("mock payment endpoint requires sign-in", async ({ request }) => {
  expect([401, 404, 503]).toContain((await request.post("/api/payments/mock", { data: { orderId: "mock_order_x" } })).status());
});

test("language can be switched to Hindi and Gujarati", async ({ page }) => {
  await page.goto("/how");
  await page.getByRole("button", { name: "हिन्दी" }).click();
  await expect(page.getByText("जगह खोजिए। दाम पहले जानिए।")).toBeVisible();
  await page.getByRole("button", { name: "ગુજરાતી" }).click();
  await expect(page.getByText("જગ્યા શોધો. ભાવ પહેલાં જાણો.")).toBeVisible();
});
