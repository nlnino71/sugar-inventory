-- Run as project owner after admin-stats.sql. All verification changes roll back.
begin;
do $$declare account uuid; baseline jsonb; result jsonb; denied boolean:=false;begin
 select id into account from auth.users where lower(email)='jcnino16@gmail.com';
 if account is null then raise exception 'Owner account required';end if;
 perform set_config('request.jwt.claim.sub',account::text,true);
 baseline:=public.inventory_admin_stats(7);
 insert into public.inventory_audit(actor_id,owner_id,event,details)
 select account,account,'browser.page.view',jsonb_build_object('session','stats-verification-session','context',jsonb_build_object('page','stats-verification','device',jsonb_build_object('userAgent','Mozilla/5.0 Chrome/130.0 Safari/537.36'))) from generate_series(1,61);
 result:=public.inventory_admin_stats(7);
 if (result->'summary'->>'events')::bigint<>(baseline->'summary'->>'events')::bigint+61 or (result->'summary'->>'pageViews')::bigint<>(baseline->'summary'->>'pageViews')::bigint+61 then raise exception 'Stats truncated or counted incorrectly';end if;
 if jsonb_array_length(result->'daily')<>7 or jsonb_array_length(result->'hours')<>24 then raise exception 'Missing zero-filled time buckets';end if;
 if (result->>'from')::date<>((now() at time zone 'Asia/Manila')::date-6) then raise exception 'Wrong reporting timezone';end if;
 if not exists(select 1 from jsonb_array_elements(result->'pages') p where p->>'label'='stats-verification' and (p->>'value')::bigint>=61) then raise exception 'Missing page totals';end if;
 if jsonb_array_length(public.inventory_admin_stats(90)->'daily')<>90 then raise exception '90-day range unavailable';end if;
 begin perform public.inventory_admin_stats(365);exception when raise_exception then denied:=true;end;
 if not denied then raise exception 'Unbounded reporting range permitted';end if;
 perform set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000000',true);denied:=false;
 begin perform public.inventory_admin_stats(7);exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Non-admin may read stats';end if;
 if has_function_privilege('anon','public.inventory_admin_stats(integer)','EXECUTE') then raise exception 'Anonymous stats exposed';end if;
 raise notice 'Full-period aggregation, dates, empty buckets, bounds and admin restriction verified';
end $$;
rollback;
