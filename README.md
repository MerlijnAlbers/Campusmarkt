# Campusmarkt

Een voorspellingsmarkt (zoals Polymarket/Kalshi) voor studenten, met **speelpunten zonder geldwaarde**.
Gebouwd met Next.js (App Router), TypeScript, Tailwind CSS en Supabase (Postgres, Auth, Realtime).

## Vereisten

- [Node.js](https://nodejs.org) 20+ en npm
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (nodig om Supabase lokaal te draaien)
  - Op Windows heeft Docker Desktop **WSL2** nodig. Als dat nog niet aanwezig is: open PowerShell
    **als Administrator** en voer uit `wsl --install`, herstart daarna je pc, en start Docker Desktop
    eenmaal op om de licentievoorwaarden te accepteren.
- De [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started)

## Lokaal starten

1. Installeer de dependencies:

   ```bash
   npm install
   ```

2. Start de lokale Supabase-stack (Postgres, Auth, Studio, Inbucket e-mailtester). Dit vereist
   Docker:

   ```bash
   supabase start
   ```

   Dit draait automatisch de migraties in `supabase/migrations/` en de testdata in
   `supabase/seed.sql`. De terminal toont daarna een `API URL` en `anon key`.

3. Kopieer `.env.example` naar `.env.local` en vul de waarden uit stap 2 in:

   ```bash
   cp .env.example .env.local
   ```

   ```
   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key uit `supabase start`>
   ```

4. Start de Next.js-ontwikkelserver:

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

5. Inloggen lokaal: vul op `/login` een e-mailadres van het schooldomein (`@my.nyenrode.nl`) in en
   klik op "Stuur inloglink". Open **Inbucket** (de lokale e-mailtester) op
   [http://127.0.0.1:54324](http://127.0.0.1:54324) om de inloglink te bekijken en te openen.

6. Supabase Studio (databasebeheer in de browser) staat op
   [http://127.0.0.1:54323](http://127.0.0.1:54323).

Database resetten (migraties + seed opnieuw draaien):

```bash
supabase db reset
```

## Tests

```bash
npm test          # Vitest (lib/lmsr.ts e.d.)
supabase test db  # pgTAP-databasetests in supabase/tests/
```

## Beheerdersaccount

Er bestaat precies één beheerdersaccount (afgedwongen met een unieke database-index). Nieuwe
accounts krijgen altijd de rol `student` — de app heeft zelf geen knop of functie om iemand
beheerder te maken, ook niet voor een bestaande beheerder. Dat moet je eenmalig zelf doen met SQL,
**na** je eerste keer inloggen met `m.albers@my.nyenrode.nl` (zodat het profiel al bestaat):

```sql
update profiles set role = 'admin' where email = 'm.albers@my.nyenrode.nl';
```

Voer dit lokaal uit tegen `postgresql://postgres:postgres@127.0.0.1:54322/postgres` (bijv. via
Supabase Studio's SQL-editor op `http://127.0.0.1:54323`) of, voor het cloudproject, via het
dashboard onder **SQL Editor**. Zet dit commando nooit met een echt e-mailadres in een migratie of
commit — eerdere migraties deden dat via `primary_admin_email()`, wat het e-mailadres van de
beheerder aan iedereen blootstelde; die functie is inmiddels verwijderd. Er is daarnaast een los
testaccount `admin@my.nyenrode.nl` (wachtwoord `campusmarkt-test`, rol al `admin` via `seed.sql`)
voor lokaal testen zonder je eigen adres te gebruiken.

Een beheerder kan markten aanmaken, openen/sluiten, uitbetalen, annuleren en uitsluitingen
beheren. **Verwijderen** kan alleen zolang een markt nog geen activiteit heeft (geen trades of
grootboekregels) — zodra er is gehandeld, moet je annuleren (`cancel_market`) zodat de inleg netjes
wordt teruggestort en het grootboek klopt. Dit is bewust net als bij Polymarket/Kalshi: een markt
met echte activiteit verdwijnt nooit stilletjes.

## Tweestapsverificatie (MFA) voor beheerders

Elk account met de rol `admin` moet verplicht tweestapsverificatie (TOTP, bijv. Google
Authenticator, Microsoft Authenticator of 1Password) instellen voordat het bij een van de
`/admin/*`-schermen kan. Dit wordt op drie plekken afgedwongen:

1. **Middleware** (`lib/supabase/middleware.ts`): stuurt een admin zonder AAL2-sessie (behalve op
   `/admin/mfa` zelf) door naar `/admin/mfa`.
2. **`app/(app)/admin/layout.tsx`**: controleert via `requireAdmin()` nogmaals of de rol klopt
   (404, geen redirect, zodat een niet-admin niet kan afleiden dat het beheer bestaat).
3. **Database**: elke beheerfunctie begint met `is_admin_mfa()`, die zowel de rol als de AAL2-claim
   uit het JWT controleert. Zelfs met een gestolen sessie-cookie zonder voltooide MFA-stap kan er
   dus niets in de database worden aangepast.

### Eenmalig instellen

Log in als beheerder en ga naar `/admin` (of direct naar `/admin/mfa`). Scan de QR-code met een
authenticator-app en vul de 6-cijferige code in om te bevestigen. Dit hoeft maar één keer per
account.

### Authenticator kwijt / MFA resetten

Er is bewust **geen** manier in de app zelf om MFA uit te zetten of te resetten (dat zou de
beveiliging omzeilen). Bij verlies van de authenticator-app kan alleen jij, als projecteigenaar,
het via het Supabase-dashboard herstellen:

1. Ga naar **Authentication → Users**, zoek het beheerdersaccount op.
2. Open het account en verwijder onder **Multi-Factor Authentication** de bestaande TOTP-factor.
3. De beheerder kan daarna opnieuw inloggen en bij `/admin/mfa` een nieuwe authenticator koppelen.

Lokaal kan dit ook direct in Supabase Studio (`http://127.0.0.1:54323`) via dezelfde route, of met
SQL: `delete from auth.mfa_factors where user_id = '<user-id>';`.

### Bij een vermoedelijk gecompromitteerd beheerdersaccount

1. Verwijder direct de TOTP-factor zoals hierboven (dit dwingt een nieuwe MFA-koppeling af en
   ongeldigt de huidige AAL2-sessie bij de volgende statuscontrole).
2. Overweeg het account tijdelijk te blokkeren via `admin_set_blocked` (uitgevoerd door een ander
   beheerdersaccount, of rechtstreeks in de database) totdat het wachtwoord/toegang tot de mailbox
   is gecontroleerd.
3. Controleer `admin_actions` (het auditlog van alle beheerhandelingen) op acties die niet door de
   rechtmatige beheerder zijn uitgevoerd.
4. Omdat de rol `admin` uitsluitend via `primary_admin_email()` (zie "Beheerdersaccount" hierboven)
   of een handmatige SQL-opdracht wordt toegekend — nooit via de app zelf — kan een aanvaller de
   rol niet zelf opnieuw toekennen nadat deze is ingetrokken.

## Inloggen met schoolaccount (Microsoft Entra ID / Azure AD)

De app is voorbereid op inloggen via het Microsoft-schoolaccount van de student, met de
e-mail-inloglink als terugvaloptie (voor lokaal testen en als ICT Azure niet toestaat). Om de
Azure-provider daadwerkelijk te activeren:

### In Azure (Microsoft Entra ID)

1. Ga naar [Microsoft Entra admin center](https://entra.microsoft.com) → **App registrations** →
   **New registration**.
2. Geef de app een naam (bijv. "Campusmarkt"), kies het juiste tenant-type (meestal "Accounts in
   this organizational directory only").
3. Zet onder **Redirect URI** (type: Web):
   - Lokaal: `http://127.0.0.1:54321/auth/v1/callback`
   - Cloud: `https://<jouw-project-ref>.supabase.co/auth/v1/callback`
4. Noteer de **Application (client) ID** en de **Directory (tenant) ID**.
5. Ga naar **Certificates & secrets** → **New client secret**, en noteer de gegenereerde waarde
   (dit is je `client secret`, niet de secret-ID).
6. Ga naar **API permissions** en zorg dat minimaal `openid`, `email` en `profile` zijn toegestaan.

### In Supabase

**Lokaal** (`supabase/config.toml`, sectie `[auth.external.azure]`):

```toml
[auth.external.azure]
enabled = true
client_id = "env(SUPABASE_AUTH_EXTERNAL_AZURE_CLIENT_ID)"
secret = "env(SUPABASE_AUTH_EXTERNAL_AZURE_SECRET)"
url = "env(SUPABASE_AUTH_EXTERNAL_AZURE_URL)"
```

Zet de bijbehorende omgevingsvariabelen (niet in git!) voor je shell of in `supabase/.env`:

```bash
export SUPABASE_AUTH_EXTERNAL_AZURE_CLIENT_ID="<application client id>"
export SUPABASE_AUTH_EXTERNAL_AZURE_SECRET="<client secret>"
export SUPABASE_AUTH_EXTERNAL_AZURE_URL="https://login.microsoftonline.com/<tenant-id>/v2.0"
```

Herstart daarna `supabase start`.

**Cloud** (Supabase dashboard): ga naar **Authentication → Providers → Azure**, vul de Client ID,
Client Secret en de tenant-URL in, en zet de provider aan. Zet onder **Authentication → URL
Configuration** de **Redirect URLs** op jouw productie-domein plus `/auth/callback`.

## Schooldomein

Alleen e-mailadressen van `@my.nyenrode.nl` kunnen een account aanmaken; dit wordt afgedwongen in de
database (`allowed_email_domain()` in `supabase/migrations/0001_init.sql`), niet alleen in de
client.

## Belangrijke regels (zie ook de bouwprompt)

- Speelpunten hebben geen geldwaarde en zijn nooit inwisselbaar voor geld.
- Saldo's, posities, trades en het grootboek wijzigen uitsluitend via `security definer`
  databasefuncties; de client schrijft nooit rechtstreeks in die tabellen (Row Level Security staat
  overal aan).
- De `service_role`-sleutel van Supabase wordt nergens in deze app gebruikt en staat niet in
  `.env.example`.

## Uitrol: Supabase-cloudproject + Vercel

### 1. Supabase-cloudproject aanmaken

1. Ga naar [supabase.com/dashboard](https://supabase.com/dashboard) → **New project**. Kies een
   naam, wachtwoord voor de database en regio (bijv. Frankfurt voor een school in Nederland).
2. Koppel je lokale project aan het cloudproject:
   ```bash
   supabase link --project-ref <jouw-project-ref>
   ```
   (De project-ref staat in de dashboard-URL en onder **Project Settings → General**.)
3. Zet alle migraties (schema, cron, realtime) op het cloudproject:
   ```bash
   supabase db push
   ```
4. Zet `seed.sql` **niet** automatisch op productie (dat bevat testaccounts met een vast
   wachtwoord). Maak in plaats daarvan het eerste echte beheerdersaccount door zelf een keer in te
   loggen met `m.albers@my.nyenrode.nl` — dat account krijgt automatisch de rol `admin` (zie
   "Beheerdersaccount" hierboven).
5. Controleer onder **Database → Extensions** dat `pg_cron` en `pgtap` beschikbaar zijn (bij de
   meeste Supabase-plannen staan ze al aan; `pg_cron` wordt door migratie `0002` ingeschakeld).
6. Ga naar **Authentication → Multi-Factor** en zet **TOTP (Authenticator App)** aan. Zonder deze
   stap werkt `supabase/config.toml`'s `[auth.mfa.totp]` alleen lokaal — op het cloudproject moet
   MFA apart in het dashboard worden ingeschakeld, anders kan geen beheerder bij `/admin` komen.
7. Ga naar **Authentication → URL Configuration** en zet de **Site URL** en **Redirect URLs**
   voorlopig op `http://localhost:3000` en `http://localhost:3000/auth/callback` — dit stel je later
   bij naar je echte Vercel-domein.
8. (Optioneel maar aanbevolen voor meer dan een paar inloglinks per uur) stel onder
   **Authentication → Email → SMTP Settings** een eigen SMTP-provider in (bijv. via de schoolmail
   of een dienst als Resend/Postmark) — de standaard Supabase-mailer is bedoeld voor testen, niet
   voor een hele klas.

### 2. Omgevingsvariabelen

Haal de **Project URL** en **anon public key** op onder **Project Settings → API**, en zet ze in
Vercel (zie stap 3) als:

```
NEXT_PUBLIC_SUPABASE_URL=https://<jouw-project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon public key>
```

### 3. Deployen op Vercel

1. Push deze repository naar GitHub (of GitLab/Bitbucket).
2. Ga naar [vercel.com/new](https://vercel.com/new), importeer de repository.
3. Zet bij **Environment Variables** de twee variabelen uit stap 2.
4. Klik **Deploy**.
5. Zodra je het Vercel-domein weet (bijv. `campusmarkt.vercel.app` of een eigen domein), ga terug
   naar Supabase → **Authentication → URL Configuration** en zet de **Site URL** en
   **Redirect URLs** op dat echte domein plus `/auth/callback`.
6. Stel daarna, als je dat wilt, de Azure-provider in op het cloudproject (zie "Inloggen met
   schoolaccount" hierboven) met de production-redirect-URI
   `https://<jouw-project-ref>.supabase.co/auth/v1/callback`.

Nieuwe migraties die je later toevoegt, zet je telkens live met `supabase db push`.
