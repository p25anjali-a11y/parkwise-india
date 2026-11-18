import { defineConfig } from "@playwright/test";

const external = process.env.E2E_BASE_URL;

export default defineConfig({
  testDir: "e2e",
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: { baseURL: external ?? "http://127.0.0.1:3100", channel: process.env.E2E_CHANNEL || undefined, trace: "retain-on-failure" },
  // Without E2E_BASE_URL the suite starts the production build locally with NO Supabase env, so it exercises the
  // unconfigured paths. Flows needing a database run against a deployed preview that has the env set.
  webServer: external ? undefined : { command: "env NEXT_PUBLIC_SUPABASE_URL= NEXT_PUBLIC_SUPABASE_ANON_KEY= SUPABASE_SERVICE_ROLE_KEY= pnpm --filter @parkwise/web exec next start -p 3100", url: "http://127.0.0.1:3100/api/health", reuseExistingServer: !process.env.CI, timeout: 60_000 },
});
