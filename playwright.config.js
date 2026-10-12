import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL || "https://multi-client-campaign-control-panel.vercel.app";

export default defineConfig({
  testDir: "./e2e",
  timeout: 180000,
  expect: { timeout: 30000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    navigationTimeout: 90000,
    actionTimeout: 30000,
    ...devices["Desktop Chrome"],
  },
});
