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

test("desktop navigation routes correctly", async ({ page }) => {
  await page.goto("/");

  await page.getByLabel("Primary", { exact: true }).getByRole("link", { name: /^Pilot$/i }).click();
  await expect(page).toHaveURL(/\/pilot$/);

  await page
    .getByLabel("Primary", { exact: true })
    .getByRole("link", { name: /^Security$/i })
    .click();
  await expect(page).toHaveURL(/\/security$/);

  await page.getByLabel("Primary", { exact: true }).getByRole("link", { name: /^ROI$/i }).click();
  await expect(page).toHaveURL(/\/roi$/);
});

test("mobile navigation menu works", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");

  await page.getByRole("button", { name: /toggle navigation/i }).click();
  await page
    .getByLabel("Mobile primary", { exact: true })
    .getByRole("link", { name: /^Security$/i })
    .click();

  await expect(page).toHaveURL(/\/security$/);
  await expect(page.getByRole("heading", { name: /Secure by default architecture/i })).toBeVisible();
});
