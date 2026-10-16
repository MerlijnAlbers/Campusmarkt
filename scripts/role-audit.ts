/**
 * Rollenaudit: controleert of de scheiding tussen speler en beheerder nog standhoudt.
 *
 * Draai lokaal (supabase moet draaien) met:
 *   npm run audit:roles
 *
 * Dit script is bewust alleen voor de lokale Supabase-instantie bedoeld: het logt in met de
 * vaste testaccounts uit supabase/seed.sql (wachtwoord "campusmarkt-test") en verwacht die
 * daar aan te treffen. Het weigert te draaien tegen een niet-lokale SUPABASE_URL, tenzij je
 * dat expliciet forceert met ALLOW_REMOTE_AUDIT=1 (en dan nog alleen als diezelfde
 * testaccounts daar ook bestaan).
 */
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Client as PgClient } from "pg";
import { totp } from "../test-support/totp";

function loadEnvLocal(): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    const raw = readFileSync(".env.local", "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (m) out[m[1]] = m[2];
    }
  } catch {
    // geen .env.local: dan moeten de env-variabelen al in process.env staan.
  }
  return out;
}

const env = { ...loadEnvLocal(), ...process.env } as Record<string, string | undefined>;

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const DB_URL = env.SUPABASE_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

if (!SUPABASE_URL || !ANON_KEY) {
  console.error("NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY ontbreken (.env.local).");
  process.exit(1);
}

const isLocal = /127\.0\.0\.1|localhost/.test(SUPABASE_URL);
if (!isLocal && env.ALLOW_REMOTE_AUDIT !== "1") {
  console.error(
    `SUPABASE_URL (${SUPABASE_URL}) lijkt niet lokaal. Dit script logt in met vaste ` +
      `testwachtwoorden en is alleen bedoeld voor de lokale Supabase-instantie. Zet ` +
      `ALLOW_REMOTE_AUDIT=1 als je echt weet wat je doet (en de testaccounts daar bestaan).`,
  );
  process.exit(1);
}

const STUDENT_EMAIL = "sanne@my.nyenrode.nl";
const ADMIN_EMAIL = "admin@my.nyenrode.nl";
const TEST_PASSWORD = "campusmarkt-test";

// Elke beheerfunctie die is_admin_mfa() vereist, met minimale geldige dummy-argumenten.
// De permissiecheck is altijd de EERSTE regel in de functie, dus onbestaande uuid's zijn
// geen probleem: die worden nooit bereikt als de permissiecheck al faalt.
const ADMIN_RPCS: { name: string; args: Record<string, unknown> }[] = [
  {
    name: "create_market",
    args: {
      p_title: "audit",
      p_description: "audit",
      p_criteria: "audit",
      p_source: "audit",
      p_b: 100,
      p_outcomes: ["A", "B"],
      p_opens_at: new Date().toISOString(),
      p_closes_at: new Date(Date.now() + 86400000).toISOString(),
    },
  },
  { name: "set_market_status", args: { p_market: randomUUID(), p_status: "open" } },
  { name: "resolve_market", args: { p_market: randomUUID(), p_winner: randomUUID() } },
  { name: "cancel_market", args: { p_market: randomUUID() } },
  { name: "delete_market", args: { p_market: randomUUID() } },
  { name: "check_ledger", args: {} },
  { name: "admin_add_exclusion", args: { p_market: randomUUID(), p_user: randomUUID() } },
  { name: "admin_remove_exclusion", args: { p_market: randomUUID(), p_user: randomUUID() } },
  { name: "admin_list_users", args: {} },
  { name: "admin_set_blocked", args: { p_user: randomUUID(), p_blocked: true, p_reason: "audit" } },
  {
    name: "admin_adjust_points",
    args: { p_user: randomUUID(), p_amount: 10, p_reason: "rollenaudit testaanpassing" },
  },
  { name: "admin_list_actions", args: {} },
];

