-- Apply after superadmin.sql. Successful changes are audited server-side.
begin;
alter table public.inventory_audit add column if not exists browser_event_id uuid;
create unique index if not exists inventory_audit_browser_event on public.inventory_audit(browser_event_id) where browser_event_id is not null;
-- Attach only the authenticated session's safe metadata; never copy JWTs or tokens.
create or replace function public.audit_inventory_session_context() returns trigger language plpgsql security definer set search_path='' as $$
declare claims jsonb:=coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb; session_row jsonb;
begin
 if claims->>'session_id' is not null and auth.uid() is not null then
  select to_jsonb(s) into session_row from auth.sessions s where s.id=(claims->>'session_id')::uuid and s.user_id=auth.uid();
  new.details:=new.details||jsonb_build_object('server_session',jsonb_build_object('id',claims->>'session_id','ip',session_row->>'ip','user_agent',session_row->>'user_agent','ip_source','Supabase auth session; may differ from current request'));
 end if;
 return new;
end $$;
revoke all on function public.audit_inventory_session_context() from public,anon,authenticated;
drop trigger if exists inventory_audit_session on public.inventory_audit;
create trigger inventory_audit_session before insert on public.inventory_audit for each row execute function public.audit_inventory_session_context();
create or replace function public.audit_inventory_change() returns trigger language plpgsql security definer set search_path='' as $$
declare previous jsonb; current_row jsonb:=coalesce(to_jsonb(new),'{}'::jsonb); owner uuid; collection text; change record; setting text;
begin
 previous:=case when TG_OP='INSERT' then '{}'::jsonb else to_jsonb(old) end;
 owner:=coalesce(current_row->>'owner_id',previous->>'owner_id')::uuid;
 if TG_TABLE_NAME='inventory_shares' then
  -- Sharing tokens are secrets and must never be copied into the audit log.
  foreach setting in array array['enabled','slug'] loop
   if previous->setting is distinct from current_row->setting then
    insert into public.inventory_audit(actor_id,owner_id,event,details) values(auth.uid(),owner,'sharing.change',jsonb_build_object('field',setting,'before',previous->setting,'after',current_row->setting));
   end if;
  end loop;
  if TG_OP='UPDATE' and previous->'token' is distinct from current_row->'token' then
   insert into public.inventory_audit(actor_id,owner_id,event,details) values(auth.uid(),owner,'sharing.link_replaced','{}');
  end if;
  return new;
 end if;
 foreach collection in array array['receipts','issues'] loop
  for change in
   with before_rows as(select coalesce(value->>'id',ordinality::text) key,value from jsonb_array_elements(coalesce(previous->'data'->collection,'[]'::jsonb)) with ordinality),
   after_rows as(select coalesce(value->>'id',ordinality::text) key,value from jsonb_array_elements(coalesce(current_row->'data'->collection,'[]'::jsonb)) with ordinality)
   select coalesce(a.key,b.key) key,b.value before_value,a.value after_value from before_rows b full join after_rows a on a.key=b.key where a.value is distinct from b.value
  loop
   insert into public.inventory_audit(actor_id,owner_id,event,details) values(auth.uid(),owner,collection||'.'||case when change.before_value is null then 'add' when change.after_value is null then 'delete' else 'edit' end,
    jsonb_build_object('record_id',change.key,'revision',current_row->'revision','before',change.before_value,'after',change.after_value));
  end loop;
 end loop;
 -- Audit every client membership and contact/profile change, including renames.
 for change in
  with names as(select jsonb_array_elements_text(coalesce(previous->'data'->'clients','[]'::jsonb)) name union select jsonb_array_elements_text(coalesce(current_row->'data'->'clients','[]'::jsonb)) union select jsonb_object_keys(coalesce(previous->'data'->'clientProfiles','{}'::jsonb)) union select jsonb_object_keys(coalesce(current_row->'data'->'clientProfiles','{}'::jsonb))),
  versions as(select name,
   case when coalesce(previous->'data'->'clients','[]'::jsonb) ? name or coalesce(previous->'data'->'clientProfiles','{}'::jsonb) ? name then jsonb_build_object('listed',coalesce(previous->'data'->'clients','[]'::jsonb) ? name,'profile',previous->'data'->'clientProfiles'->name) end before_value,
   case when coalesce(current_row->'data'->'clients','[]'::jsonb) ? name or coalesce(current_row->'data'->'clientProfiles','{}'::jsonb) ? name then jsonb_build_object('listed',coalesce(current_row->'data'->'clients','[]'::jsonb) ? name,'profile',current_row->'data'->'clientProfiles'->name) end after_value from names)
  select * from versions where before_value is distinct from after_value
 loop
  insert into public.inventory_audit(actor_id,owner_id,event,details) values(auth.uid(),owner,'clients.'||case when change.before_value is null then 'add' when change.after_value is null then 'delete' else 'edit' end,jsonb_build_object('client',change.name,'before',change.before_value,'after',change.after_value,'revision',current_row->'revision'));
 end loop;
 -- Any top-level inventory setting, including future fields, except operational history.
 for setting in select jsonb_object_keys(coalesce(previous->'data','{}'::jsonb)) union select jsonb_object_keys(current_row->'data') loop
  if setting not in ('receipts','issues','clients','clientProfiles','activity') and previous->'data'->setting is distinct from current_row->'data'->setting then
   insert into public.inventory_audit(actor_id,owner_id,event,details) values(auth.uid(),owner,'settings.change',jsonb_build_object('field',setting,'before',previous->'data'->setting,'after',current_row->'data'->setting,'revision',current_row->'revision'));
  end if;
 end loop;
 insert into public.inventory_audit(actor_id,owner_id,event,details) values(auth.uid(),owner,case when TG_OP='DELETE' then 'inventory.deleted' else 'inventory.saved' end,jsonb_build_object('revision',current_row->'revision'));
 return new;
