-- Jalankan sekali di Supabase (SQL Editor) bila STORE_BACKEND = 'supabase' di js/config.js.
-- Tabel katalog (app_data) milik web Cek Harga & Stok tidak disentuh.

create table if not exists public.nota (
  id text primary key,
  no text not null unique,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  data jsonb not null
);

create table if not exists public.sales_users (
  code text primary key,
  data jsonb not null
);

alter table public.nota enable row level security;
alter table public.sales_users enable row level security;

-- Kunci anon ada di kode web (sama seperti app_data), jadi siapa pun yang punya kunci itu bisa membaca dan
-- menulis dua tabel ini. Cukup untuk jaringan internal; untuk pembatasan sungguhan pakai Supabase Auth.
create policy "nota anon read" on public.nota for select to anon using (true);
create policy "nota anon insert" on public.nota for insert to anon with check (true);
create policy "nota anon update" on public.nota for update to anon using (true) with check (true);
create policy "sales anon read" on public.sales_users for select to anon using (true);
create policy "sales anon insert" on public.sales_users for insert to anon with check (true);
create policy "sales anon update" on public.sales_users for update to anon using (true) with check (true);
