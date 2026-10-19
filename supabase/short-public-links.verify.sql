-- Append to short-public-links.sql in place of COMMIT for a rollback-only check.
insert into auth.users(id,email) values('ffffffff-ffff-4fff-8fff-fffffffffff2','short-links-test@example.invalid');
set local role authenticated;
select set_config('request.jwt.claim.sub','ffffffff-ffff-4fff-8fff-fffffffffff2',true);
do $$ declare before_slug text; after_slug text; before_token uuid;begin
 select slug,token into before_slug,before_token from public.inventory_shares;
 if before_slug!~'^[a-z0-9]{6}$' or (select enabled from public.inventory_shares) then raise exception 'New account must have a short private link';end if;
 perform public.replace_inventory_link();
 select slug into after_slug from public.inventory_shares;
 if after_slug=before_slug or after_slug!~'^[a-z0-9]{6}$' or before_token=(select token from public.inventory_shares) or (select enabled from public.inventory_shares) then raise exception 'Replacement must change token and stay private';end if;
 if has_column_privilege('authenticated','public.inventory_shares','slug','UPDATE') or has_column_privilege('authenticated','public.inventory_shares','token','UPDATE') then raise exception 'Direct code edits allowed';end if;
 if public.get_public_inventory_by_slug(after_slug) is not null then raise exception 'Private link exposed';end if;
 if public.get_public_inventory_by_slug('public') is null then raise exception 'Existing public link broken';end if;
end $$;
reset role;
select 'PASS: random 6-character links, disabled defaults, replacement preserves privacy, original public link retained' as verification;
rollback;
