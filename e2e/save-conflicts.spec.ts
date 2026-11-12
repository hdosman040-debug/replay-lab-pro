import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

test("a stale save preserves both versions and downloads the unsaved copy before cloud reload", async ({
  page,
}) => {
  let cloud = { value: "original", revision: 1, deleted: false };
  let writes = 0;
  await page.route("https://auth-test.supabase.co/rest/v1/user_state**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === "PATCH") {
      writes++;
      expect(url.searchParams.get("user_id")).toBe("eq.11111111-1111-4111-8111-111111111111");
      expect(url.searchParams.get("revision")).toBe("eq.1");
      await route.fulfill({ json: [] });
    } else {
      await route.fulfill({ json: cloud });
    }
  });
  await page.goto("/e2e/fixtures/save-conflicts.html");
  await expect(page.getByText("Loaded: original")).toBeVisible();
  cloud = { value: "new trade from another device", revision: 2, deleted: false };
  await page.getByRole("button", { name: "Save trade", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Saving paused");
  const reload = page.getByRole("button", { name: "Download backup & reload cloud" });
  await expect(reload).toBeInViewport();
  const downloaded = page.waitForEvent("download");
  await reload.click();
  const download = await downloaded;
  const backup = JSON.parse(await readFile((await download.path())!, "utf8"));
  expect(backup.entries).toHaveLength(1);
  expect(JSON.parse(backup.entries[0].raw).value).toBe("my unsaved trade");
  await expect(page.getByText("Loaded: new trade from another device")).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
  expect(writes).toBe(1);
  expect(
    await page.evaluate(
      () => Object.keys(localStorage).filter((key) => key.startsWith("recovery-archive:")).length,
    ),
  ).toBe(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
