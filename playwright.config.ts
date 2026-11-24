import { defineConfig, devices } from "@playwright/test";

const PORT = 3200;

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : [["list"]],
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npm run build && npm run start -- -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    timeout: 240_000,
    reuseExistingServer: !process.env.CI,
    // The suite never calls Gemini: empty values here win over any local .env, so the plan is the
    // labelled rule-based one, and every test uses the synthetic smog day so no network is needed.
    // The per-IP limiter is raised because every test shares one client address.
    env: { GEMINI_API_KEY: "", GEMINI_MODEL: "", GEMINI_FALLBACK_MODEL: "", RATE_LIMIT_PLAN_PER_MIN: "1000", RATE_LIMIT_PLACES_PER_MIN: "1000" },
  },
});
