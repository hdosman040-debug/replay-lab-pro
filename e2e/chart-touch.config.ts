import { fileURLToPath } from "node:url";
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: "chart-touch.spec.ts",
  expect: { timeout: 5000 },
  use: {
    baseURL: "http://127.0.0.1:4174",
    launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH },
  },
  projects: [{ name: "android-viewport", use: { ...devices["Pixel 7"], defaultBrowserType: "chromium" } }],
  webServer: {
    cwd: fileURLToPath(new URL("..", import.meta.url)),
    command: "npx vite --config e2e/fixtures/vite.config.ts --host 127.0.0.1 --port 4174 --strictPort",
    url: "http://127.0.0.1:4174/e2e/fixtures/chart-touch.html",
    reuseExistingServer: false,
  },
});
