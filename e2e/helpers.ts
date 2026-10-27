import type { Page } from "@playwright/test";
import { totp } from "../test-support/totp";

export const BASE_URL = "http://localhost:3000";

// Wachtwoord van alle testaccounts uit supabase/seed.sql.
const TEST_PASSWORD = "campusmarkt-test";

/** Logt in via de echte /login-flow (e-mail + wachtwoord), zoals een speler/beheerder dat ook doet. */
export async function loginAs(page: Page, email: string): Promise<void> {
  await page.goto(`${BASE_URL}/login`);
  await page.fill("#email", email);
  await page.fill("#password", TEST_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE_URL}/`, { timeout: 10000 }).catch(() => {});
  await page.waitForLoadState("networkidle");
}

/**
 * Voltooit de TOTP-enrollment op /admin/mfa (alleen te gebruiken als er nog geen factor
 * bestaat — roep dit dus op binnen één test, niet verspreid over meerdere onafhankelijke tests,
 * anders is het secret van een eerdere enrollment niet meer beschikbaar).
 */
export async function enrollAndVerifyMfa(page: Page): Promise<void> {
  await page.click("text=QR-code genereren");
  await page.waitForTimeout(500);
  const secret = (await page.textContent("code"))?.trim() ?? "";
  if (!secret) throw new Error("geen TOTP-secret gevonden op /admin/mfa");
  const code = totp(secret);
  const input = page.locator("#mfa-code").first();
  await input.evaluate((el: HTMLElement) => el.focus());
  await page.keyboard.type(code);
  await page.keyboard.press("Enter");
  await page.waitForURL(`${BASE_URL}/admin`, { timeout: 10000 }).catch(() => {});
  await page.waitForLoadState("networkidle");
}
