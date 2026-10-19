-- Append before COMMIT in account-inventories.sql for a rollback-only rehearsal.
-- This creates a temporary test account inside the transaction; nothing is retained.
insert into auth.users(id,email) values('ffffffff-ffff-4fff-8fff-fffffffffff1','inventory-isolation-test@example.invalid');
set local role authenticated;
select set_config('request.jwt.claim.sub','ffffffff-ffff-4fff-8fff-fffffffffff1',true);
do $$
declare own_id text; own_data jsonb; r integer; affected integer;
begin
 if (select count(*) from public.inventory)<>1 then raise exception 'RLS leaked inventory rows';end if;
 select id,data into own_id,own_data from public.inventory;
 if jsonb_array_length(own_data->'receipts')<>0 or jsonb_array_length(own_data->'issues')<>0 then raise exception 'New account inherited records';end if;
 if (select count(*) from public.inventory_shares)<>1 or (select enabled from public.inventory_shares) then raise exception 'Sharing must start private';end if;
 update public.inventory set data=data where id='main';get diagnostics affected=row_count;
 if affected<>0 then raise exception 'Cross-account update allowed';end if;
 update public.inventory_shares set enabled=true where id='main';get diagnostics affected=row_count;
 if affected<>0 then raise exception 'Cross-account sharing allowed';end if;
 r:=public.save_inventory(0,own_data||'{"unit":"test bags"}'::jsonb);
 if r<>1 or (select data->>'unit' from public.inventory)<>'test bags' then raise exception 'Own save failed';end if;
 if public.save_inventory(0,own_data) is not null then raise exception 'Stale revision overwrote records';end if;
 if has_function_privilege('authenticated','public.provision_account_inventory(uuid)','EXECUTE') then raise exception 'Caller can provision another account';end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select owner_id::text from public.inventory where id='main'),true);
set local role authenticated;
do $$ begin
 if (select count(*) from public.inventory)<>1 or (select id from public.inventory)<>'main' then raise exception 'Owner lost original inventory';end if;
 if (select jsonb_array_length(data->'receipts') from public.inventory)<>8 or (select jsonb_array_length(data->'issues') from public.inventory)<>24 then raise exception 'Original records changed';end if;
 if (select slug from public.inventory_shares)<>'public' then raise exception 'Original public link changed';end if;
end $$;
reset role;
set local role anon;
do $$ declare shared jsonb;begin
 if has_table_privilege('anon','public.inventory','SELECT') or has_table_privilege('anon','public.inventory_shares','SELECT') then raise exception 'Anonymous table access allowed';end if;
 shared:=public.get_public_inventory_by_slug('public');
 if shared is null or jsonb_array_length(shared->'receipts')<>8 then raise exception 'Original public view unavailable';end if;
 if shared->'clientProfiles'<>'{}'::jsonb or shared->'activity'<>'[]'::jsonb then raise exception 'Public private fields exposed';end if;
 if public.get_public_inventory_by_slug('inventory-ffffffff-ffff-4fff-8fff-fffffffffff1') is not null then raise exception 'Private account publicly exposed';end if;
end $$;
reset role;
select 'PASS: ownership, isolation, private defaults, save conflicts, original records and public link' as verification;
rollback;
