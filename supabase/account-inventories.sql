-- Upgrade the existing shared installation to independent account inventories.
-- Replace YOUR_EXISTING_OWNER_EMAIL with the original owner’s sign-in email.
-- The owner is verified before changing anything. Run this entire transaction once.
begin;
create schema if not exists inventory_backup;
revoke all on schema inventory_backup from public,anon,authenticated;
create table if not exists inventory_backup.before_accounts_inventory as table public.inventory;
create table if not exists inventory_backup.before_accounts_shares as table public.inventory_shares;
alter table inventory_backup.before_accounts_inventory enable row level security;
alter table inventory_backup.before_accounts_shares enable row level security;
revoke all on all tables in schema inventory_backup from public,anon,authenticated;

alter table public.inventory add column if not exists owner_id uuid references auth.users(id) on delete cascade;
alter table public.inventory_shares add column if not exists owner_id uuid references auth.users(id) on delete cascade;
do $$
declare original_owner uuid;
begin
 select id into original_owner from auth.users where lower(email)=lower('YOUR_EXISTING_OWNER_EMAIL');
 if original_owner is null then raise exception 'Original owner account not found. No changes applied.';end if;
 update public.inventory set owner_id=original_owner where id='main' and owner_id is null;
 update public.inventory_shares set owner_id=original_owner where id='main' and owner_id is null;
end $$;
alter table public.inventory alter column owner_id set not null;
alter table public.inventory_shares alter column owner_id set not null;
alter table public.inventory drop constraint if exists inventory_id_check;
alter table public.inventory_shares drop constraint if exists inventory_shares_id_check;
create unique index if not exists inventory_owner_unique on public.inventory(owner_id);
create unique index if not exists inventory_shares_owner_unique on public.inventory_shares(owner_id);
alter table public.inventory_shares alter column enabled set default false;
alter table public.inventory_shares alter column slug drop default;

-- Remove shared-member policies so no old policy can bypass ownership.
do $$ declare p record;begin
 for p in select tablename,policyname from pg_policies where schemaname='public' and tablename in ('inventory','inventory_shares') loop
 execute format('drop policy %I on public.%I',p.policyname,p.tablename);
 end loop;
end $$;
alter table public.inventory enable row level security;
alter table public.inventory_shares enable row level security;
create policy inventory_owner_read on public.inventory for select to authenticated using(owner_id=(select auth.uid()));
create policy inventory_owner_write on public.inventory for update to authenticated using(owner_id=(select auth.uid())) with check(owner_id=(select auth.uid()));
create policy shares_owner_read on public.inventory_shares for select to authenticated using(owner_id=(select auth.uid()));
create policy shares_owner_write on public.inventory_shares for update to authenticated using(owner_id=(select auth.uid())) with check(owner_id=(select auth.uid()));
revoke all on public.inventory,public.inventory_shares from public,anon,authenticated;
grant select on public.inventory,public.inventory_shares to authenticated;
grant update(data,revision,updated_at) on public.inventory to authenticated;
grant update(token,enabled,slug) on public.inventory_shares to authenticated;

create or replace function public.provision_account_inventory(account_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare inventory_id text;
begin
 if account_id is null then raise exception 'Account required';end if;
 insert into public.inventory(id,owner_id,data)
 values('account-'||account_id::text,account_id,'{"unit":"bags (LKg)","receipts":[],"issues":[],"clients":[],"seq":0,"clientProfiles":{},"activity":[],"lowStockPercent":20}'::jsonb)
 on conflict(owner_id) do nothing;
 select id into inventory_id from public.inventory where owner_id=account_id;
 insert into public.inventory_shares(id,owner_id,slug,enabled)
 values(inventory_id,account_id,'inventory-'||account_id::text,false)
 on conflict(owner_id) do nothing;
end $$;
revoke all on function public.provision_account_inventory(uuid) from public,anon,authenticated;

create or replace function public.on_account_created()
returns trigger language plpgsql security definer set search_path='' as $$
begin perform public.provision_account_inventory(new.id);return new;end $$;
revoke all on function public.on_account_created() from public,anon,authenticated;
drop trigger if exists create_personal_inventory on auth.users;
create trigger create_personal_inventory after insert on auth.users for each row execute function public.on_account_created();

-- Backfill existing registered accounts without copying the original owner's records.
do $$ declare account record;begin
 for account in select id from auth.users loop perform public.provision_account_inventory(account.id);end loop;
end $$;
create or replace function public.ensure_inventory()
returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Sign in required';end if;
 perform public.provision_account_inventory(auth.uid());
end $$;
revoke all on function public.ensure_inventory() from public,anon;
grant execute on function public.ensure_inventory() to authenticated;

create or replace function public.save_inventory(expected_revision integer,new_data jsonb)
returns integer language plpgsql security invoker set search_path='' as $$
declare saved_revision integer;
begin
 update public.inventory set data=new_data,revision=revision+1,updated_at=now()
 where owner_id=(select auth.uid()) and revision=expected_revision returning revision into saved_revision;
 return saved_revision;
end $$;
revoke all on function public.save_inventory(integer,jsonb) from public,anon;
grant execute on function public.save_inventory(integer,jsonb) to authenticated;
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
 where s.enabled and s.token=share_token;
$$;
revoke all on function public.get_public_inventory(uuid) from public;
grant execute on function public.get_public_inventory(uuid) to anon, authenticated;

create or replace function public.get_public_inventory_by_slug(share_slug text)
returns jsonb language sql stable security definer set search_path='' as $$
 select public.get_public_inventory(s.token) from public.inventory_shares s where s.enabled and s.slug=share_slug;
$$;
revoke all on function public.get_public_inventory_by_slug(text) from public;
grant execute on function public.get_public_inventory_by_slug(text) to anon,authenticated;
commit;
