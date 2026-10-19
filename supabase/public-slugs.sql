-- Add readable public URLs without changing public data fields or write permissions.
begin;
alter table public.inventory_shares add column if not exists slug text not null default 'public'
  unique check(length(slug) between 3 and 64 and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
update public.inventory_shares set slug='public' where id='main' and slug='sugar-inventory';
grant update(slug) on public.inventory_shares to authenticated;
create or replace function public.get_public_inventory_by_slug(share_slug text)
returns jsonb language sql stable security definer set search_path='' as $$
  select public.get_public_inventory(s.token)
  from public.inventory_shares s
  where s.id='main' and s.enabled and s.slug=share_slug;
$$;
revoke all on function public.get_public_inventory_by_slug(text) from public;
grant execute on function public.get_public_inventory_by_slug(text) to anon, authenticated;
commit;
