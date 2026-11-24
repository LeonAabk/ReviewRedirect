-- =====================================================================
-- ReviewRedirect: sikker tilgang til public.redirects
-- Kjøres i Supabase → SQL Editor. Trygt å kjøre flere ganger.
-- Kortene (r.html) virker hele tiden: offentlig lesing beholdes.
-- =====================================================================

-- 1. Fjern de åpne skrivereglene (alle kunne endre/slette kort)
drop policy if exists "Allow public insert" on public.redirects;
drop policy if exists "Allow public update" on public.redirects;
drop policy if exists "Allow public delete" on public.redirects;

-- 2. Liste over admin-brukere (ingen regler = ingen kan lese/endre den via nettsiden)
create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);
alter table public.admins enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- 3. Bare innloggede admin-brukere kan opprette, endre og slette kort
drop policy if exists "Admin insert" on public.redirects;
drop policy if exists "Admin update" on public.redirects;
drop policy if exists "Admin delete" on public.redirects;

create policy "Admin insert" on public.redirects
  for insert to authenticated
  with check (public.is_admin());

create policy "Admin update" on public.redirects
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admin delete" on public.redirects
  for delete to authenticated
  using (public.is_admin());

-- 4. Trykk-telling: alle kan bare legge til +1 på ett kort, ingenting annet
create or replace function public.increment_click(card_id text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.redirects
  set clicks = coalesce(clicks, 0) + 1
  where lower(id) = lower(card_id);
$$;

revoke all on function public.increment_click(text) from public;
grant execute on function public.increment_click(text) to anon, authenticated;

-- 5. Gjør deg selv til admin. Bytt ut e-posten med den du opprettet
--    under Authentication → Users (skriv den bare inn her i editoren,
--    ikke lagre den i repoet).
insert into public.admins (user_id)
select id from auth.users where email = 'DIN-EPOST-HER'
on conflict do nothing;

-- 6. Kontroll: skal vise "Allow public read" (SELECT) + de tre Admin-reglene,
--    og admins skal ha 1 rad.
select policyname, cmd, roles from pg_policies where tablename = 'redirects';
select count(*) as antall_admins from public.admins;
