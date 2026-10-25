-- Apply after account-inventories.sql. Separate immutable, owner-only snapshots.
begin;
create table if not exists public.inventory_account_backups (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default clock_timestamp(),
 revision integer not null,
 kind text not null check (kind in ('initial','automatic','manual','before_restore')),
 data jsonb not null check (jsonb_typeof(data)='object' and jsonb_typeof(data->'receipts')='array' and jsonb_typeof(data->'issues')='array'),
 receipt_count integer generated always as (jsonb_array_length(data->'receipts')) stored,
 issue_count integer generated always as (jsonb_array_length(data->'issues')) stored,
 unit text generated always as (coalesce(data->>'unit','bags (LKg)')) stored
);
create index if not exists account_backups_history on public.inventory_account_backups(owner_id,created_at desc,id desc);
create unique index if not exists account_backups_revision on public.inventory_account_backups(owner_id,revision) where kind in ('initial','automatic');
alter table public.inventory_account_backups enable row level security;
drop policy if exists account_backups_owner_read on public.inventory_account_backups;
create policy account_backups_owner_read on public.inventory_account_backups for select to authenticated using (owner_id=(select auth.uid()));
revoke all on public.inventory_account_backups from public,anon,authenticated;
grant select on public.inventory_account_backups to authenticated;

create or replace function public.capture_inventory_account_backup()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if TG_OP='INSERT' then
  insert into public.inventory_account_backups(owner_id,revision,kind,data) values(new.owner_id,new.revision,'initial',new.data) on conflict do nothing;
 elsif new.data is distinct from old.data then
  -- Also preserve the prior state if this is the first write after activation.
  insert into public.inventory_account_backups(owner_id,revision,kind,data) values(old.owner_id,old.revision,'automatic',old.data) on conflict do nothing;
  insert into public.inventory_account_backups(owner_id,revision,kind,data) values(new.owner_id,new.revision,'automatic',new.data) on conflict do nothing;
 end if;
 return new;
end $$;
revoke all on function public.capture_inventory_account_backup() from public,anon,authenticated;
drop trigger if exists capture_account_backup on public.inventory;
create trigger capture_account_backup after insert or update of data on public.inventory for each row execute function public.capture_inventory_account_backup();
-- Preserve every account's current state when the feature is activated.
insert into public.inventory_account_backups(owner_id,revision,kind,data)
 select owner_id,revision,'initial',data from public.inventory on conflict do nothing;

create or replace function public.create_inventory_backup()
returns uuid language plpgsql security definer set search_path='' as $$
declare current_inventory public.inventory%rowtype; backup_id uuid;
begin
 if auth.uid() is null then raise exception 'Sign in required' using errcode='42501';end if;
 select * into current_inventory from public.inventory where owner_id=auth.uid() for update;
 if not found then raise exception 'Inventory not found' using errcode='P0002';end if;
 insert into public.inventory_account_backups(owner_id,revision,kind,data)
 values(current_inventory.owner_id,current_inventory.revision,'manual',current_inventory.data) returning id into backup_id;
 return backup_id;
end $$;
revoke all on function public.create_inventory_backup() from public,anon;
grant execute on function public.create_inventory_backup() to authenticated;

create or replace function public.restore_inventory_backup(backup_id uuid,expected_revision integer)
returns integer language plpgsql security definer set search_path='' as $$
declare current_inventory public.inventory%rowtype; snapshot jsonb; saved_revision integer;
begin
 if auth.uid() is null then raise exception 'Sign in required' using errcode='42501';end if;
 select * into current_inventory from public.inventory where owner_id=auth.uid() for update;
 if not found then raise exception 'Inventory not found' using errcode='P0002';end if;
 if current_inventory.revision is distinct from expected_revision then return null;end if;
 select data into snapshot from public.inventory_account_backups where id=backup_id and owner_id=auth.uid();
 if not found then raise exception 'Backup not found' using errcode='P0002';end if;
 -- This safety snapshot and the restore commit together; a failed restore changes neither.
 insert into public.inventory_account_backups(owner_id,revision,kind,data)
 values(current_inventory.owner_id,current_inventory.revision,'before_restore',current_inventory.data);
 snapshot:=jsonb_set(snapshot,'{activity}',jsonb_build_array(jsonb_build_object(
  'id',gen_random_uuid()::text,'at',clock_timestamp(),'summary','Restored account backup'
 )) || coalesce(current_inventory.data->'activity','[]'::jsonb));
 snapshot:=jsonb_set(snapshot,'{activity}',coalesce((select jsonb_agg(e.value order by e.n) from jsonb_array_elements(snapshot->'activity') with ordinality e(value,n) where e.n<=200),'[]'::jsonb));
 update public.inventory set data=snapshot,revision=revision+1,updated_at=now()
 where id=current_inventory.id and owner_id=auth.uid() returning revision into saved_revision;
 return saved_revision;
end $$;
revoke all on function public.restore_inventory_backup(uuid,integer) from public,anon;
grant execute on function public.restore_inventory_backup(uuid,integer) to authenticated;
notify pgrst,'reload schema';
commit;
