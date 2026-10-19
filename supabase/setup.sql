-- Run once in the SQL editor of project nvkawrmoacikzdfowvem.
begin;
create table public.inventory_members (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.inventory_members enable row level security;
create policy member_self on public.inventory_members for select to authenticated
using (user_id = (select auth.uid()));
grant select on public.inventory_members to authenticated;
revoke all on public.inventory_members from anon;

create table public.inventory (
  id text primary key check (id = 'main'),
  data jsonb not null,
  revision integer not null default 0 check (revision >= 0),
  updated_at timestamptz not null default now(),
  constraint inventory_shape check (
    jsonb_typeof(data) = 'object'
    and jsonb_typeof(data->'receipts') = 'array'
    and jsonb_typeof(data->'issues') = 'array'
    and jsonb_typeof(data->'clients') = 'array'
    and jsonb_typeof(data->'unit') = 'string'
    and jsonb_typeof(data->'seq') = 'number'
    and data ?& array['receipts','issues','clients','unit','seq']
  )
);
insert into public.inventory(id,data) values ('main','{"unit":"bags (LKg)","receipts":[],"issues":[],"clients":[],"seq":0}');
alter table public.inventory enable row level security;
create policy inventory_read on public.inventory for select to authenticated
using (exists (select 1 from public.inventory_members where user_id = (select auth.uid())));
create policy inventory_write on public.inventory for update to authenticated
using (exists (select 1 from public.inventory_members where user_id = (select auth.uid())))
with check (exists (select 1 from public.inventory_members where user_id = (select auth.uid())));
grant select on public.inventory to authenticated;
grant update(data,revision,updated_at) on public.inventory to authenticated;
revoke all on public.inventory from anon;

create function public.save_inventory(expected_revision integer, new_data jsonb)
returns integer language plpgsql security invoker set search_path = '' as $$
declare saved_revision integer;
begin
  update public.inventory
  set data=new_data, revision=revision+1, updated_at=now()
  where id='main' and revision=expected_revision
  returning revision into saved_revision;
  return saved_revision;
end;
$$;
revoke all on function public.save_inventory(integer,jsonb) from public,anon;
grant execute on function public.save_inventory(integer,jsonb) to authenticated;
commit;

-- Next: create an email/password user under Authentication > Users.
-- Replace the email below, then run this separately to allow access:
-- insert into public.inventory_members(user_id)
-- select id from auth.users where email = 'YOUR_EMAIL' on conflict do nothing;
