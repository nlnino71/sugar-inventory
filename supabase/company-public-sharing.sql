-- Both company inventories share the account's existing enabled/revoked link.
-- Project each company separately; never return its unfiltered JSON document.
begin;
create or replace function public.inventory_public_company(source jsonb)
returns jsonb language sql immutable set search_path='' as $$
 select jsonb_build_object(
  'unit',coalesce(source->'unit','"bags (LKg)"'::jsonb),
  'seq',coalesce(source->'seq','0'::jsonb),
  'lowStockPercent',coalesce(source->'lowStockPercent','20'::jsonb),
  'receipts',coalesce((select jsonb_agg(jsonb_build_object(
   'id',r->'id','date',r->'date','sro',r->'sro','type',r->'type',
   'mill',r->'mill','crop',r->'crop','qty',r->'qty'
  )) from jsonb_array_elements(coalesce(source->'receipts','[]'::jsonb)) r),'[]'::jsonb),
  'issues',coalesce((select jsonb_agg(jsonb_build_object(
   'id',r->'id','date',r->'date','sro',r->'sro','type',r->'type',
   'client',r->'client','qty',r->'qty','seq',r->'seq','batch',r->'batch',
   'atw',r->'atw','permit',r->'permit','waybill',r->'waybill',
   'bol',r->'bol','vessel',r->'vessel','voy',r->'voy','sail',r->'sail'
  )) from jsonb_array_elements(coalesce(source->'issues','[]'::jsonb)) r),'[]'::jsonb),
  'clients','[]'::jsonb,'clientProfiles','{}'::jsonb,'activity','[]'::jsonb
 );
$$;
revoke all on function public.inventory_public_company(jsonb) from public,anon,authenticated;
create or replace function public.get_public_inventory(share_token uuid)
returns jsonb language sql stable security definer set search_path='' as $$
 select public.inventory_public_company(i.data) || jsonb_build_object(
  'companyInventories',jsonb_build_object('sugar',public.inventory_public_company(i.data->'companyInventories'->'sugar'))
 ) from public.inventory i join public.inventory_shares s on s.id=i.id
 where s.enabled and s.token=share_token;
$$;
revoke all on function public.get_public_inventory(uuid) from public;
grant execute on function public.get_public_inventory(uuid) to anon,authenticated;
commit;
