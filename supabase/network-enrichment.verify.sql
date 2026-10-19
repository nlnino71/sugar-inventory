-- Safe verification: all sample data rolls back.
begin;
do $$
declare actor uuid; logged jsonb; dashboard jsonb;
begin
 select user_id into actor from public.inventory_admins limit 1;
 insert into public.inventory_ip_networks(ip,network) values('192.0.2.123','{"isp":"Verification network","asn":"AS64500","source":"Test"}') on conflict(ip) do update set network=excluded.network;
 perform public.record_request_inventory_events(jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'session',gen_random_uuid(),'event','page.view','details','{"page":"stock"}'::jsonb)), '{"ip":"192.0.2.123","ip_source":"Verification"}',actor);
 select details into logged from public.inventory_audit where actor_id=actor and details->'request_network'->>'ip'='192.0.2.123' order by id desc limit 1;
 if logged->'network'->>'isp' is distinct from 'Verification network' then raise exception 'Signed-in ISP not saved';end if;
 perform public.record_request_inventory_events(jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'session',gen_random_uuid(),'event','page.view','details','{"page":"signin"}'::jsonb)), '{"ip":"192.0.2.123","ip_source":"Verification"}');
 if not exists(select 1 from public.inventory_audit where actor_id is null and details->'network'->>'isp'='Verification network') then raise exception 'Guest ISP not saved';end if;
 perform set_config('request.jwt.claim.sub',actor::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',actor)::text,true);
 dashboard:=public.inventory_admin_dashboard(0);
 if not exists(select 1 from jsonb_array_elements(dashboard->'events') x where x->'network'->>'isp'='Verification network') then raise exception 'Admin network missing';end if;
 if has_table_privilege('anon','public.inventory_ip_networks','select') or has_table_privilege('authenticated','public.inventory_ip_networks','select') then raise exception 'Network table exposed';end if;
 if has_function_privilege('anon','public.record_request_inventory_events(jsonb,jsonb,uuid,text,uuid)','execute') or has_function_privilege('authenticated','public.record_request_inventory_events(jsonb,jsonb,uuid,text,uuid)','execute') then raise exception 'Server collector exposed';end if;
end $$;
select 'Guest and signed-in ISP persistence, admin display and privileges passed' as result;
rollback;
