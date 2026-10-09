# NFC & QR Redirect Engine ⚡

Dynamisk omdirigeringssystem og administrasjonspanel for NFC-kort og Google Review QR-koder, drevet av Supabase og GitHub Pages.

---

## 🔒 Privat Tilgangskontroll (Admin-passord)

Ettersom administrasjonspanelet kun er ment for deg som administrator, er kontrollpanelet beskyttet med en privat passordlås:

- **Standardpassord:** `admin`
- **Slik endrer du passord:**
  1. Lås opp dashboardet med passordet.
  2. Klikk på tannhjulet (**Innstillinger**) øverst til høyre.
  3. Skriv inn ditt nye hemmelige passord i feltet **«Privat Admin-passord»**.
  4. Klikk **«Lagre Innstillinger»**.
- **Slik låser du dashboardet:** Klikk på **«Lås»**-knappen i toppmenyen når du forlater siden. Innloggingen huskes i nettleserøkten din (sessionStorage) så du slipper å skrive det inn på hvert klikk.

> ℹ️ **Viktig om omdirigeringen for kunder:**  
> Kundeomdirigeringen (`r.html?id=kafe-hansen`) krever **aldri** passord! Når en gjest berører et fysisk NFC-kort eller skanner en QR-kode, registreres klikket og kunden videresendes umiddelbart (< 0.2 sekunder) til Google Review-siden.

---

## 🚀 Slik pusher du oppdateringer til GitHub

Når du har gjort endringer eller oppdatert nøkler, kjører du disse kommandoene i terminalen:

```bash
git add .
git commit -m "Oppdatering av prosjekt og innstillinger"
git push origin main
```

*(Hvis du ikke har koblet opp repositoryet ennå, kjør `git remote add origin https://github.com/DITT-BRUKERNAVN/DITT-REPO.git` og `git branch -M main` før første push).*

---

## 🌐 GitHub Pages Oppsett

Prosjektet er optimalisert for GitHub Pages og håndterer automatisk undermapper (som `https://brukernavn.github.io/repo-navn/`).

### Metode 1: GitHub Actions (Anbefalt)
1. Gå til repositoriet ditt på GitHub.
2. Velg **Settings** → **Pages**.
3. Under **Build and deployment → Source**, velg **GitHub Actions**.
4. GitHub vil nå automatisk bygge og publisere siden via `.github/workflows/deploy.yml` hver gang du pusher til `main`.

### Metode 2: Deploy fra /docs-mappen
1. Bygg docs lokalt hvis du har gjort endringer:
   ```bash
   npm run build:docs
   git add docs && git commit -m "build: update docs" && git push origin main
   ```
2. Gå til **Settings** → **Pages** på GitHub.
3. Velg **Deploy from a branch** → Branch **main** og mappe **/docs** → **Save**.

---

## 🔗 Dine adresser

Når siden kjører på ditt domene eller GitHub Pages:

| Formål | Adresse | Tilgang |
| :--- | :--- | :--- |
| **Admin Dashboard (Hovedportal)** | `https://dittdomene.no/` | 🔒 Krever passord |
| **Admin Dashboard (Alternativ fil)** | `https://dittdomene.no/admin.html` | 🔒 Krever passord |
| **Kunde-omdirigering (NFC / QR)** | `https://dittdomene.no/r.html?id=[slug]` | 🌍 Offentlig & lynrask |

---

## 📱 Slik programmerer du NFC-kort

1. Last ned gratisappen **NFC Tools** på iPhone (App Store) eller Android (Google Play).
2. Opprett en bedrift i dashboardet (f.eks. slug: `kafe-hansen`).
3. Trykk på **«Kopier lenke»** i dashboardet for å kopiere `https://dittdomene.no/r.html?id=kafe-hansen`.
4. I NFC Tools-appen:
   - Velg **Write** (Skriv).
   - Velg **Add a record** → **URL / URI**.
   - Lim inn den kopierte adressen.
   - Velg **Write / 18 Bytes** og hold mobiltelefonen inntil NFC-kortet eller klistremerket til du får bekreftelse.
5. Kortet er nå klart til bruk! Hver gang en kunde taper på kortet, telles klikket automatisk i Supabase og kunden sendes rett til anmeldelsessiden.

---

## 🗄️ Supabase Oppsett (Database & RLS)

Hvis du skal sette opp et nytt prosjekt i Supabase, lim inn følgende i **SQL Editor**:

```sql
-- 1. Opprett tabell for omdirigeringer
create table if not exists public.redirects (
  id text primary key,
  google_url text not null,
  clicks bigint default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Aktiver Row Level Security (RLS)
alter table public.redirects enable row level security;

-- 3. Åpne tilganger for lesing, oppretting, oppdatering og sletting
create policy "Allow public read" on public.redirects for select using (true);
create policy "Allow public insert" on public.redirects for insert with check (true);
create policy "Allow public update" on public.redirects for update using (true);
create policy "Allow public delete" on public.redirects for delete using (true);
```
