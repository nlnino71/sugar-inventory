-- Run after account-inventories.sql. Existing enabled links remain valid.
begin;
create or replace function public.random_inventory_slug()
returns text language plpgsql volatile set search_path='' as $$
declare alphabet text:='abcdefghijklmnopqrstuvwxyz0123456789'; bytes bytea; code text; n integer; value integer;
begin
 loop
  bytes:=decode(substr(replace(gen_random_uuid()::text,'-',''),1,12),'hex');code:='';
  for n in 0..5 loop
   value:=get_byte(bytes,n);
   if value>=252 then exit;end if;
   code:=code||substr(alphabet,1+(value%36),1);
  end loop;
  if length(code)=6 then return code;end if;
 end loop;
end $$;
revoke all on function public.random_inventory_slug() from public,anon,authenticated;
create or replace function public.provision_account_inventory(account_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare inventory_id text;
begin
 if account_id is null then raise exception 'Account required';end if;
 insert into public.inventory(id,owner_id,data)
 values('account-'||account_id::text,account_id,'{"unit":"bags (LKg)","receipts":[],"issues":[],"clients":[],"seq":0,"clientProfiles":{},"activity":[],"lowStockPercent":20}'::jsonb)
 on conflict(owner_id) do nothing;
 select id into inventory_id from public.inventory where owner_id=account_id;
 loop
  begin
   insert into public.inventory_shares(id,owner_id,slug,enabled)
   values(inventory_id,account_id,public.random_inventory_slug(),false)
   on conflict(owner_id) do nothing;
   exit;
  exception when unique_violation then null;
  end;
 end loop;
end $$;
revoke all on function public.provision_account_inventory(uuid) from public,anon,authenticated;
-- Replacing a link preserves its enabled/disabled state and revokes its old token.
create or replace function public.replace_inventory_link()
returns void language plpgsql security definer set search_path='' as $$
declare code text; previous_code text;
begin
 if auth.uid() is null then raise exception 'Sign in required';end if;
 perform public.provision_account_inventory(auth.uid());
 select slug into previous_code from public.inventory_shares where owner_id=auth.uid();
 loop
  code:=public.random_inventory_slug();
  if code=previous_code then continue;end if;
  begin
   update public.inventory_shares set slug=code,token=gen_random_uuid() where owner_id=auth.uid();
   return;
  exception when unique_violation then null;
  end;
 end loop;
end $$;
revoke all on function public.replace_inventory_link() from public,anon;
grant execute on function public.replace_inventory_link() to authenticated;
-- Codes and tokens are generated only by the owner-scoped replacement function.
revoke update(slug,token) on public.inventory_shares from authenticated;
-- Shorten unpublished default addresses without enabling them.
do $$ declare r record;begin
 for r in select owner_id from public.inventory_shares where not enabled and slug like 'inventory-%' loop
  loop
   begin
    update public.inventory_shares set slug=public.random_inventory_slug() where owner_id=r.owner_id;
    exit;
   exception when unique_violation then null;
   end;
  end loop;
 end loop;
end $$;
commit;