let failures = 0;
function check(label: string, ok: boolean, detail?: string) {
  if (ok) {
    console.log(`  OK  ${label}`);
  } else {
    failures += 1;
    console.log(`FOUT  ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

async function rejectsWithGeenToegang(client: SupabaseClient, name: string, args: Record<string, unknown>) {
  const { error } = await client.rpc(name, args);
  // "Geen toegang" (onze eigen check) of een Postgres permission-denied (als de grant er ook
  // niet is) zijn allebei een correcte afwijzing.
  return !!error;
}

async function main() {
  console.log(`Rollenaudit tegen ${SUPABASE_URL}\n`);

  // ===== Deel 1: database-introspectie (RLS, grants, aantal beheerders) =====
  console.log("Database-niveau:");
  const pg = new PgClient({ connectionString: DB_URL });
  await pg.connect();

  const { rows: noRls } = await pg.query(`
    select relname from pg_class
    join pg_namespace n on n.oid = pg_class.relnamespace
    where n.nspname = 'public' and relkind = 'r' and not relrowsecurity
  `);
  check("RLS staat aan op elke tabel in public", noRls.length === 0, noRls.map((r) => r.relname).join(", "));

  const { rows: adminCount } = await pg.query(
    `select count(*)::int as n from profiles where role = 'admin'`,
  );
  check("Precies één beheerder", adminCount[0].n === 1, `gevonden: ${adminCount[0].n}`);

  const { rows: openPolicies } = await pg.query(`
    select tablename, policyname from pg_policies
    where schemaname = 'public' and qual = 'true'
      and tablename in ('profiles', 'positions', 'trades', 'ledger_entries', 'admin_actions', 'market_exclusions')
  `);
  check(
    "Geen 'using (true)'-leesbeleid op gevoelige tabellen",
    openPolicies.length === 0,
    openPolicies.map((r) => `${r.tablename}.${r.policyname}`).join(", "),
  );

  const { rows: anonGrants } = await pg.query(
    `
    select p.proname from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = any($1)
      and has_function_privilege('anon', p.oid, 'EXECUTE')
    `,
    [ADMIN_RPCS.map((r) => r.name)],
  );
  check(
    "anon heeft geen EXECUTE op beheerfuncties",
    anonGrants.length === 0,
    anonGrants.map((r) => r.proname).join(", "),
  );

  await pg.end();

  // ===== Deel 2: gedrag met echte sessies (anon, speler, beheerder zonder/met MFA) =====
  console.log("\nSessie-gedrag:");

  const anonClient = createClient(SUPABASE_URL!, ANON_KEY!);
  const { data: anonProfiles } = await anonClient.from("profiles").select("*");
  check("Niet-ingelogd kan geen profielen lezen", (anonProfiles ?? []).length === 0);

  for (const rpc of ADMIN_RPCS) {
    check(
      `Niet-ingelogd: ${rpc.name} geweigerd`,
      await rejectsWithGeenToegang(anonClient, rpc.name, rpc.args),
    );
  }

  const studentClient = createClient(SUPABASE_URL!, ANON_KEY!);
  const { error: studentLoginError } = await studentClient.auth.signInWithPassword({
    email: STUDENT_EMAIL,
    password: TEST_PASSWORD,
  });
  if (studentLoginError) {
    check(`Inloggen als ${STUDENT_EMAIL}`, false, studentLoginError.message);
  } else {
    check(`Inloggen als ${STUDENT_EMAIL}`, true);
    const { data: ownProfiles } = await studentClient.from("profiles").select("*");
    check(
      "Speler ziet alleen eigen profiel",
      (ownProfiles ?? []).length === 1 && ownProfiles![0].email === STUDENT_EMAIL,
    );
    for (const rpc of ADMIN_RPCS) {
      check(
        `Speler: ${rpc.name} geweigerd`,
        await rejectsWithGeenToegang(studentClient, rpc.name, rpc.args),
      );
    }
  }

  const adminClient = createClient(SUPABASE_URL!, ANON_KEY!);
  const { error: adminLoginError } = await adminClient.auth.signInWithPassword({
    email: ADMIN_EMAIL,
    password: TEST_PASSWORD,
  });
  if (adminLoginError) {
    check(`Inloggen als ${ADMIN_EMAIL}`, false, adminLoginError.message);
  } else {
    check(`Inloggen als ${ADMIN_EMAIL}`, true);

    for (const rpc of ADMIN_RPCS) {
      check(
        `Beheerder zonder MFA: ${rpc.name} geweigerd`,
        await rejectsWithGeenToegang(adminClient, rpc.name, rpc.args),
      );
    }

    // MFA voltooien via de API (geen browser nodig: enroll -> challenge -> verify).
    const { data: existingFactors } = await adminClient.auth.mfa.listFactors();
    let factorId = existingFactors?.totp?.[0]?.id;
    if (!factorId) {
      const { data: enrolled, error: enrollError } = await adminClient.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: `rollenaudit-${randomUUID()}`,
      });
      if (enrollError || !enrolled) {
        check("MFA enrollen voor audit-check", false, enrollError?.message);
      } else {
        factorId = enrolled.id;
        const secret = enrolled.totp.secret;
        const { data: challenge, error: challengeError } = await adminClient.auth.mfa.challenge({
          factorId,
        });
        if (challengeError || !challenge) {
          check("MFA challenge voor audit-check", false, challengeError?.message);
        } else {
          const code = totp(secret);
          const { error: verifyError } = await adminClient.auth.mfa.verify({
            factorId,
            challengeId: challenge.id,
            code,
          });
          check("MFA verifiëren voor audit-check", !verifyError, verifyError?.message);
        }
      }
    } else {
      // Al een geverifieerde factor (uit een eerdere auditrun): challenge opnieuw om aal2 te krijgen.
      // We hebben het secret dan niet meer, dus we kunnen niet opnieuw verifiëren in dit geval —
      // dat is prima, de audit hieronder test dan gewoon met aal1 en rapporteert dat aal2 niet is
      // bereikt (duidt op een vervuilde lokale database; `supabase db reset` lost dat op).
    }

    const { data: aal } = await adminClient.auth.mfa.getAuthenticatorAssuranceLevel();
    check("Beheerder heeft aal2 na MFA-verificatie", aal?.currentLevel === "aal2");

    if (aal?.currentLevel === "aal2") {
      const { error: listError } = await adminClient.rpc("admin_list_users", {});
      check("Beheerder met MFA: admin_list_users werkt", !listError, listError?.message);
      const { error: ledgerError } = await adminClient.rpc("check_ledger", {});
      check("Beheerder met MFA: check_ledger werkt", !ledgerError, ledgerError?.message);
    }
  }

  console.log(`\n${failures === 0 ? "Alle checks geslaagd." : `${failures} check(s) gefaald.`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
