-- Rollback-only checks: roles and inventory records are not modified.
begin;
do $$
declare owner uuid; payload jsonb; source jsonb; denied boolean:=false;
begin
 select u.id into owner from auth.users u join public.inventory_admins a on a.user_id=u.id where lower(u.email)='jcnino16@gmail.com' and u.email_confirmed_at is not null;
 if owner is null then raise exception 'Confirmed Superadmin owner missing'; end if;
 if has_function_privilege('anon','public.inventory_admin_company_counts(uuid[])','execute') then raise exception 'Anonymous execute privilege exposed'; end if;
 perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000000',true);
 begin perform public.inventory_admin_company_counts(null); exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'Non-admin accessed private inventory counts'; end if;
 perform set_config('request.jwt.claim.sub',owner::text,true);
 if not public.is_inventory_admin() then raise exception 'Owner role not recognized'; end if;
 payload:=public.inventory_admin_company_counts(array[owner]);
 select i.data into source from public.inventory i where i.owner_id=owner;
 if (payload->owner::text->'oil'->>'receipts')::integer<>jsonb_array_length(coalesce(source->'receipts','[]'::jsonb)) then raise exception 'Edible Oil counts incorrect'; end if;
 if (payload->owner::text->'sugar'->>'receipts')::integer<>jsonb_array_length(coalesce(source#>'{companyInventories,sugar,receipts}','[]'::jsonb)) then raise exception 'Sugar counts incorrect'; end if;
 if (select count(*) from jsonb_object_keys(payload))<>1 then raise exception 'Account filter failed'; end if;
 if public.inventory_admin_company_counts(array[]::uuid[])<>'{}'::jsonb then raise exception 'Empty filter returned accounts'; end if;
end $$;
rollback;
select 'Private Superadmin company counts verified' as result;
