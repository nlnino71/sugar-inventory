-- Rollback-only checks: no inventory or sharing settings are modified.
begin;
do $$
declare projected jsonb; owner uuid; token uuid; slug text; result jsonb;
begin
 projected:=public.inventory_public_company('{"unit":"kg","receipts":[{"sro":"A","qty":7,"private":"secret"}],"issues":[{"client":"Client","qty":2,"van":"PRIVATE-PLATE","notes":"secret"}],"clients":["secret"],"clientProfiles":{"Client":{"email":"secret"}},"activity":[{"summary":"secret"}],"password":"secret"}'::jsonb);
 if projected::text like '%secret%' or projected::text like '%PRIVATE-PLATE%' then raise exception 'Private company fields leaked'; end if;
 if projected->>'unit'<>'kg' or projected->'receipts'->0->>'qty'<>'7' then raise exception 'Operational fields lost'; end if;
 if public.inventory_public_company(null)->'receipts'<>'[]'::jsonb then raise exception 'Missing company not empty'; end if;
 if has_function_privilege('anon','public.inventory_public_company(jsonb)','execute') or has_function_privilege('authenticated','public.inventory_public_company(jsonb)','execute') then raise exception 'Helper exposed'; end if;
 if not has_function_privilege('anon','public.get_public_inventory(uuid)','execute') then raise exception 'Public sharing unavailable'; end if;
 if public.get_public_inventory('00000000-0000-0000-0000-000000000000') is not null then raise exception 'Invalid token accepted'; end if;
 for token,slug in select s.token,s.slug from public.inventory_shares s where s.enabled loop
  result:=public.get_public_inventory(token);
  if result->'companyInventories'->'sugar' is null then raise exception 'Sugar projection missing'; end if;
  if (result->'companyInventories'->'sugar'->'clientProfiles')<>'{}'::jsonb or (result->'companyInventories'->'sugar'->'activity')<>'[]'::jsonb then raise exception 'Private Sugar data leaked'; end if;
  if public.get_public_inventory_by_slug(slug) is distinct from result then raise exception 'Slug/token disagree'; end if;
 end loop;
 if exists(select 1 from public.inventory_shares s where not s.enabled and public.get_public_inventory(s.token) is not null) then raise exception 'Disabled share returned data'; end if;
end $$;
rollback;
select 'Company public sharing verification passed' as result;
