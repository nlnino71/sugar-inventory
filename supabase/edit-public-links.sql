-- Run after short-public-links.sql. Sharing remains opt-in.
begin;
create or replace function public.inventory_slug_available(requested_slug text)
returns boolean language plpgsql stable security definer set search_path='' as $$
declare code text:=lower(btrim(requested_slug));
begin
 if auth.uid() is null then raise exception 'Sign in required';end if;
 if code is null or code !~ '^[a-z0-9]{3,6}$' then return false;end if;
 return not exists(select 1 from public.inventory_shares where slug=code and owner_id<>auth.uid());
end $$;
revoke all on function public.inventory_slug_available(text) from public,anon;
grant execute on function public.inventory_slug_available(text) to authenticated;
create or replace function public.set_inventory_slug(requested_slug text)
returns text language plpgsql security definer set search_path='' as $$
declare code text:=lower(btrim(requested_slug));
begin
 if auth.uid() is null then raise exception 'Sign in required';end if;
 if code is null or code !~ '^[a-z0-9]{3,6}$' then raise exception 'Use 3–6 letters or numbers' using errcode='22023';end if;
 perform public.provision_account_inventory(auth.uid());
 -- Unique slug index arbitrates races. No check-then-write authorization gap.
 update public.inventory_shares set token=case when slug=code then token else gen_random_uuid() end,slug=code
 where owner_id=auth.uid();
 return code;
end $$;
revoke all on function public.set_inventory_slug(text) from public,anon;
grant execute on function public.set_inventory_slug(text) to authenticated;
commit;
