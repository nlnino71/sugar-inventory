begin;
do $$declare owner uuid;result jsonb;begin
 select user_id into owner from public.inventory_admins limit 1;
 perform set_config('request.jwt.claim.sub',owner::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',owner)::text,true);
 result:=public.inventory_admin_dashboard(0);
 if jsonb_typeof(result->'authSessions') is distinct from 'array' then raise exception 'Session list missing';end if;
 if (result->>'authRecordCount')::bigint is distinct from (select count(*) from auth.audit_log_entries) then raise exception 'Authentication count mismatch';end if;
 if exists(select 1 from jsonb_array_elements(result->'authSessions') s where s ?| array['token','refresh_token','factor_id']) then raise exception 'Private auth credential exposed';end if;
 perform set_config('request.jwt.claim.sub','',true);perform set_config('request.jwt.claims','{}',true);
 begin perform public.inventory_admin_dashboard(0);raise exception 'Anonymous admin access';exception when insufficient_privilege then null;end;
end $$;
select 'Session list, auth count and private access passed' as result;
rollback;
