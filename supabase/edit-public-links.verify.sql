-- Append in place of COMMIT in edit-public-links.sql for a rollback-only rehearsal.
insert into auth.users(id,email) values('ffffffff-ffff-4fff-8fff-fffffffffff3','editable-link-test@example.invalid');
set local role authenticated;
select set_config('request.jwt.claim.sub','ffffffff-ffff-4fff-8fff-fffffffffff3',true);
do $$ declare before_token uuid;begin
 if public.inventory_slug_available('public') then raise exception 'Taken code reported available';end if;
 if not public.inventory_slug_available((select slug from public.inventory_shares)) then raise exception 'Own code reported taken';end if;
 if public.inventory_slug_available('toolong7') or public.inventory_slug_available('a-b') then raise exception 'Invalid code accepted';end if;
 begin perform public.set_inventory_slug('public');raise exception 'Taken code overwritten';exception when unique_violation then null;end;
 begin perform public.set_inventory_slug('toolong7');raise exception 'Long code saved';exception when invalid_parameter_value then null;end;
 select token into before_token from public.inventory_shares;
 perform public.set_inventory_slug('test09');
 if (select slug from public.inventory_shares)<>'test09' or (select enabled from public.inventory_shares) or (select token from public.inventory_shares)=before_token then raise exception 'Private editable link save failed';end if;
 if has_function_privilege('anon','public.inventory_slug_available(text)','EXECUTE') or has_function_privilege('anon','public.set_inventory_slug(text)','EXECUTE') then raise exception 'Anonymous editor access allowed';end if;
end $$;
reset role;
select 'PASS: available, taken, validation, private save, token rotation and anonymous permissions' as verification;
rollback;
