import type { Page } from "@playwright/test";
import { totp } from "../test-support/totp";

export const BASE_URL = "http://localhost:3000";
const MAILPIT_URL = "http://127.0.0.1:54324";

async function getLatestLinkFor(email: string): Promise<string> {
  const res = await fetch(`${MAILPIT_URL}/api/v1/messages?limit=20`);
  const data = await res.json();
  const msg = data.messages.find((m: { To?: { Address: string }[] }) =>
    m.To?.some((t) => t.Address === email),
  );
  if (!msg) throw new Error(`geen e-mail gevonden voor ${email}`);
  const full = await (await fetch(`${MAILPIT_URL}/api/v1/message/${msg.ID}`)).json();
  const body: string = full.Text || full.HTML;
  const match = body.match(/http:\/\/127\.0\.0\.1:54321\/auth\/v1\/verify\?[^\s"<)]+/);
  if (!match) throw new Error("geen magic link gevonden in e-mail");
  return match[0];
}

/** Logt in via de echte magic-link-flow (Mailpit), zoals een speler/beheerder dat ook doet. */
export async function loginAs(page: Page, email: string): Promise<void> {
  await page.goto(`${BASE_URL}/login`);
  await page.fill('input[type="email"]', email);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(800);
  const link = await getLatestLinkFor(email);
  await page.goto(link);
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
