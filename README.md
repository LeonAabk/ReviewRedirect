# NFC & QR Redirect Engine (Supabase + GitHub Pages)

Dynamisk omdirigeringssystem for NFC-kort og Google Review QR-koder.

---

## 🚀 Slik pusher du prosjektet til GitHub

Hvis du har opprettet et nytt repository på GitHub (f.eks. `nfc-redirect`):

### 1. Koble til GitHub-repositoriet ditt
Kjør disse kommandoene i terminalen (bytt ut `DITT-BRUKERNAVN` og `DITT-REPO` med dine opplysninger):

```bash
git remote add origin https://github.com/DITT-BRUKERNAVN/DITT-REPO.git
git branch -M main
git push -u origin main
```

> **Tips hvis GitHub klager over at repositoriet allerede inneholder en README/fil:**
> ```bash
> git pull origin main --rebase
> git push -u origin main
> # Eller for å overskrive:
> git push -u origin main --force
> ```

---

## 🌐 Aktivere GitHub Pages

Prosjektet er nå klargjort for GitHub Pages på to måter:

### Alternativ A: Automatisk med GitHub Actions (Anbefalt)
1. Gå til repositoriet ditt på GitHub.
2. Klikk på **Settings** (Innstillinger) → **Pages** i venstremenyen.
3. Under **Build and deployment → Source**, velg **GitHub Actions**.
4. Workflow-filen `.github/workflows/deploy.yml` vil automatisk bygge og publisere nettsiden hver gang du pusher til `main`.

### Alternativ B: Rask publisering via `/docs`-mappen
1. Gå til **Settings** → **Pages**.
2. Under **Build and deployment → Source**, velg **Deploy from a branch**.
3. Velg **Branch: main** og mappen **/docs**, og trykk **Save**.

---

## 🔗 Dine adresser på GitHub Pages

Når siden er publisert på GitHub Pages (f.eks. `https://dittbrukernavn.github.io/ditt-repo/`):

- **Omdirigeringsmotor:**  
  `https://dittbrukernavn.github.io/ditt-repo/r.html?id=kafe-hansen`
- **Admin Dashboard:**  
  `https://dittbrukernavn.github.io/ditt-repo/admin.html`
- **Hovedportal:**  
  `https://dittbrukernavn.github.io/ditt-repo/`

> Merk: Systemet oppdager automatisk undermappen på GitHub Pages (`/ditt-repo/`), slik at "Kopier lenke"-knappen og QR-kodene alltid genererer riktig full adresse.

---

## 🗄️ Supabase Oppsett

Husk å kjøre dette i Supabase **SQL Editor**:

```sql
create table if not exists public.redirects (
  id text primary key,
  google_url text not null,
  clicks bigint default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.redirects enable row level security;

create policy "Allow public read" on public.redirects for select using (true);
create policy "Allow public insert" on public.redirects for insert with check (true);
create policy "Allow public update" on public.redirects for update using (true);
create policy "Allow public delete" on public.redirects for delete using (true);
```
