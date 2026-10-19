-- Run as project owner after both admin migrations. Verification rolls back.
begin;
do $$
declare account uuid; inventory_id text; event_id uuid:='f0000000-0000-4000-8000-000000000001'; n integer; denied boolean:=false; sample jsonb;
begin
 select id into account from auth.users where lower(email)='jcnino16@gmail.com';
 select id into inventory_id from public.inventory where owner_id=account;
 if inventory_id is null then raise exception 'Owner inventory required';end if;
 perform set_config('request.jwt.claim.sub',account::text,true);
 sample:='{"id":"audit-verification-record","sro":"AUDIT-VERIFY","qty":10}'::jsonb;
 update public.inventory set data=jsonb_set(data,'{receipts}',coalesce(data->'receipts','[]'::jsonb)||jsonb_build_array(sample)),revision=revision+1 where id=inventory_id;
 if not exists(select 1 from public.inventory_audit where owner_id=account and event='receipts.add' and details->>'record_id'='audit-verification-record' and details->'after'->>'qty'='10') then raise exception 'Missing add';end if;
 update public.inventory set data=jsonb_set(data,'{receipts}',(select jsonb_agg(case when r->>'id'='audit-verification-record' then jsonb_set(r,'{qty}','20') else r end) from jsonb_array_elements(data->'receipts') r)),revision=revision+1 where id=inventory_id;
 if not exists(select 1 from public.inventory_audit where owner_id=account and event='receipts.edit' and details->>'record_id'='audit-verification-record' and details->'before'->>'qty'='10' and details->'after'->>'qty'='20') then raise exception 'Missing before/after edit';end if;
 update public.inventory set data=jsonb_set(data,'{receipts}',coalesce((select jsonb_agg(r) from jsonb_array_elements(data->'receipts') r where r->>'id' is distinct from 'audit-verification-record'),'[]')),revision=revision+1 where id=inventory_id;
 if not exists(select 1 from public.inventory_audit where owner_id=account and event='receipts.delete' and details->>'record_id'='audit-verification-record') then raise exception 'Missing delete';end if;
 update public.inventory set data=jsonb_set(data,'{clientProfiles}',coalesce(data->'clientProfiles','{}')||'{"audit-verification-client":{"contact":"Before"}}'::jsonb),revision=revision+1 where id=inventory_id;
 update public.inventory set data=jsonb_set(data,'{clientProfiles,audit-verification-client,contact}','"After"'),revision=revision+1 where id=inventory_id;
 if not exists(select 1 from public.inventory_audit where owner_id=account and event='clients.edit' and details->>'client'='audit-verification-client' and details->'before'->'profile'->>'contact'='Before' and details->'after'->'profile'->>'contact'='After') then raise exception 'Missing client edit';end if;
 perform public.record_inventory_events(jsonb_build_array(jsonb_build_object('id',event_id,'event','page.view','details',jsonb_build_object('page','stock'))));
 perform public.record_inventory_events(jsonb_build_array(jsonb_build_object('id',event_id,'event','page.view','details',jsonb_build_object('page','stock'))));
 select count(*) into n from public.inventory_audit where browser_event_id=event_id;
 if n<>1 then raise exception 'Retries are not idempotent';end if;
 begin perform public.record_inventory_events('[{"id":"f0000000-0000-4000-8000-000000000002","event":"receipts.edit","details":{}}]');exception when raise_exception then denied:=true;end;
 if not denied then raise exception 'Browser forged confirmed event';end if;
 perform set_config('request.jwt.claim.sub','',true);denied:=false;
 begin perform public.record_inventory_events('[]');exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Unauthenticated unscoped event allowed';end if;
 denied:=false;
 begin perform public.record_inventory_events('[]','invalid-verification-link');exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Invalid shared link allowed';end if;
 raise notice 'Audit add/edit/delete, client changes, retry deduplication, event trust and anonymous denial passed';
end $$;
rollback;
