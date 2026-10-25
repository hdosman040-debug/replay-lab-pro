import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  expect: { timeout: 15000 },
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "off",
    launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH },
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "android-viewport", use: { ...devices["Pixel 7"], defaultBrowserType: "chromium" } },
  ],
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 4173",
    url: "http://127.0.0.1:4173/login",
    reuseExistingServer: false,
    env: {
      VITE_SUPABASE_URL: "https://auth-test.supabase.co",
      VITE_SUPABASE_ANON_KEY: "test-public-key",
    },
  },
});
