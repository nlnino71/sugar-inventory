-- Private visitor analytics. Apply after network-enrichment.sql.
begin;
create or replace function public.inventory_admin_traffic(range_key text default '7d',page_filter text default '',search_text text default '',page_number integer default 0) returns jsonb language plpgsql security definer set search_path='' as $$
declare since timestamptz; page_offset integer; result jsonb; until_time timestamptz:=now();
begin
 if not public.is_inventory_admin() then raise exception 'Superadmin access required' using errcode='42501';end if;
 if range_key is null or range_key not in ('today','24h','7d','30d','all') then raise exception 'Invalid traffic range';end if;
 if length(coalesce(page_filter,''))>512 or length(coalesce(search_text,''))>200 then raise exception 'Filter too long';end if;
 since:=case range_key when 'today' then date_trunc('day',now() at time zone 'Asia/Manila') at time zone 'Asia/Manila' when '24h' then now()-interval '24 hours' when '7d' then ((now() at time zone 'Asia/Manila')::date-6)::timestamp at time zone 'Asia/Manila' when '30d' then ((now() at time zone 'Asia/Manila')::date-29)::timestamp at time zone 'Asia/Manila' else '-infinity'::timestamptz end;
 page_offset:=greatest(0,least(coalesce(page_number,0),10000))*50;
 with base as materialized(
  select a.id,a.occurred_at,a.actor_id,u.email,a.details->>'session' session_id,a.details->'context' context,
   coalesce(nullif(a.details->'request_network'->>'ip',''),nullif(a.details->'server_session'->>'ip','')) ip,
   coalesce(n.network,a.details->'network','{}'::jsonb) network,
   coalesce(nullif(a.details->'context'->'device'->>'userAgent',''),nullif(a.details->'request_network'->>'user_agent',''),'Unknown') ua,
   left(coalesce(nullif(a.details->'context'->>'page',''),'Unknown'),128) page_id,
   left(coalesce(a.details->'context'->>'path',''),256) path
  from public.inventory_audit a left join auth.users u on u.id=a.actor_id
  left join public.inventory_ip_networks n on n.ip=coalesce(a.details->'request_network'->>'ip',a.details->'server_session'->>'ip')
  where a.event in ('guest.page.view','browser.page.view') and a.occurred_at>=since and a.occurred_at<=until_time
 ),classified as materialized(
  select *,case when path like '/view/%' then path||' · '||page_id else page_id end page,
   coalesce(nullif(network->>'country',''),nullif(network->>'country_code',''),'Unknown') country,
   case when ua='Unknown' then 'Unknown' when ua~*'(ipad|tablet)' or (ua~*'android' and ua!~*'mobile') then 'Tablet' when ua~*'(mobile|iphone|ipod)' then 'Phone' else 'Desktop / other' end device,
   case when ua='Unknown' then 'Unknown' when ua~*'(edg/|edga/|edgios/)' then 'Edge' when ua~*'(opr/|opera)' then 'Opera' when ua~*'(firefox|fxios)' then 'Firefox' when ua~*'(chrome|crios|chromium)' then 'Chrome' when ua~*'safari' then 'Safari' else 'Other' end browser,
   case when ua='Unknown' then 'Unknown' when ua~*'android' then 'Android' when ua~*'(iphone|ipad|ipod)' or (ua~*'macintosh' and ua~*'mobile') then 'iOS / iPadOS' when ua~*'windows' then 'Windows' when ua~*'(macintosh|mac os x)' then 'macOS' when ua~*'linux' then 'Linux' else 'Other' end os,
   case when actor_id is not null then 'account:'||actor_id::text when nullif(session_id,'') is not null then 'session:'||session_id else 'event:'||id::text end visitor
  from base
 ),filtered as materialized(
  select * from classified where (coalesce(page_filter,'')='' or page=page_filter) and (coalesce(trim(search_text),'')='' or strpos(lower(concat_ws(' ',ip,email,page,country,network->>'isp',network->>'asn',os,browser,device,ua)),lower(trim(search_text)))>0)
 ),pages as(select page,count(*) views,count(distinct visitor) visitors,max(occurred_at) last_view from filtered group by page),
 locations as(select country label,count(*) value from filtered group by country),
 systems as(select os label,count(*) value from filtered group by os),
 browsers as(select browser label,count(*) value from filtered group by browser)
 select jsonb_build_object('range',range_key,'from',case when range_key='all' then null else since end,'to',until_time,'timezone','Asia/Manila',
 'summary',jsonb_build_object('pageViews',(select count(*) from filtered),'visitors',(select count(distinct visitor) from filtered),'mobilePct',coalesce((select round(100.0*count(*) filter(where device='Phone')/nullif(count(*),0),1) from filtered),0),'topCountry',(select label from locations where label<>'Unknown' order by value desc,label limit 1)),
 'pageOptions',coalesce((select jsonb_agg(x order by x.page) from (select distinct page from classified order by page limit 1000) x),'[]'::jsonb),
 'pages',coalesce((select jsonb_agg(x order by x.views desc,x.page) from (select * from pages order by views desc,page limit 100) x),'[]'::jsonb),
 'locations',coalesce((select jsonb_agg(x order by x.value desc,x.label) from locations x),'[]'::jsonb),
 'systems',coalesce((select jsonb_agg(x order by x.value desc,x.label) from systems x),'[]'::jsonb),
 'browsers',coalesce((select jsonb_agg(x order by x.value desc,x.label) from browsers x),'[]'::jsonb),
 'logs',coalesce((select jsonb_agg(x order by x.occurred_at desc,x.id desc) from (select id,occurred_at,email,case when actor_id is null then 'Guest session' else 'Signed-in account' end visitor_kind,page,ip,country,network->>'isp' isp,network->>'asn' asn,device,browser,os,context->'device'->>'screen' screen,context->'device'->>'viewport' viewport from filtered order by occurred_at desc,id desc limit 50 offset page_offset) x),'[]'::jsonb),
 'totalLogs',(select count(*) from filtered),'pageNumber',greatest(0,least(coalesce(page_number,0),10000))) into result;
 return result;
end $$;
revoke all on function public.inventory_admin_traffic(text,text,text,integer) from public,anon;
grant execute on function public.inventory_admin_traffic(text,text,text,integer) to authenticated;
commit;
