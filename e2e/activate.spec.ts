import { test, expect } from "@playwright/test";
import { Client as PgClient } from "pg";
import { BASE_URL } from "./helpers";

const DB_URL = process.env.SUPABASE_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

async function createInvitation(email: string, code: string) {
  const pg = new PgClient({ connectionString: DB_URL });
  await pg.connect();
  try {
    await pg.query("delete from invitations where lower(email) = lower($1)", [email]);
    await pg.query(
      `insert into invitations (email, purpose, code_hash, expires_at)
       values ($1, 'activate', crypt($2, gen_salt('bf')), now() + interval '2 days')`,
      [email, code],
    );
  } finally {
    await pg.end();
  }
}

async function deleteTestAccount(email: string) {
  const pg = new PgClient({ connectionString: DB_URL });
  await pg.connect();
  try {
    await pg.query("delete from invitations where lower(email) = lower($1)", [email]);
    await pg.query(
      "delete from ledger_entries where user_id = (select id from profiles where lower(email) = lower($1))",
      [email],
    );
    await pg.query("delete from auth.users where lower(email) = lower($1)", [email]);
  } finally {
    await pg.end();
  }
}

test.describe("activatie", () => {
  test("juiste code activeert het account en toont de welkomstmelding", async ({ page }) => {
    const email = `e2e-activate-${Date.now()}@my.nyenrode.nl`;
    await createInvitation(email, "12345678");
    try {
      await page.goto(`${BASE_URL}/activate`);
      await page.fill("#email", email);
      await page.fill("#code", "12345678");
      await page.fill("#password", "een-prima-wachtwoord");
      await page.fill("#confirm", "een-prima-wachtwoord");
      await page.click('button[type="submit"]');
      await expect(page.locator("body")).toContainText("Welkom bij Campusmarkt", { timeout: 10000 });
      await expect(page.locator("body")).toContainText("1.000 startpunten");
    } finally {
      await deleteTestAccount(email);
    }
  });

  test("foute code geeft de algemene foutmelding en maakt geen account aan", async ({ page }) => {
    const email = `e2e-activate-wrong-${Date.now()}@my.nyenrode.nl`;
    await createInvitation(email, "12345678");
    try {
      await page.goto(`${BASE_URL}/activate`);
      await page.fill("#email", email);
      await page.fill("#code", "99999999");
      await page.fill("#password", "een-prima-wachtwoord");
      await page.fill("#confirm", "een-prima-wachtwoord");
      await page.click('button[type="submit"]');
      await expect(page.locator("body")).toContainText(
        "E-mailadres of code klopt niet, of de code is verlopen.",
      );
      await expect(page.locator("body")).not.toContainText("Welkom bij Campusmarkt");
    } finally {
      await deleteTestAccount(email);
    }
  });
});
