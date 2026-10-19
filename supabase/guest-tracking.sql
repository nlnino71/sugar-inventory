-- Apply after activity-tracking.sql. Only the server collector may append site-wide guest events.
begin;
create index if not exists inventory_audit_guest_ip on public.inventory_audit((details->'request_network'->>'ip'),occurred_at desc) where event like 'guest.%';
create or replace function public.record_guest_inventory_events(events jsonb,network jsonb,share_slug text default null,share_token uuid default null) returns void language plpgsql security definer set search_path='' as $$
declare item jsonb; owner uuid; shared boolean:=share_slug is not null or share_token is not null; ip_key text:=coalesce(network->>'ip','unknown');
begin
 if jsonb_typeof(events) is distinct from 'array' or jsonb_typeof(network) is distinct from 'object' then raise exception 'Invalid guest batch';end if;
 if jsonb_array_length(events)>50 or octet_length(events::text)>65536 or octet_length(network::text)>2048 then raise exception 'Guest batch too large';end if;
 if shared then
  select s.owner_id into owner from public.inventory_shares s where s.enabled and ((share_slug is not null and s.slug=share_slug) or (share_token is not null and s.token=share_token)) limit 1;
  if owner is null then raise exception 'Shared inventory unavailable' using errcode='42501';end if;
 end if;
 -- Serialize the per-IP check to keep concurrent requests inside the shared database limit.
 perform pg_advisory_xact_lock(hashtextextended('guest-activity:'||ip_key,0));
 if (select count(*) from public.inventory_audit where event like 'guest.%' and coalesce(details->'request_network'->>'ip','unknown')=ip_key and occurred_at>now()-interval '1 minute')+jsonb_array_length(events)>600 then raise exception 'Guest activity rate limit';end if;
 for item in select value from jsonb_array_elements(events) loop
  if item->>'event' is null or item->>'event' not in ('page.view','panel.view','panel.close','action.requested','form.submit','field.change','file.exported','save.failed','save.conflict','visibility.change','session.end','admin.view','auth.result','form.invalid') then raise exception 'Unsupported guest event';end if;
  if octet_length(item::text)>8192 or jsonb_typeof(item->'details') is distinct from 'object' or item->>'id' is null or item->>'session' is null then raise exception 'Invalid guest event';end if;
  insert into public.inventory_audit(actor_id,owner_id,event,details,browser_event_id) values(null,owner,'guest.'||(item->>'event'),jsonb_build_object('source','browser-reported guest activity','visitor_kind','guest','shared_view',shared,'session',(item->>'session')::uuid,'client_at',left(item->>'at',64),'context',item->'details','request_network',jsonb_build_object('ip',network->>'ip','ip_source',left(network->>'ip_source',80),'user_agent',left(network->>'user_agent',512))),(item->>'id')::uuid)
  on conflict(browser_event_id) where browser_event_id is not null do nothing;
 end loop;
end $$;
revoke all on function public.record_guest_inventory_events(jsonb,jsonb,text,uuid) from public,anon,authenticated;
grant execute on function public.record_guest_inventory_events(jsonb,jsonb,text,uuid) to service_role;
commit;
