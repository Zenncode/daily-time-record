import { loadEnvConfig } from "@next/env";
import { defineConfig, devices } from "@playwright/test";

loadEnvConfig(process.cwd());

if (!process.env.DATABASE_URL || !process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) {
  throw new Error("Configure DATABASE_URL, ADMIN_EMAIL, and ADMIN_PASSWORD in .env before running E2E tests.");
}

export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3101",
    trace: "retain-on-failure",
    ...devices["Desktop Chrome"],
  },
  webServer: {
    command: "npm run dev -- --hostname 127.0.0.1 --port 3101",
    url: "http://127.0.0.1:3101/login",
    env: {
      DTR_TEST_NOW: "2026-10-16T01:30:00.000Z",
      REALTIME_PUBLISH_URL: "http://127.0.0.1:3101/_dtr/realtime/publish",
    },
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
