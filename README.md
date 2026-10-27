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
   `supabase/seed.sql`. De terminal toont daarna een `API URL` en `publishable key`.

3. Kopieer `.env.example` naar `.env.local` en vul de waarden uit stap 2 in:

   ```bash
   cp .env.example .env.local
   ```

   ```
   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable key uit `supabase start`>
   ```

4. Start de Next.js-ontwikkelserver:

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

5. Inloggen: `/login` wordt momenteel herbouwd op een uitnodiging + activatiecode (en optioneel
   inloggen met Google) in plaats van een e-mail-inloglink — zie de livegangprompt voor de
   actuele stand. Zodra die fase klaar is, komt hier de bijbehorende lokale inlogstap terug.

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

## Prestaties testen

`supabase/seed_large.sql` vult de lokale database met ~150 extra studenten, 50 markten en zo'n
5.000 transacties (via de echte RPC's — zie de uitleg in het bestand zelf), om te zien hoe de app
zich houdt op een schaal die ver boven een pilot uitkomt. Draai dit **na** een normale
`supabase db reset`, dus niet als onderdeel ervan (anders kost elke gewone reset tijdens
ontwikkelen tientallen seconden extra):

```bash
supabase db reset
docker exec -i supabase_db_campusmarkt psql -U postgres -d postgres -f /dev/stdin < supabase/seed_large.sql
```

Log daarna in als `admin@my.nyenrode.nl` en controleer:

- `select * from check_ledger()` (via Studio's SQL-editor of een RPC-call) hoort niets terug te
  geven — als er wel rijen zijn, klopt het grootboek niet meer.
- De paginas `/`, `/activity`, `/leaderboard`, `/admin/users`, `/admin/log` en `/admin/stats`
  laden en tonen de juiste aantallen.

Met deze dataset (53 markten, 155 spelers, 5.000 trades) duurt `get_market_stats()` ~150ms in de
database, en laadt elke pagina in **productiebuild** (`npm run build && npm run start`) binnen
ongeveer 1-1,3 seconde. Test dit altijd met een productiebuild, niet met `npm run dev` — de
dev-server compileert routes on-demand en herbouwt bij elke bestandswijziging in de projectmap,
wat de resultaten vertekent (in dev leek dezelfde pagina soms 3+ seconden te duren, puur door die
herbouw-overhead, niet door de query's zelf).

Reset de database weer (`supabase db reset`) als je klaar bent met testen — de 150 extra
testaccounts en 50 testmarkten zijn niet bedoeld om te blijven staan.

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

## Inloggen en accounts (in herbouw)

De inlogmethode wordt vervangen: geen e-mailverkeer meer (geen magic links, geen Azure AD), maar
een door de beheerder uitgegeven **activatiecode** (en optioneel **inloggen met Google** voor
wie met een Gmail/Google-adres is uitgenodigd). Een account ontstaat alleen nog met een geldige
uitnodiging — de domeincontrole (`allowed_email_domain()`) die dat voorheen deed, wordt daardoor
overbodig en verdwijnt in de database-migratie die de uitnodigingen toevoegt. Zie de
livegangprompt voor de volledige opzet en status per fase.

## Rollen en beveiliging

Er zijn precies twee rollen: `student` (standaard) en `admin` (precies één account). De scheiding
wordt op meerdere, onafhankelijke plekken afgedwongen — niet op één plek die bij een foutje alles
openzet:

1. **Database**: elke tabel heeft RLS aan; de rol staat alleen in `profiles.role` (nooit in
   `user_metadata` of iets anders dat de client zelf kan meegeven) en wordt nergens via de app
   zelf gewijzigd. Elke muterende beheerfunctie begint met `if not is_admin_mfa() then raise
   exception 'Geen toegang'; end if;` — dat combineert "is dit een beheerder" én "heeft deze
   sessie MFA voltooid (aal2)".
2. **Server/middleware**: `getViewer()` (`lib/auth/getViewer.ts`) leest de rol en AAL vers uit de
   database/sessie bij elke request. Niet-beheerders die `/admin/**` proberen te bereiken krijgen
   een 404 (geen redirect — dat zou verraden dat het beheer bestaat); beheerders zonder AAL2
   worden naar `/admin/mfa` gestuurd.
3. **Layout**: `app/(app)/admin/layout.tsx` herhaalt de rolcheck, onafhankelijk van de middleware.
4. **UI**: de navigatie (`components/AppShell.tsx`) toont de "Beheer"-sectie en het
   "Beheerder"-label alleen als `isAdmin` klopt — maar dat is kosmetisch, geen beveiliging; de
   echte afdwinging zit in de drie lagen hierboven.

### Wie mag wat

| Actie | Niet ingelogd | Speler | Beheerder |
| --- | --- | --- | --- |
| Open/gesloten/afgewikkelde markten bekijken | ❌ | ✅ | ✅ |
| Conceptmarkten bekijken | ❌ | ❌ | ✅ |
| Handelen (tenzij geblokkeerd of uitgesloten) | ❌ | ✅ | ✅ (zichtbaar als "Beheerder" in het logboek) |
| Eigen profiel/posities/transacties lezen | ❌ | ✅ (alleen eigen) | ✅ (alle, alleen lezen) |
| Markt aanmaken/openen/sluiten/afwikkelen/annuleren/verwijderen | ❌ | ❌ | ✅ (MFA vereist) |
| Uitsluitingen beheren | ❌ | ❌ | ✅ (MFA vereist) |
| Spelers blokkeren/deblokkeren, punten corrigeren | ❌ | ❌ | ✅ (MFA vereist) |
| Auditlog lezen | ❌ | ❌ | ✅ |
| Rol `admin` toekennen | ❌ | ❌ | ❌ — alleen via een eenmalige, handmatige SQL-opdracht (zie "Beheerdersaccount" hierboven), nooit via de app |

Zie "Beheerdersaccount" hierboven voor hoe het beheerdersaccount wordt toegewezen, en
"Tweestapsverificatie (MFA) voor beheerders" voor het instellen, kwijtraken van de authenticator
en het compromitteringsplan.

### Controleren of de scheiding nog klopt

Twee hulpmiddelen om regressies op te sporen (beide alleen lokaal, tegen de lokale
Supabase-instantie en de testaccounts uit `seed.sql`):

```bash
npm run audit:roles   # database- en sessiechecks: RLS, grants, "Geen toegang" voor
                       # niet-beheerders/beheerders-zonder-MFA, en dat MFA het ook echt opent
npm run test:e2e       # Playwright: 404 voor niet-admin op /admin, MFA-verplichting, geen
                       # Beheer-navigatie voor spelers, geen handelsknop voor geblokkeerde spelers
```

`npm run audit:roles` (`scripts/role-audit.ts`) logt in als de vaste testaccounts, probeert elke
beheerfunctie aan te roepen vanuit elke rol/AAL-combinatie, en controleert via een directe
Postgres-verbinding dat RLS overal aanstaat, dat er precies één beheerder is, dat geen gevoelige
tabel een `using (true)`-leesbeleid heeft, en dat `anon` geen `EXECUTE` heeft op beheerfuncties.
`npm run test:e2e` (`e2e/roles.spec.ts`) test dezelfde scheiding vanuit een echte browser.

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
8. E-mailverkeer is niet meer nodig om in te loggen (uitnodigingen + activatiecode, en optioneel
   Google) — er is dus geen eigen SMTP-provider nodig. **Confirm email** mag uit blijven staan
   onder **Authentication → Sign In / Providers → Email**.

### 2. Omgevingsvariabelen

Haal de **Project URL** en **publishable key** op onder **Project Settings → API**, en zet ze in
Vercel (zie stap 3) als:

```
NEXT_PUBLIC_SUPABASE_URL=https://<jouw-project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable key>
```

### 3. Deployen op Vercel

1. Push deze repository naar GitHub (of GitLab/Bitbucket).
2. Ga naar [vercel.com/new](https://vercel.com/new), importeer de repository.
3. Zet bij **Environment Variables** de twee variabelen uit stap 2.
4. Klik **Deploy**.
5. Zodra je het Vercel-domein weet (bijv. `campusmarkt.vercel.app` of een eigen domein), ga terug
   naar Supabase → **Authentication → URL Configuration** en zet de **Site URL** en
   **Redirect URLs** op dat echte domein plus `/auth/callback`.

Nieuwe migraties die je later toevoegt, zet je telkens live met `supabase db push`.
