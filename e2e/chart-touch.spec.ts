import { expect, test, type CDPSession, type Page } from "@playwright/test";

type Point = { x: number; y: number };
type Geometry = { from: number; to: number; top: number; bottom: number; width: number; height: number };

async function geometry(page: Page): Promise<Geometry> {
  return JSON.parse((await page.getByTestId("geometry").textContent())!);
}

async function touch(cdp: CDPSession, type: "touchStart" | "touchMove" | "touchEnd", points: Point[]) {
  await cdp.send("Input.dispatchTouchEvent", {
    type,
    touchPoints: points.map((p, id) => ({ ...p, id, radiusX: 2, radiusY: 2 })),
  });
}

async function drag(cdp: CDPSession, from: Point, to: Point) {
  await touch(cdp, "touchStart", [from]);
  for (let i = 1; i <= 8; i++) {
    await touch(cdp, "touchMove", [{ x: from.x + (to.x - from.x) * i / 8, y: from.y + (to.y - from.y) * i / 8 }]);
  }
  await touch(cdp, "touchEnd", []);
}

test.describe("chart one-finger navigation", () => {
  test.skip(({ isMobile }) => !isMobile, "Requires native touch input on the Android viewport");

  test.beforeEach(async ({ page }) => {
    await page.goto("/e2e/fixtures/chart-touch.html");
    await expect(page.getByTestId("geometry")).not.toHaveText("");
  });

  test("vertical drags pan price in both directions and A restores auto-scale", async ({ page }) => {
    const cdp = await page.context().newCDPSession(page);
    const before = await geometry(page);
    await drag(cdp, { x: 150, y: 210 }, { x: 150, y: 300 });
    await expect.poll(async () => (await geometry(page)).top).toBeGreaterThan(before.top + 1);
    await expect(page.getByRole("button", { name: "Auto-scale price" })).toBeVisible();
    const down = await geometry(page);
    await drag(cdp, { x: 150, y: 300 }, { x: 150, y: 210 });
    await expect.poll(async () => (await geometry(page)).top).toBeLessThan(down.top - 1);
    await page.getByRole("button", { name: "Auto-scale price" }).tap();
    await expect(page.getByRole("button", { name: "Auto-scale price" })).toHaveCount(0);
  });

  test("a sideways swipe still pans after a vertical first movement", async ({ page }) => {
    const cdp = await page.context().newCDPSession(page);
    const before = await geometry(page);
    await touch(cdp, "touchStart", [{ x: 120, y: 210 }]);
    await touch(cdp, "touchMove", [{ x: 123, y: 220 }]);
    for (let x = 140; x <= 240; x += 20) {
      await touch(cdp, "touchMove", [{ x, y: 225 }]);
    }
    await touch(cdp, "touchEnd", []);
    await expect.poll(async () => (await geometry(page)).from).toBeLessThan(before.from - 60);
  });

  test("a long press releases tracking so the next swipe pans", async ({ page }) => {
    const cdp = await page.context().newCDPSession(page);
    await touch(cdp, "touchStart", [{ x: 160, y: 210 }]);
    await page.waitForTimeout(350); // Native long-press recognition takes 240ms.
    await expect(page.getByTestId("crosshair")).not.toHaveText("null");
    await touch(cdp, "touchMove", [{ x: 180, y: 225 }]);
    await touch(cdp, "touchEnd", []);
    await expect(page.getByTestId("crosshair")).toHaveText("null");
    await expect(page.getByRole("button", { name: "Auto-scale price" })).toHaveCount(0);
    const before = await geometry(page);
    await drag(cdp, { x: 120, y: 210 }, { x: 240, y: 210 });
    await expect.poll(async () => (await geometry(page)).from).toBeLessThan(before.from - 60);
  });

  test("a tap keeps auto-scale and a pinch is followed by a working drag", async ({ page }) => {
    const cdp = await page.context().newCDPSession(page);
    await page.touchscreen.tap(150, 210);
    await expect(page.getByRole("button", { name: "Auto-scale price" })).toHaveCount(0);
    const before = await geometry(page);
    await touch(cdp, "touchStart", [{ x: 110, y: 170 }, { x: 200, y: 290 }]);
    for (let i = 1; i <= 6; i++) {
      await touch(cdp, "touchMove", [{ x: 110 - i * 3, y: 170 - i * 6 }, { x: 200 + i * 3, y: 290 + i * 6 }]);
    }
    await touch(cdp, "touchEnd", []);
    await expect.poll(async () => {
      const g = await geometry(page);
      return g.top - g.bottom;
    }).toBeLessThan(before.top - before.bottom - 1);
    const zoomed = await geometry(page);
    await drag(cdp, { x: 150, y: 210 }, { x: 150, y: 290 });
    await expect.poll(async () => (await geometry(page)).top).toBeGreaterThan(zoomed.top + 1);
  });

  test("drawing mode creates a zone without panning, then navigation resumes", async ({ page }) => {
    const cdp = await page.context().newCDPSession(page);
    await page.getByRole("button", { name: "Draw FVG" }).tap();
    const before = await geometry(page);
    await drag(cdp, { x: 90, y: 150 }, { x: 180, y: 220 });
    await expect.poll(async () => JSON.parse((await page.getByTestId("drawings").textContent())!).length).toBe(1);
    expect(await geometry(page)).toEqual(before);
    await expect(page.getByRole("button", { name: "Auto-scale price" })).toHaveCount(0);
    await drag(cdp, { x: 120, y: 340 }, { x: 240, y: 340 });
    await expect.poll(async () => (await geometry(page)).from).toBeLessThan(before.from - 60);
  });
});
