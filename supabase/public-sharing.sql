-- Run once after setup.sql. Anonymous users keep NO access to inventory tables.
begin;
create table if not exists public.inventory_shares (
  id text primary key check (id='main'),
  token uuid not null unique default gen_random_uuid(),
  enabled boolean not null default true
);
alter table public.inventory_shares enable row level security;
insert into public.inventory_shares(id) values ('main') on conflict do nothing;
drop policy if exists shares_read on public.inventory_shares;
create policy shares_read on public.inventory_shares for select to authenticated
using (exists(select 1 from public.inventory_members where user_id=(select auth.uid())));
drop policy if exists shares_update on public.inventory_shares;
create policy shares_update on public.inventory_shares for update to authenticated
using (exists(select 1 from public.inventory_members where user_id=(select auth.uid())))
with check (exists(select 1 from public.inventory_members where user_id=(select auth.uid())));
revoke all on public.inventory_shares from anon, authenticated;
grant select on public.inventory_shares to authenticated;
grant update(token,enabled) on public.inventory_shares to authenticated;

-- Bearer-link authorization: the exact random token AND enabled flag are required.
-- SECURITY DEFINER is intentional: a narrowly scoped read projection only.
create or replace function public.get_public_inventory(share_token uuid)
returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
   'unit',i.data->'unit','seq',i.data->'seq',
   'lowStockPercent',coalesce(i.data->'lowStockPercent','20'::jsonb),
   'receipts',coalesce((select jsonb_agg(jsonb_build_object(
     'id',r->'id','date',r->'date','sro',r->'sro','type',r->'type',
     'mill',r->'mill','crop',r->'crop','qty',r->'qty'
   )) from jsonb_array_elements(i.data->'receipts') r),'[]'::jsonb),
   'issues',coalesce((select jsonb_agg(jsonb_build_object(
     'id',r->'id','date',r->'date','sro',r->'sro','type',r->'type',
     'client',r->'client','qty',r->'qty','seq',r->'seq','batch',r->'batch',
     'atw',r->'atw','permit',r->'permit','waybill',r->'waybill',
     'bol',r->'bol','vessel',r->'vessel','voy',r->'voy','sail',r->'sail'
   )) from jsonb_array_elements(i.data->'issues') r),'[]'::jsonb),
   'clients','[]'::jsonb,'clientProfiles','{}'::jsonb,'activity','[]'::jsonb
 ) from public.inventory i join public.inventory_shares s on s.id=i.id
 where i.id='main' and s.enabled and s.token=share_token;
$$;
revoke all on function public.get_public_inventory(uuid) from public;
grant execute on function public.get_public_inventory(uuid) to anon, authenticated;
commit;
