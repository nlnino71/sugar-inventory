-- Run after account-inventories.sql, as the project owner in Supabase SQL Editor.
-- Pins the existing, confirmed owner account; no client can grant this role.
begin;
create table if not exists public.inventory_admins(user_id uuid primary key references auth.users(id) on delete cascade);
alter table public.inventory_admins enable row level security;
revoke all on public.inventory_admins from public,anon,authenticated;
do $$ declare owner_id uuid; begin
 select id into owner_id from auth.users where lower(email)='jcnino16@gmail.com' and email_confirmed_at is not null;
 if owner_id is null then raise exception 'Confirm jcnino16@gmail.com before installing superadmin.'; end if;
 insert into public.inventory_admins values(owner_id) on conflict do nothing;
end $$;
create or replace function public.is_inventory_admin() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.inventory_admins where user_id=auth.uid());
$$;
revoke all on function public.is_inventory_admin() from public,anon;
grant execute on function public.is_inventory_admin() to authenticated;
create table if not exists public.inventory_audit(
 id bigint generated always as identity primary key,
 occurred_at timestamptz not null default now(),
 actor_id uuid, owner_id uuid, event text not null, details jsonb not null default '{}'::jsonb
);
alter table public.inventory_audit enable row level security;
revoke all on public.inventory_audit from public,anon,authenticated;
create or replace function public.audit_inventory_change() returns trigger language plpgsql security definer set search_path='' as $$
declare row_data jsonb:=to_jsonb(new);
begin
 insert into public.inventory_audit(actor_id,owner_id,event,details) values(auth.uid(),new.owner_id,TG_TABLE_NAME||'.'||lower(TG_OP),
 case when TG_TABLE_NAME='inventory' then jsonb_build_object('revision',row_data->'revision','receipts',jsonb_array_length(row_data->'data'->'receipts'),'issues',jsonb_array_length(row_data->'data'->'issues'),'clients',jsonb_array_length(row_data->'data'->'clients'))
 else jsonb_build_object('enabled',row_data->'enabled','slug',row_data->'slug') end);
 return new;
end $$;
revoke all on function public.audit_inventory_change() from public,anon,authenticated;
drop trigger if exists inventory_audit_write on public.inventory;
create trigger inventory_audit_write after insert or update on public.inventory for each row execute function public.audit_inventory_change();
drop trigger if exists shares_audit_write on public.inventory_shares;
create trigger shares_audit_write after insert or update on public.inventory_shares for each row execute function public.audit_inventory_change();
-- Fixed event name, bounded metadata, one app-open entry per minute per account.
create or replace function public.record_inventory_access(device jsonb) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Sign in required' using errcode='42501'; end if;
 if jsonb_typeof(device) is distinct from 'object' or octet_length(device::text)>4096 then raise exception 'Invalid device metadata'; end if;
 if not exists(select 1 from public.inventory_audit where actor_id=auth.uid() and event='app.open' and occurred_at>now()-interval '1 minute') then
 insert into public.inventory_audit(actor_id,owner_id,event,details) values(auth.uid(),auth.uid(),'app.open',jsonb_build_object('device',device));
 end if;
end $$;
revoke all on function public.record_inventory_access(jsonb) from public,anon;
grant execute on function public.record_inventory_access(jsonb) to authenticated;
create index if not exists inventory_audit_recent on public.inventory_audit(occurred_at desc);
create index if not exists inventory_audit_actor on public.inventory_audit(actor_id,occurred_at desc);
create or replace function public.inventory_admin_dashboard(page_number integer default 0) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; page_offset integer;
begin
 if not public.is_inventory_admin() then raise exception 'Superadmin access required' using errcode='42501'; end if;
 page_offset:=greatest(0,least(coalesce(page_number,0),10000))*50;
 select jsonb_build_object(
 'totalUsers',(select count(*) from auth.users),
 'accounts',coalesce((select jsonb_agg(x) from (select u.id,u.email,u.created_at,u.last_sign_in_at,u.email_confirmed_at,i.updated_at,i.revision,
 jsonb_array_length(coalesce(i.data->'receipts','[]'::jsonb)) receipts,jsonb_array_length(coalesce(i.data->'issues','[]'::jsonb)) issues,
 coalesce(s.enabled,false) sharing_enabled
 from auth.users u left join public.inventory i on i.owner_id=u.id left join public.inventory_shares s on s.owner_id=u.id order by u.created_at desc,u.id limit 50 offset page_offset) x),'[]'::jsonb),
 'events',coalesce((select jsonb_agg(x) from (select a.id,a.occurred_at,a.actor_id,u.email,a.owner_id,a.event,a.details from public.inventory_audit a left join auth.users u on u.id=a.actor_id order by a.occurred_at desc,a.id desc limit 50 offset page_offset) x),'[]'::jsonb),
 'authEvents',coalesce((select jsonb_agg(x) from (select a.id,a.created_at,a.ip_address,a.payload->>'action' action,a.payload->>'actor_id' actor_id,a.payload->>'actor_username' email from auth.audit_log_entries a order by a.created_at desc,a.id desc limit 50 offset page_offset) x),'[]'::jsonb)
 ) into result;
 return result;
end $$;
revoke all on function public.inventory_admin_dashboard(integer) from public,anon;
grant execute on function public.inventory_admin_dashboard(integer) to authenticated;
commit;
