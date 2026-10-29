-- Private company-aware reporting. No inventory data or public sharing settings change.
begin;
do $$ begin
 if not exists(select 1 from auth.users u join public.inventory_admins a on a.user_id=u.id where lower(u.email)='jcnino16@gmail.com' and u.email_confirmed_at is not null) then raise exception 'The existing confirmed Superadmin owner was not found'; end if;
end $$;
create or replace function public.inventory_admin_company_counts(account_ids uuid[] default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not public.is_inventory_admin() then raise exception 'Superadmin access required' using errcode='42501'; end if;
 return (select coalesce(jsonb_object_agg(i.owner_id::text,jsonb_build_object(
  'oil',jsonb_build_object('receipts',jsonb_array_length(coalesce(i.data->'receipts','[]'::jsonb)),'issues',jsonb_array_length(coalesce(i.data->'issues','[]'::jsonb)),'unit',coalesce(i.data->>'unit','bags (LKg)')),
  'sugar',jsonb_build_object('receipts',jsonb_array_length(coalesce(i.data#>'{companyInventories,sugar,receipts}','[]'::jsonb)),'issues',jsonb_array_length(coalesce(i.data#>'{companyInventories,sugar,issues}','[]'::jsonb)),'unit',coalesce(i.data#>>'{companyInventories,sugar,unit}','bags (LKg)'))
 )),'{}'::jsonb) from public.inventory i where account_ids is null or i.owner_id=any(account_ids));
end $$;
revoke all on function public.inventory_admin_company_counts(uuid[]) from public,anon;
grant execute on function public.inventory_admin_company_counts(uuid[]) to authenticated;
commit;
