import { test, expect } from "@playwright/test";
import { Client as PgClient } from "pg";
import { BASE_URL, loginAs, enrollAndVerifyMfa } from "./helpers";

const DB_URL = process.env.SUPABASE_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const STUDENT_EMAIL = "sanne@my.nyenrode.nl";
const ADMIN_EMAIL = "admin@my.nyenrode.nl";

// Tijdelijk uitgeschakeld (livegangprompt, Fase 1): `loginAs` logt in via de magic-link-flow
// (Mailpit), die in Fase 1 uit /login is verwijderd. Deze tests — en `loginAs` zelf — worden in
// Fase 3 herschreven op de nieuwe activatiecode-/Google-inlog.
test.describe.skip("rollenscheiding (her in te schakelen in Fase 3)", () => {

test("niet-admin krijgt een 404 op /admin, geen redirect die het bestaan verraadt", async ({ page }) => {
  await loginAs(page, STUDENT_EMAIL);
  const response = await page.goto(`${BASE_URL}/admin`);
  expect(response?.status()).toBe(404);
  expect(page.url()).toBe(`${BASE_URL}/admin`);
  await expect(page.locator("body")).toContainText(/niet gevonden|404/i);
});

test("speler ziet geen Beheer-sectie in de navigatie", async ({ page }) => {
  await loginAs(page, STUDENT_EMAIL);
  await page.goto(`${BASE_URL}/`);
  await page.waitForLoadState("networkidle");
  const body = await page.textContent("body");
  expect(body).not.toMatch(/Gebruikers|Auditlog|Markten beheren/);
  expect(body).not.toMatch(/Beheerder/);
});

test("admin zonder MFA wordt naar /admin/mfa gestuurd en bereikt /admin na verifiëren", async ({
  page,
}) => {
  await loginAs(page, ADMIN_EMAIL);
  await page.goto(`${BASE_URL}/admin`);
  await page.waitForLoadState("networkidle");

  if (page.url() === `${BASE_URL}/admin/mfa`) {
    await enrollAndVerifyMfa(page);
  }

  expect(page.url()).toBe(`${BASE_URL}/admin`);
  const body = await page.textContent("body");
  expect(body).toMatch(/Dashboard/);
  expect(body).toMatch(/Beheerder/);
});

test("geblokkeerde speler ziet geen handelsknop meer, maar wel de markt", async ({ page }) => {
  const pg = new PgClient({ connectionString: DB_URL });
  await pg.connect();
  try {
    await pg.query(
      "update profiles set is_blocked = true, blocked_reason = 'e2e-test' where email = $1",
      [STUDENT_EMAIL],
    );

    await loginAs(page, STUDENT_EMAIL);
    await page.goto(`${BASE_URL}/`);
    await page.waitForLoadState("networkidle");
    const marketLink = page.locator('a[href^="/markets/"]').first();
    await marketLink.click();
    await page.waitForLoadState("networkidle");

    await expect(page.locator("body")).toContainText("Je account is geblokkeerd");
    await expect(page.locator("#amt")).toHaveCount(0);
  } finally {
    await pg.query(
      "update profiles set is_blocked = false, blocked_reason = null where email = $1",
      [STUDENT_EMAIL],
    );
    await pg.end();
  }
});

});
