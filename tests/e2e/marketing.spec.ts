import { expect, test } from "@playwright/test";

test("home page messaging", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      name: /From AI policy docs to role-ready training in under 45 minutes/i,
    }),
  ).toBeVisible();
  await page.getByRole("link", { name: /View 6-Week Pilot/i }).click();
  await expect(page).toHaveURL(/\/pilot$/);
});

test("security page loads", async ({ page }) => {
  await page.goto("/security");
  await expect(page.getByRole("heading", { name: /Secure by default architecture/i })).toBeVisible();
});
