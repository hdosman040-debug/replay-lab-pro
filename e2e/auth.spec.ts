import { expect, test, type Page } from "@playwright/test";

const user = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "trader@example.com",
  aud: "authenticated",
  role: "authenticated",
  app_metadata: {},
  user_metadata: {},
  created_at: "2026-01-01T00:00:00Z",
};
const token = () => {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600, iat: Math.floor(Date.now() / 1000), role: "authenticated" })}.fake-signature`;
};
const session = () => ({
  access_token: token(),
  refresh_token: "test-refresh",
  token_type: "bearer",
  expires_in: 3600,
  user,
});

async function mockAuth(page: Page) {
  const calls: { path: string; body: Record<string, unknown> }[] = [];
  await page.route("https://auth-test.supabase.co/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const body = request.postDataJSON() ?? {};
    calls.push({ path, body });
    let response: unknown = path.startsWith("/rest/v1/") ? [] : {};
    if (path.endsWith("/signup")) response = { user, session: null };
    if (path.endsWith("/token")) response = session();
    if (path.endsWith("/user")) response = user;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(response),
    });
  });
  return calls;
}

// Deliberately omit input/change events to emulate an external DOM autofill.
async function populate(page: Page, values: Record<string, string>) {
  for (const name of Object.keys(values)) {
    await expect(page.locator(`[name="${name}"]`)).toBeVisible();
  }
  await page.evaluate((values) => {
    for (const [name, value] of Object.entries(values)) {
      (document.querySelector(`[name="${name}"]`) as HTMLInputElement).value = value;
    }
  }, values);
}

test("signup preserves generated values and removes the completed form", async ({ page }) => {
  const calls = await mockAuth(page);
  await page.goto("/login");
  await page.getByRole("button", { name: "Create an account", exact: true }).click();
  await expect(page.locator("#signup-form [name=password]")).toHaveAttribute(
    "autocomplete",
    "new-password",
  );
  await populate(page, { username: user.email, password: " Generated!Password9 " });
  await page.getByRole("button", { name: "Show password", exact: true }).click();
  await expect(page.locator("[name=password]")).toHaveValue(" Generated!Password9 ");
  await page.getByRole("button", { name: "Create account", exact: false }).click();
  await expect(page).toHaveURL(/confirmation-pending/);
  await expect(page.locator("form")).toHaveCount(0);
  expect(calls.find((c) => c.path.endsWith("/signup"))?.body).toMatchObject({
    email: user.email,
    password: " Generated!Password9 ",
  });
});

test("sign-in reads autofill and navigates once without reloading login", async ({ page }) => {
  const calls = await mockAuth(page);
  const navigations: string[] = [];
  page.on("request", (request) => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) {
      navigations.push(new URL(request.url()).pathname);
    }
  });
  await page.route("http://127.0.0.1:4173/", (route) =>
    route.fulfill({ contentType: "text/html", body: "<h1>Workspace destination</h1>" }),
  );
  await page.goto("/login");
  await populate(page, { username: user.email, password: "short" });
  await page.getByRole("button", { name: "Sign in to workspace" }).click();
  await expect(page.getByRole("heading", { name: "Workspace destination" })).toBeVisible();
  expect(calls.find((c) => c.path.endsWith("/token"))?.body).toMatchObject({
    email: user.email,
    password: "short",
  });
  expect(navigations).toEqual(["/login", "/"]);
});

test("failed sign-in keeps values and permits retry", async ({ page }) => {
  await mockAuth(page);
  await page.route("**/auth/v1/token**", (route) =>
    route.fulfill({
      status: 400,
      contentType: "application/json",
      body: JSON.stringify({ code: "invalid_credentials", msg: "Invalid login credentials" }),
    }),
  );
  await page.goto("/login");
  await populate(page, { username: user.email, password: "wrong-password" });
  await page.getByRole("button", { name: "Sign in to workspace" }).click();
  await expect(page.getByRole("alert")).toContainText("Invalid login credentials");
  await expect(page.locator("[name=password]")).toHaveValue("wrong-password");
  await expect(page.getByRole("button", { name: "Sign in to workspace" })).toBeEnabled();
  await expect(page).toHaveURL(/\/login$/);
  await page.unroute("**/auth/v1/token**");
  await page.route("http://127.0.0.1:4173/", (route) =>
    route.fulfill({ contentType: "text/html", body: "<h1>Workspace destination</h1>" }),
  );
  await populate(page, { password: "CorrectPassword123!" });
  await page.getByRole("button", { name: "Sign in to workspace" }).click();
  await expect(page.getByRole("heading", { name: "Workspace destination" })).toBeVisible();
});

test("forgot password submits email and reset without a link fails clearly", async ({ page }) => {
  const calls = await mockAuth(page);
  await page.goto("/login");
  await page.getByRole("button", { name: "Forgot password?" }).click();
  await expect(page.locator("[name=password]")).toHaveCount(0);
  await populate(page, { username: user.email });
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByRole("status")).toContainText("If an account exists");
  expect(calls.find((c) => c.path.endsWith("/recover"))?.body.email).toBe(user.email);
  await page.goto("/login?mode=reset");
  await expect(page.getByRole("alert")).toContainText("Request a new link");
  await expect(page.getByRole("button", { name: "Request a new recovery link" })).toBeDisabled();
});

test("recovery event survives initialization and updates the identified account", async ({
  page,
}) => {
  const calls = await mockAuth(page);
  await page.route("http://127.0.0.1:4173/", (route) =>
    route.fulfill({ contentType: "text/html", body: "<h1>Workspace destination</h1>" }),
  );
  await page.goto(
    `/login?mode=reset#access_token=${token()}&refresh_token=test-refresh&expires_in=3600&token_type=bearer&type=recovery`,
  );
  await expect(page.locator("#reset-username")).toHaveValue(user.email);
  await populate(page, { password: "NewPassword123!", "confirm-password": "Different123!" });
  await page.getByRole("button", { name: "Update password" }).click();
  await expect(page.getByRole("alert")).toContainText("Passwords do not match");
  await populate(page, { "confirm-password": "NewPassword123!" });
  await page.getByRole("button", { name: "Update password" }).click();
  await expect(page.getByRole("heading", { name: "Workspace destination" })).toBeVisible();
  expect(calls.find((c) => c.body.password === "NewPassword123!")?.path).toBe("/auth/v1/user");
});

test("sign-in restores the session in the real workspace without a reload loop", async ({
  page,
}) => {
  await mockAuth(page);
  const navigations: string[] = [];
  page.on("request", (request) => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) {
      navigations.push(new URL(request.url()).pathname);
    }
  });
  await page.goto("/login");
  await populate(page, { username: user.email, password: "SavedPassword123!" });
  await page.getByRole("button", { name: "Sign in to workspace" }).click();
  await expect(page.getByRole("button", { name: "Start a replay session" })).toBeVisible();
  expect(navigations).toEqual(["/login", "/"]);
  // A fresh document must restore its initial authenticated session exactly once.
  await page.reload();
  await expect(page.getByRole("button", { name: "Start a replay session" })).toBeVisible();
  expect(navigations).toEqual(["/login", "/", "/"]);
});
