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

Het e-mailadres `m.albers@my.nyenrode.nl` krijgt automatisch de rol `admin` zodra het voor het
eerst inlogt (lokaal via de inloglink, of straks via het schoolaccount) — zie
`primary_admin_email()` in `supabase/migrations/0005_primary_admin_and_delete_market.sql`. Er is
daarnaast een los testaccount `admin@my.nyenrode.nl` (wachtwoord `campusmarkt-test`) voor lokaal
testen zonder je eigen adres te gebruiken.

Een beheerder kan markten aanmaken, openen/sluiten, uitbetalen, annuleren en uitsluitingen
beheren. **Verwijderen** kan alleen zolang een markt nog geen activiteit heeft (geen trades of
grootboekregels) — zodra er is gehandeld, moet je annuleren (`cancel_market`) zodat de inleg netjes
wordt teruggestort en het grootboek klopt. Dit is bewust net als bij Polymarket/Kalshi: een markt
met echte activiteit verdwijnt nooit stilletjes.

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
6. Ga naar **Authentication → URL Configuration** en zet de **Site URL** en **Redirect URLs**
   voorlopig op `http://localhost:3000` en `http://localhost:3000/auth/callback` — dit stel je in
   stap 3 hieronder bij naar je echte Vercel-domein.
7. (Optioneel maar aanbevolen voor meer dan een paar inloglinks per uur) stel onder
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
