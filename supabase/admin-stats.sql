-- Apply after superadmin.sql and the activity/guest tracking migrations.
begin;
create or replace function public.inventory_admin_stats(days integer default 30) returns jsonb language plpgsql security definer set search_path='' as $$
declare start_date date; end_date date:=(now() at time zone 'Asia/Manila')::date; since timestamptz; result jsonb;
begin
 if not public.is_inventory_admin() then raise exception 'Superadmin access required' using errcode='42501';end if;
 if days is null or days not in (7,30,90) then raise exception 'Choose 7, 30 or 90 days';end if;
 start_date:=end_date-(days-1);since:=start_date::timestamp at time zone 'Asia/Manila';
 with events as materialized(select occurred_at,actor_id,event,details->>'session' browser_session,details->'context' browser_context from public.inventory_audit where occurred_at>=since and occurred_at<=now()),
 views as materialized(select *,coalesce(nullif(browser_context->'device'->>'userAgent',''),'Unknown') ua from events where event in ('browser.page.view','guest.page.view')),
 daily_events as(select (occurred_at at time zone 'Asia/Manila')::date as day,count(*) total,count(*) filter(where event in ('browser.page.view','guest.page.view')) page_views,count(*) filter(where event='guest.auth.result' and browser_context->>'outcome'='failed') reported_failures from events group by 1),
 daily_auth as(select (created_at at time zone 'Asia/Manila')::date as day,count(*) filter(where payload->>'action'='login') sign_ins from auth.audit_log_entries where created_at>=since and created_at<=now() group by 1),
 registrations as(select (created_at at time zone 'Asia/Manila')::date as day,count(*) registrations from auth.users where created_at>=since and created_at<=now() group by 1),
 calendar as(select generate_series(start_date::timestamp,end_date::timestamp,interval '1 day')::date as day),
 daily as(select c.day,coalesce(e.total,0) events,coalesce(e.page_views,0) page_views,coalesce(e.reported_failures,0) reported_failures,coalesce(a.sign_ins,0) sign_ins,coalesce(r.registrations,0) registrations from calendar c left join daily_events e using(day) left join daily_auth a using(day) left join registrations r using(day)),
 pages as(select left(coalesce(nullif(browser_context->>'page',''),'Unknown'),128) label,count(*) value from views group by 1 order by value desc,label limit 10),
 devices as(select case when ua='Unknown' then 'Unknown' when ua~*'(ipad|tablet)' or (ua~*'android' and ua!~*'mobile') then 'Tablet' when ua~*'(mobile|iphone|ipod)' then 'Phone' else 'Desktop / other' end label,count(*) value from views group by 1 order by value desc,label),
 browsers as(select case when ua='Unknown' then 'Unknown' when ua~*'(edg/|edga/|edgios/)' then 'Edge' when ua~*'(opr/|opera)' then 'Opera' when ua~*'(firefox|fxios)' then 'Firefox' when ua~*'(chrome|crios|chromium)' then 'Chrome' when ua~*'safari' then 'Safari' else 'Other' end label,count(*) value from views group by 1 order by value desc,label),
 sessions as(select case when event='guest.page.view' then 'Guest sessions' else 'Signed-in sessions' end label,count(distinct nullif(browser_session,'')) value from views group by 1),
 changes as(select split_part(event,'.',1) entity,split_part(event,'.',2) action,count(*) value from events where event in ('receipts.add','receipts.edit','receipts.delete','issues.add','issues.edit','issues.delete','clients.add','clients.edit','clients.delete') group by 1,2),
 hours as(select extract(hour from occurred_at at time zone 'Asia/Manila')::integer as hour,count(*) value from events group by 1)
 select jsonb_build_object('days',days,'timezone','Asia/Manila','from',start_date,'to',end_date,'generatedAt',now(),
 'summary',jsonb_build_object('events',(select count(*) from events),'pageViews',(select count(*) from views),'activeAccounts',(select count(distinct actor_id) from events where actor_id is not null),'guestSessions',(select coalesce(sum(value),0) from sessions where label='Guest sessions')),
 'daily',coalesce((select jsonb_agg(d order by day) from daily d),'[]'::jsonb),
 'pages',coalesce((select jsonb_agg(p order by value desc,label) from pages p),'[]'::jsonb),
 'devices',coalesce((select jsonb_agg(d order by value desc,label) from devices d),'[]'::jsonb),
 'browsers',coalesce((select jsonb_agg(b order by value desc,label) from browsers b),'[]'::jsonb),
 'sessions',coalesce((select jsonb_agg(s order by label) from sessions s),'[]'::jsonb),
 'changes',coalesce((select jsonb_agg(c order by entity,action) from changes c),'[]'::jsonb),
 'hours',(select jsonb_agg(jsonb_build_object('hour',h,'value',coalesce(t.value,0)) order by h) from generate_series(0,23) h left join hours t on t.hour=h)) into result;
 return result;
end $$;
revoke all on function public.inventory_admin_stats(integer) from public,anon;
grant execute on function public.inventory_admin_stats(integer) to authenticated;
commit;
