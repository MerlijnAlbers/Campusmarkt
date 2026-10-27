# Livegang-checklist

Dit bestand bevat alleen de stappen die je **zelf in een browser** moet doen (GitHub, Vercel,
Supabase-dashboard, Google Cloud) — alles wat met git, de Supabase CLI of SQL kan, is al
gedaan. Vink af wat je hebt gedaan; de volgorde hieronder is de volgorde waarin het moet.

## 1. GitHub

Niets te doen — de repository bestaat al (`MerlijnAlbers/Campusmarkt`) en is al gekoppeld.
De code van Fase 1–5 wordt in deze livegang in één keer gepusht.

## 2. Supabase-cloudproject

- [x] Migratie `0011_invitations.sql` gepusht naar het cloudproject (`supabase db push`).
- [x] `app_config.admin_email` gezet op `m.albers@my.nyenrode.nl` (via SQL, niet via een
      migratie/commit).
- [x] **Confirm email** staat uit (`mailer_autoconfirm=true`) en minimale wachtwoordlengte is 8
      (via de Management API) — geen actie meer nodig.
- [x] **Redirect-allowlist** herzet naar zowel `localhost:3000` als het Vercel-domein (was
      tussentijds teruggevallen op alleen localhost) — geen actie meer nodig.
- [ ] **Authentication → Emails / SMTP**: niets aan te passen — er wordt geen e-mail meer
      verstuurd, dus de Resend-SMTP-instelling (nog steeds "Pending") mag gewoon blijven staan
      zoals hij is. Geen actie nodig.
- [ ] **Authentication → Providers → Google**: **nog niet instellen.** Dit is bewust uitgesteld
      (de meeste studenten hebben toch een Microsoft-schoolaccount) — de "Inloggen met
      Google"-knop staat al in de code voor als je dit later wel wilt inschakelen.

## 3. Jouw eigen beheerderswachtwoord instellen (eenmalig, bewust alleen door jou)

Je bestaande beheerdersaccount (`m.albers@my.nyenrode.nl`) is destijds aangemaakt via de
inmiddels verwijderde e-mail-inloglink, en heeft dus **nooit een wachtwoord gehad**. Zonder actie
kun je na deze livegang niet meer inloggen op de live site.

- [ ] Ga naar het Supabase-dashboard van het cloudproject → **SQL Editor**, en voer dit uit met
      een **zelf gekozen 8-cijferige code** (verzin die cijfers zelf — niet aan mij doorgeven,
      dit is precies de bedoeling: alleen jij kent je eigen resetcode):
      ```sql
      insert into invitations (email, purpose, code_hash, expires_at)
      values ('m.albers@my.nyenrode.nl', 'reset',
              crypt('<JOUW-EIGEN-8-CIJFERS>', gen_salt('bf')),
              now() + interval '2 hours');
      ```
- [ ] Ga daarna (binnen 2 uur) naar `https://<jouw-vercel-domein>/reset`, vul je e-mailadres, je
      zojuist gekozen code en een nieuw wachtwoord in. Je kunt daarna inloggen op `/login` met
      e-mail + dat wachtwoord.

## 4. Vercel: omgevingsvariabelen bijwerken

De naam van de publieke sleutel is veranderd, en er komt één nieuwe, geheime variabele bij.
Zonder deze stap werkt de live site niet meer na de volgende deploy.

- [ ] Vercel-project → **Settings → Environment Variables**.
- [ ] Hernoem (of verwijder + voeg opnieuw toe) `NEXT_PUBLIC_SUPABASE_ANON_KEY` naar
      **`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`** — zelfde waarde (`sb_publishable_...`), alleen
      de naam verandert. Type: gewoon (niet Secret), alle omgevingen.
- [ ] Voeg een nieuwe variabele toe: **`SUPABASE_SECRET_KEY`** = de **secret key**
      (`sb_secret_...`, niet de publishable key) uit **Project Settings → API Keys** van het
      Supabase-cloudproject. Type: **Secret**. Omgeving: **Production** (lokaal gebruik je al de
      lokale service-rolesleutel via `.env.local`, die hoeft hier niet mee).
- [ ] Sla op. Als er al een deployment liep vóór je dit opsloeg: **Deployments → ⋯ → Redeploy**
      op de nieuwste deployment, zodat de nieuwe variabelen worden meegenomen.

## 5. Rooktest op de live site

- [ ] `/login` laadt en toont de Google-knop + e-mail/wachtwoord-formulier (geen inloglink-tekst
      meer).
- [ ] Inloggen als beheerder (stap 3) werkt, en `/admin/invitations` is zichtbaar na MFA.
- [ ] Een test-uitnodiging aanmaken en in een privévenster activeren op `/activate` werkt, en de
      status springt in het overzicht op "Gebruikt".

## 6. Optioneel, later: Google Cloud OAuth

Alleen nodig als je besluit dat "Inloggen met Google" toch de moeite waard is (bijv. voor
studenten met een Gmail-adres). Niet nodig voor de pilot.

1. [console.cloud.google.com](https://console.cloud.google.com) → nieuw project "Campusmarkt".
2. **Google Auth Platform → Branding**: type External, appnaam Campusmarkt, support-e-mail
   `m.albers@my.nyenrode.nl`, scopes `openid`, `email`, `profile`. Publiceer de app (status "In
   production"), anders kunnen alleen handmatig toegevoegde testgebruikers inloggen.
3. **Clients → Create client → Web application**:
   - Authorized JavaScript origins: je Vercel-domein + `http://localhost:3000`.
   - Authorized redirect URI: `https://oqveehigdehviixaigjo.supabase.co/auth/v1/callback`.
4. Kopieer Client ID + Client Secret naar Supabase-dashboard → **Authentication → Providers →
   Google**, en zet de provider aan.
