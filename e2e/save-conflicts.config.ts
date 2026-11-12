import { fileURLToPath } from "node:url";
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: "save-conflicts.spec.ts",
  use: {
    baseURL: "http://127.0.0.1:4175",
    launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH },
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "android", use: { ...devices["Pixel 7"], defaultBrowserType: "chromium" } },
  ],
  webServer: {
    cwd: fileURLToPath(new URL("..", import.meta.url)),
    command:
      "npx vite --config e2e/fixtures/vite.config.ts --host 127.0.0.1 --port 4175 --strictPort",
    url: "http://127.0.0.1:4175/e2e/fixtures/save-conflicts.html",
    env: {
      VITE_SUPABASE_URL: "https://auth-test.supabase.co",
      VITE_SUPABASE_ANON_KEY: "test-public-key",
    },
  },
});
