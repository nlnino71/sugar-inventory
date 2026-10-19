-- Apply after network-enrichment.sql. Adds existing sessions without fabricating historical sign-ins.
begin;
create or replace function public.inventory_admin_dashboard(page_number integer default 0) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; page_offset integer;
begin
 if not public.is_inventory_admin() then raise exception 'Superadmin access required' using errcode='42501'; end if;
 page_offset:=greatest(0,least(coalesce(page_number,0),10000))*50;
 select jsonb_build_object(
 'totalUsers',(select count(*) from auth.users),
 'accounts',coalesce((select jsonb_agg(x) from (select u.id,u.email,u.created_at,u.last_sign_in_at,u.email_confirmed_at,i.updated_at,i.revision,
 jsonb_array_length(coalesce(i.data->'receipts','[]'::jsonb)) receipts,jsonb_array_length(coalesce(i.data->'issues','[]'::jsonb)) issues,
 coalesce(s.enabled,false) sharing_enabled
 from auth.users u left join public.inventory i on i.owner_id=u.id left join public.inventory_shares s on s.owner_id=u.id order by u.created_at desc,u.id limit 50 offset page_offset) x),'[]'::jsonb),
 'events',coalesce((select jsonb_agg(x) from (select a.id,a.occurred_at,a.actor_id,u.email,a.owner_id,a.event,a.details,n.network from public.inventory_audit a left join auth.users u on u.id=a.actor_id left join public.inventory_ip_networks n on n.ip=coalesce(a.details->'request_network'->>'ip',a.details->'server_session'->>'ip') order by a.occurred_at desc,a.id desc limit 50 offset page_offset) x),'[]'::jsonb),
 'authRecordCount',(select count(*) from auth.audit_log_entries),
 'authSessions',coalesce((select jsonb_agg(x) from (select s.id,s.user_id,u.email,to_jsonb(s)->>'created_at' created_at,to_jsonb(s)->>'updated_at' updated_at,s.ip::text ip_address,s.user_agent,n.network
 from auth.sessions s join auth.users u on u.id=s.user_id left join public.inventory_ip_networks n on n.ip=s.ip::text order by (to_jsonb(s)->>'created_at') desc nulls last,s.id limit 50 offset page_offset) x),'[]'::jsonb),
 'authEvents',coalesce((select jsonb_agg(x) from (select a.id,a.created_at,a.ip_address,a.payload->>'action' action,a.payload->>'actor_id' actor_id,a.payload->>'actor_username' email,n.network from auth.audit_log_entries a left join public.inventory_ip_networks n on n.ip=a.ip_address::text order by a.created_at desc,a.id desc limit 50 offset page_offset) x),'[]'::jsonb)
 ) into result;
 return result;
end $$;
revoke all on function public.inventory_admin_dashboard(integer) from public,anon;
grant execute on function public.inventory_admin_dashboard(integer) to authenticated;
commit;
