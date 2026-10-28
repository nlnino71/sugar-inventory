-- Run as project owner. Test changes, audit events and automatic backups roll back.
begin;
do $$
declare owner uuid; doc jsonb; trial jsonb; rev integer; restored integer; n bigint; audit_start bigint;
begin
 if has_function_privilege('anon','public.restore_inventory_json(integer,jsonb)','EXECUTE') then raise exception 'Anonymous restore allowed';end if;
 select owner_id,data,revision into owner,doc,rev from public.inventory where owner_id is not null limit 1;
 if owner is null then raise exception 'Requires one existing inventory';end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',owner,'role','authenticated')::text,true);
 select coalesce(max(id),0) into audit_start from public.inventory_audit;
 trial:=doc||jsonb_build_object('receipts',jsonb_build_array(jsonb_build_object('id','restore-test-a','sro','RESTORE-A','qty',12),jsonb_build_object('id','restore-test-b','sro','RESTORE-B','qty',20)),'issues',jsonb_build_array(jsonb_build_object('id','restore-test-i','sro','RESTORE-A','qty',2)),'clients',jsonb_build_array('Restore test client'),'unit','restore test unit');
 restored:=public.restore_inventory_json(rev,trial);
 if restored is distinct from rev+1 then raise exception 'Restore revision mismatch';end if;
 select count(*) into n from public.inventory_audit where id>audit_start and owner_id=owner;
 if n<>1 then raise exception 'Expected exactly one event, got %',n;end if;
 if not exists(select 1 from public.inventory_audit where id>audit_start and event='inventory.restored_json' and details->>'restored_sro_count'=jsonb_array_length(trial->'receipts')::text) then raise exception 'Missing restore summary';end if;
 if public.restore_inventory_json(rev,doc) is not null then raise exception 'Stale revision accepted';end if;
 if (select count(*) from public.inventory_audit where id>audit_start and owner_id=owner)<>1 then raise exception 'Conflict logged as success';end if;
 -- The operation flag is reset: ordinary saves still use ordinary audit behavior.
 perform public.save_inventory(restored,jsonb_set(trial,'{unit}',to_jsonb('another test unit'::text)));
 if not exists(select 1 from public.inventory_audit where id>audit_start and event='settings.change') then raise exception 'Normal edit audit missing';end if;
end $$;
rollback;
select 'JSON restore: one event, revision conflicts, and normal edit auditing passed' as result;
