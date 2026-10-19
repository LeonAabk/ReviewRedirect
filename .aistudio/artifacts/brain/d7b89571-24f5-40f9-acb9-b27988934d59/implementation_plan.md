# Implementasjonsplan: Felles Serverlagring & Universell NFC-Omdirigering

Løsning for å sikre at alle telefoner (kunder og besøkende) som tapper de fysiske NFC-kortene eller skanner QR-kodene umiddelbart sendes direkte til riktig Google Maps-anmeldelse eller destinasjons-URL, uten at de stopper på låseskjermer eller feilmeldinger, og uten tap av allerede programmerte kort.

---

## 1. Problembeskrivelse & Årsak

1. **Klient-lokal lagring (`localStorage`):**
   * Når du har opprettet og testet kort på egen telefon, har dataene og innstillingene ligget i nettleserens lokale lagring på din egen enhet.
   * Når en kunde eller annen telefon tapper kortet (`r.html?id=...`), er deres `localStorage` tom. Uten en felles serverkilde eller direkte nøkler stopper nettleseren opp og viser «Supabase er ikke konfigurert» eller låseskjermen.
2. **Beskyttelse av eksisterende kort:**
   * De fysiske NFC-brikkene dine er programmert med faste slug-adresser (f.eks. `https://.../r.html?id=kafe-hansen` eller `/?id=kafe-hansen`).
   * Disse adressene skal **ikke** endres, og brikkene trenger ikke programmeres på nytt.

---

## 2. Arkitektur & Løsningsdesign

### A. Felles Server-Database (`/api/redirects` & `data/redirects.json`)
* **Sentral serverlagring:** Opprette et lettbent, pålitelig server-endepunkt (`/api/redirects` og `/api/redirect/:id`) i Express/Vite-serveren som lagrer alle kort og klikk i en felles, persistent fil (`data/redirects.json`).
* **Offentlig API for omdirigering:** `GET /api/redirect/:id` er åpent for alle og returnerer lynraskt destinasjons-URL (`google_url`) og registrerer klikk, uten behov for at kunden har passord, sesjon eller API-nøkler.
* **Sikker administrasjon:** Opprettelse, oppdatering og sletting av kort krever admin-autentisering, mens omdirigering er 100% offentlig.

### B. Automatisk migrering av dine eksisterende kort (Ingen tap av data)
* Når administrasjonspanelet lastes på din telefon, vil systemet automatisk detektere alle kort som ligger i din lokale `localStorage` og synkronisere dem opp til den felles serverdatabasen.
* Det legges også til en manuell knapp: **«Synkroniser lokale kort til felles server»** med statusbekreftelse, slik at du har full kontroll og garanti for at alle kortene du allerede har programmert er trygt lagret sentralt.

### C. Universell Omdirigering på både `/r.html` og rot-siden (`/`)
* **På `/r.html?id=...`:**
  * Henter umiddelbart destinasjon fra `GET /api/redirect/:id`.
  * Utfører umiddelbar omdirigering (`window.location.href = targetUrl`) og lukking av fanen.
  * Dersom API-kallet tar tid, brukes cached fallback.
* **På rot-siden (`/?id=...`):**
  * Dersom noen tapper et kort som peker til hoveddomenet med `?id=...`, vil React-appen fange opp dette *før* passordskjermen vises, hente destinasjonen og videresende brukeren direkte til Google Maps.
* **På servernivå:** Støtte direkte omdirigerings-ruter som `/r/:id` for maksimal fleksibilitet.

---

## 3. Brukeropplevelse & Grensesnitt

1. **For kunden (NFC Tap):**
   * Tapper kortet på telefonen.
   * Sendes direkte og umiddelbart til bedriftens Google Maps / Review-side.
   * Ingen låseskjerm, ingen passordforespørsel, ingen feilmelding.
2. **For deg (Admin Dashboard):**
   * Grønn statusindikator i toppen: **«Felles serverlagring aktiv (Alle telefoner har tilgang)»**.
   * Oversikt over alle registrerte kort med felles klikkteller.
   * Redigering av kortnavn/Kort-ID og destinasjons-URL oppdateres umiddelbart på serveren.

---

## 4. Trinnvis Gjennomføringsplan

1. **Serverlagring & API-ruter:**
   * Opprette `data/redirects.json` med standard og eksisterende kort.
   * Implementere serverruter i `server.ts` / Vite middleware:
     - `GET /api/redirect/:id` (henter URL og øker klikk)
     - `GET /api/redirects` (henter alle for admin)
     - `POST /api/redirects` (lagrer eller synkroniserer kort)
     - `PUT /api/redirects/:id` (oppdaterer Kort-ID og URL)
     - `DELETE /api/redirects/:id` (sletter kort)
2. **Oppdatering av `r.html` og `public/r.html`:**
   * La omdirigeringsskriptet kalle `/api/redirect/:id` direkte for umiddelbar respons på alle enheter uten avhengighet til tredjepartstjenester.
3. **Oppdatering av `src/App.tsx` (React Dashboard & Omdirigering):**
   * Lytte på `?id=` i URL-en slik at rot-siden videresender umiddelbart dersom et kort peker dit.
   * Legge inn automatisk import/synkronisering av eksisterende kort fra `localStorage` til serveren.
   * Oppdatere lagring, sletting og redigering til å synke mot server-API-et.
4. **Verifisering:**
   * Teste omdirigering i en privat/inkognito fane (simulerer en fremmed kundes telefon uten lagrede data eller innlogging).
   * Verifisere at klikk registreres og at alle eksisterende kort forblir intakte.
