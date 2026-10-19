-- Run as project owner after superadmin.sql. All changes roll back.
begin;
do $$ declare owner_id uuid; denied boolean:=false; result jsonb; begin
 select id into owner_id from auth.users where lower(email)='jcnino16@gmail.com' and email_confirmed_at is not null;
 if owner_id is null then raise exception 'Missing confirmed owner'; end if;
 perform set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000000',true);
 if public.is_inventory_admin() then raise exception 'Unexpected non-owner admin'; end if;
 begin perform public.inventory_admin_dashboard(0); exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'Unauthorized dashboard was permitted'; end if;
 perform set_config('request.jwt.claim.sub',owner_id::text,true);
 if not public.is_inventory_admin() then raise exception 'Owner not granted'; end if;
 result:=public.inventory_admin_dashboard(0);
 if jsonb_typeof(result->'accounts')<>'array' then raise exception 'Invalid dashboard response'; end if;
 if has_table_privilege('authenticated','public.inventory_audit','SELECT') or has_table_privilege('authenticated','public.inventory_audit','INSERT') then raise exception 'Audit table exposed'; end if;
 if has_table_privilege('authenticated','public.inventory_admins','INSERT') then raise exception 'Client can grant roles'; end if;
 raise notice 'Owner access, unauthorized denial and table grants verified';
end $$;
rollback;
