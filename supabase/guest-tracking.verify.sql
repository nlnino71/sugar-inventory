-- Run as project owner after guest-tracking.sql. Rolls back all fixture changes.
begin;
do $$declare test_id uuid:='e0000000-0000-4000-8000-000000000001'; n integer; blocked boolean:=false;begin
 if has_function_privilege('anon','public.record_guest_inventory_events(jsonb,jsonb,text,uuid)','EXECUTE') or has_function_privilege('authenticated','public.record_guest_inventory_events(jsonb,jsonb,text,uuid)','EXECUTE') then raise exception 'Client may forge server network metadata';end if;
 if not has_function_privilege('service_role','public.record_guest_inventory_events(jsonb,jsonb,text,uuid)','EXECUTE') then raise exception 'Collector denied';end if;
 perform set_config('request.jwt.claim.sub','',true);perform set_config('request.jwt.claims','{}',true);
 perform public.record_guest_inventory_events(jsonb_build_array(jsonb_build_object('id',test_id,'session','e0000000-0000-4000-8000-000000000002','event','page.view','details',jsonb_build_object('page','signin'))),'{"ip":"203.0.113.7","ip_source":"verification"}');
 perform public.record_guest_inventory_events(jsonb_build_array(jsonb_build_object('id',test_id,'session','e0000000-0000-4000-8000-000000000002','event','page.view','details',jsonb_build_object('page','signin'))),'{"ip":"203.0.113.7","ip_source":"verification"}');
 select count(*) into n from public.inventory_audit where browser_event_id=test_id and actor_id is null and owner_id is null and event='guest.page.view' and details->'request_network'->>'ip'='203.0.113.7';
 if n<>1 then raise exception 'Guest identity/scoping/deduplication failed';end if;
 begin perform public.record_guest_inventory_events('[{"id":"e0000000-0000-4000-8000-000000000003","session":"e0000000-0000-4000-8000-000000000002","event":"receipts.edit","details":{}}]','{}');exception when raise_exception then blocked:=true;end;
 if not blocked then raise exception 'Guest forged a confirmed write';end if;
 if has_table_privilege('anon','public.inventory_audit','SELECT') then raise exception 'Guest can read logs';end if;
 raise notice 'Guest append restrictions, identity, network metadata, deduplication and audit read denial passed';
end $$;
rollback;
