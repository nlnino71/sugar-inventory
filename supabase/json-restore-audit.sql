-- Apply after activity-tracking.sql and account-inventories.sql.
-- JSON file restores produce one database-confirmed event, preserving RLS and revision checks.
begin;
create or replace function public.restore_inventory_json(expected_revision integer,new_data jsonb)
returns integer language plpgsql security invoker set search_path='' as $$
declare saved_revision integer; previous_operation text:=current_setting('inventory.audit_operation',true);
begin
 if auth.uid() is null then raise exception 'Sign in required' using errcode='42501';end if;
 if jsonb_typeof(new_data->'receipts') is distinct from 'array' or jsonb_typeof(new_data->'issues') is distinct from 'array' then
  raise exception 'Backup requires receipts and issues arrays' using errcode='22023';
 end if;
 perform set_config('inventory.audit_operation','json_restore',true);
 saved_revision:=public.save_inventory(expected_revision,new_data);
 perform set_config('inventory.audit_operation',coalesce(previous_operation,''),true);
 return saved_revision;
end $$;
revoke all on function public.restore_inventory_json(integer,jsonb) from public,anon;
grant execute on function public.restore_inventory_json(integer,jsonb) to authenticated;
do $migration$
declare definition text:=pg_get_functiondef('public.audit_inventory_change()'::regprocedure);
 anchor text:=' foreach collection in array array[''receipts'',''issues''] loop';
 addition text:=$patch$
 -- A whole JSON restore is one action, not hundreds of manual record edits.
 if TG_TABLE_NAME='inventory' and TG_OP='UPDATE' and current_setting('inventory.audit_operation',true)='json_restore' then
  insert into public.inventory_audit(actor_id,owner_id,event,details)
  values(auth.uid(),owner,'inventory.restored_json',jsonb_build_object(
   'revision',current_row->'revision','source','JSON backup file',
   'previous_sro_count',jsonb_array_length(coalesce(previous->'data'->'receipts','[]'::jsonb)),
   'restored_sro_count',jsonb_array_length(current_row->'data'->'receipts'),
   'previous_issuance_count',jsonb_array_length(coalesce(previous->'data'->'issues','[]'::jsonb)),
   'restored_issuance_count',jsonb_array_length(current_row->'data'->'issues')));
  return new;
 end if;
$patch$;
begin
 if position('inventory.restored_json' in definition)=0 then
  if position(anchor in definition)=0 then raise exception 'Audit function differs; review before applying';end if;
  execute replace(definition,anchor,addition||anchor);
 end if;
end $migration$;
commit;