end $$;
drop trigger if exists inventory_audit_write on public.inventory;
create trigger inventory_audit_write after insert or update or delete on public.inventory for each row execute function public.audit_inventory_change();
drop trigger if exists shares_audit_write on public.inventory_shares;
create trigger shares_audit_write after insert or update or delete on public.inventory_shares for each row execute function public.audit_inventory_change();
create or replace function public.record_inventory_events(events jsonb,share_slug text default null,share_token uuid default null) returns void language plpgsql security definer set search_path='' as $$
declare owner uuid; item jsonb; kind text; shared boolean:=share_slug is not null or share_token is not null;
begin
 if shared then
  select s.owner_id into owner from public.inventory_shares s where s.enabled and ((share_slug is not null and s.slug=share_slug) or (share_token is not null and s.token=share_token)) limit 1;
  if owner is null then raise exception 'Shared inventory unavailable' using errcode='42501';end if;
 else owner:=auth.uid(); if owner is null then raise exception 'Sign in required' using errcode='42501';end if;
 end if;
 if jsonb_typeof(events) is distinct from 'array' then raise exception 'Invalid event batch';end if;
 if jsonb_array_length(events)>50 or octet_length(events::text)>65536 then raise exception 'Event batch too large';end if;
 -- Bound untrusted traffic independently of the confirmed-write trigger.
 if (select count(*) from public.inventory_audit where owner_id=owner and browser_event_id is not null and occurred_at>now()-interval '1 minute')>6000 then raise exception 'Activity rate limit exceeded';end if;
 for item in select value from jsonb_array_elements(events) loop
  kind:=item->>'event';
  if kind is null or kind not in ('page.view','panel.view','panel.close','action.requested','form.submit','field.change','file.exported','save.failed','save.conflict','visibility.change','session.end','admin.view') then raise exception 'Unsupported event';end if;
  if octet_length(item::text)>8192 or jsonb_typeof(item->'details') is distinct from 'object' then raise exception 'Invalid event';end if;
  insert into public.inventory_audit(actor_id,owner_id,event,details,browser_event_id) values(auth.uid(),owner,'browser.'||kind,jsonb_build_object('source','browser-reported','shared_view',shared,'session',left(item->>'session',64),'client_at',left(item->>'at',64),'context',item->'details'),(item->>'id')::uuid)
  on conflict(browser_event_id) where browser_event_id is not null do nothing;
 end loop;
end $$;
revoke all on function public.record_inventory_events(jsonb,text,uuid) from public;
grant execute on function public.record_inventory_events(jsonb,text,uuid) to anon,authenticated;
commit;
