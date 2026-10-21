-- Synthetic test events roll back; existing traffic remains untouched.
begin;
do $$declare owner uuid; result jsonb; source_id uuid:=gen_random_uuid();begin
 select user_id into owner from public.inventory_admins limit 1;
 insert into public.inventory_ip_networks(ip,network) values('192.0.2.55','{"country":"Verification country","isp":"Verification ISP","asn":"AS64500"}') on conflict(ip) do update set network=excluded.network;
 insert into public.inventory_audit(event,details) select 'guest.page.view',jsonb_build_object('session',source_id,'context',jsonb_build_object('page','stock','path','/view/verify-traffic','device',jsonb_build_object('userAgent','Mozilla Android Mobile Chrome/100','screen','390 × 844')),'request_network',jsonb_build_object('ip','192.0.2.55')) from generate_series(1,2);
 insert into public.inventory_audit(occurred_at,event,details) values(now()-interval '40 days','guest.page.view',jsonb_build_object('session',gen_random_uuid(),'context',jsonb_build_object('page','stock','path','/view/verify-old','device',jsonb_build_object('userAgent','Verification browser'))));
 perform set_config('request.jwt.claim.sub',owner::text,true);perform set_config('request.jwt.claims',jsonb_build_object('sub',owner)::text,true);
 result:=public.inventory_admin_traffic('today','/view/verify-traffic · stock','Verification ISP',0);
 if result->'summary'->>'pageViews' is distinct from '2' or result->'summary'->>'visitors' is distinct from '1' or (result->'summary'->>'mobilePct')::numeric<>100 then raise exception 'Incorrect traffic aggregation';end if;
 if result->'summary'->>'topCountry' is distinct from 'Verification country' then raise exception 'Country missing';end if;
 if jsonb_array_length(result->'logs')<>2 or jsonb_array_length(result->'pageOptions')<1 then raise exception 'Rows missing';end if;
 result:=public.inventory_admin_traffic('7d','/view/verify-old · stock','',0);if (result->>'totalLogs')::int<>0 then raise exception 'Range leaked old event';end if;
 result:=public.inventory_admin_traffic('all','/view/verify-old · stock','',0);if (result->>'totalLogs')::int<>1 then raise exception 'All-time omitted old event';end if;
 result:=public.inventory_admin_traffic('24h','/view/verify-traffic · stock','no match',0);if (result->>'totalLogs')::int<>0 then raise exception 'Search not applied';end if;
 perform set_config('request.jwt.claim.sub','',true);perform set_config('request.jwt.claims','{}',true);
 begin perform public.inventory_admin_traffic();raise exception 'Anonymous access';exception when insufficient_privilege then null;end;
 if has_function_privilege('anon','public.inventory_admin_traffic(text,text,text,integer)','execute') then raise exception 'Guest can read traffic';end if;
end $$;
select 'Visitor filters, counts, dates, saved network and private access passed' as result;
rollback;
