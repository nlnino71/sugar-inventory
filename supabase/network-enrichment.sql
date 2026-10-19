-- Apply after guest-tracking.sql. No provider credentials are stored in PostgreSQL.
begin;
create table if not exists public.inventory_ip_networks(
 ip text primary key check(length(ip)<=45),
 network jsonb not null check(jsonb_typeof(network)='object' and octet_length(network::text)<4096),
 looked_up_at timestamptz not null default now()
);
alter table public.inventory_ip_networks enable row level security;
revoke all on public.inventory_ip_networks from public,anon,authenticated;
grant select,insert,update on public.inventory_ip_networks to service_role;
-- Runs alphabetically after inventory_audit_session, so confirmed writes can use auth session IPs.
create or replace function public.audit_inventory_network_context() returns trigger language plpgsql security definer set search_path='' as $$
declare saved jsonb;
begin
 select network into saved from public.inventory_ip_networks where ip=coalesce(new.details->'request_network'->>'ip',new.details->'server_session'->>'ip');
 if saved is not null then new.details:=new.details||jsonb_build_object('network',saved);end if;
 return new;
end $$;
revoke all on function public.audit_inventory_network_context() from public,anon,authenticated;
drop trigger if exists inventory_audit_z_network on public.inventory_audit;
create trigger inventory_audit_z_network before insert on public.inventory_audit for each row execute function public.audit_inventory_network_context();
-- Only the server can supply actor identity, IP or network labels. It verifies the bearer token first.
create or replace function public.record_request_inventory_events(events jsonb,network jsonb,actor uuid default null,share_slug text default null,share_token uuid default null) returns void language plpgsql security definer set search_path='' as $$
declare item jsonb; owner uuid:=actor; shared boolean:=share_slug is not null or share_token is not null; ip_key text:=coalesce(network->>'ip','unknown');
begin
 if actor is null then perform public.record_guest_inventory_events(events,network,share_slug,share_token);return;end if;
 if not exists(select 1 from auth.users where id=actor) then raise exception 'Invalid actor' using errcode='42501';end if;
 if jsonb_typeof(events) is distinct from 'array' or jsonb_typeof(network) is distinct from 'object' then raise exception 'Invalid batch';end if;
 if jsonb_array_length(events)>50 or octet_length(events::text)>65536 or octet_length(network::text)>2048 then raise exception 'Batch too large';end if;
 if shared then
  select s.owner_id into owner from public.inventory_shares s where s.enabled and ((share_slug is not null and s.slug=share_slug) or (share_token is not null and s.token=share_token)) limit 1;
  if owner is null then raise exception 'Shared inventory unavailable' using errcode='42501';end if;
 end if;
 perform pg_advisory_xact_lock(hashtextextended('request-activity:'||actor::text,0));
 if (select count(*) from public.inventory_audit where actor_id=actor and browser_event_id is not null and occurred_at>now()-interval '1 minute')+jsonb_array_length(events)>6000 then raise exception 'Activity rate limit';end if;
 for item in select value from jsonb_array_elements(events) loop
  if item->>'event' is null or item->>'event' not in ('page.view','panel.view','panel.close','action.requested','form.submit','field.change','file.exported','save.failed','save.conflict','visibility.change','session.end','admin.view','auth.result','form.invalid') then raise exception 'Unsupported event';end if;
  if octet_length(item::text)>8192 or jsonb_typeof(item->'details') is distinct from 'object' or item->>'id' is null or item->>'session' is null then raise exception 'Invalid event';end if;
  insert into public.inventory_audit(actor_id,owner_id,event,details,browser_event_id) values(actor,owner,'browser.'||(item->>'event'),jsonb_build_object('source','browser-reported','shared_view',shared,'session',(item->>'session')::uuid,'client_at',left(item->>'at',64),'context',item->'details','request_network',jsonb_build_object('ip',network->>'ip','ip_source',left(network->>'ip_source',80),'user_agent',left(network->>'user_agent',512))),(item->>'id')::uuid)
  on conflict(browser_event_id) where browser_event_id is not null do nothing;
 end loop;
end $$;
revoke all on function public.record_request_inventory_events(jsonb,jsonb,uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.record_request_inventory_events(jsonb,jsonb,uuid,text,uuid) to service_role;
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
 'events',coalesce((select jsonb_agg(x) from (select a.id,a.occurred_at,a.actor_id,u.email,a.owner_id,a.event,a.details,n.network from public.inventory_audit a left join auth.users u on u.id=a.actor_id left join public.inventory_ip_networks n on n.ip=coalesce(a.details->'request_network'->>'ip',a.details->'server_session'->>'ip') order by a.occurred_at desc,a.id desc limit 50 offset page_offset) x),'[]'::jsonb),
 'authEvents',coalesce((select jsonb_agg(x) from (select a.id,a.created_at,a.ip_address,a.payload->>'action' action,a.payload->>'actor_id' actor_id,a.payload->>'actor_username' email,n.network from auth.audit_log_entries a left join public.inventory_ip_networks n on n.ip=a.ip_address::text order by a.created_at desc,a.id desc limit 50 offset page_offset) x),'[]'::jsonb)
 ) into result;
 return result;
end $$;
revoke all on function public.inventory_admin_dashboard(integer) from public,anon;
grant execute on function public.inventory_admin_dashboard(integer) to authenticated;
commit;
