-- Run as the project owner after account-backups.sql. All changes roll back.
begin;
select set_config('backup.verify.owner',(select owner_id::text from public.inventory order by owner_id limit 1),true);
select set_config('backup.verify.other',(select owner_id::text from public.inventory where owner_id::text<>current_setting('backup.verify.owner') order by owner_id limit 1),true);
do $$ begin
 if nullif(current_setting('backup.verify.owner'),'') is null or nullif(current_setting('backup.verify.other'),'') is null then raise exception 'Two account inventories required for ownership verification';end if;
 if has_table_privilege('anon','public.inventory_account_backups','SELECT') or has_table_privilege('authenticated','public.inventory_account_backups','INSERT,UPDATE,DELETE') then raise exception 'Unsafe backup table grants';end if;
 if has_function_privilege('anon','public.create_inventory_backup()','EXECUTE') or has_function_privilege('anon','public.restore_inventory_backup(uuid,integer)','EXECUTE') or has_function_privilege('authenticated','public.capture_inventory_account_backup()','EXECUTE') then raise exception 'Unsafe backup function grants';end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('backup.verify.owner'),true);
do $$
declare b uuid; before_data jsonb; before_revision integer; next_revision integer; n bigint; other_id uuid;
begin
 select data,revision into before_data,before_revision from public.inventory where owner_id=auth.uid();
 b:=public.create_inventory_backup();
 if not exists(select 1 from public.inventory_account_backups where id=b and kind='manual' and data=before_data and revision=before_revision) then raise exception 'Manual snapshot is not exact';end if;
 if exists(select 1 from public.inventory_account_backups where owner_id<>auth.uid()) then raise exception 'Cross-account list leak';end if;
 select count(*) into n from public.inventory_account_backups;
 if public.restore_inventory_backup(b,before_revision+999) is not null then raise exception 'Stale restore accepted';end if;
 if (select count(*) from public.inventory_account_backups)<>n then raise exception 'Conflict created a backup';end if;
 next_revision:=public.save_inventory(before_revision,jsonb_set(before_data,'{lowStockPercent}',to_jsonb((coalesce((before_data->>'lowStockPercent')::integer,20)+1)%101)));
 if next_revision is distinct from before_revision+1 then raise exception 'Fixture save failed';end if;
 if not exists(select 1 from public.inventory_account_backups where revision=next_revision and kind='automatic' and data=(select data from public.inventory where owner_id=auth.uid())) then raise exception 'Automatic snapshot missing';end if;
 if public.save_inventory(before_revision,before_data) is not null then raise exception 'Stale save accepted';end if;
 if public.restore_inventory_backup(b,next_revision) is distinct from next_revision+1 then raise exception 'Restore failed';end if;
 if not exists(select 1 from public.inventory where owner_id=auth.uid() and data-'activity'=before_data-'activity') then raise exception 'Restore did not preserve inventory contents';end if;
 if not exists(select 1 from public.inventory_account_backups where kind='before_restore' and revision=next_revision and data->'lowStockPercent' is distinct from before_data->'lowStockPercent') then raise exception 'Safety snapshot missing';end if;
 perform set_config('backup.verify.id',b::text,true);
end $$;
select set_config('request.jwt.claim.sub',current_setting('backup.verify.other'),true);
do $$
declare rev integer; n bigint; denied boolean:=false;
begin
 if exists(select 1 from public.inventory_account_backups where id=current_setting('backup.verify.id')::uuid) then raise exception 'Cross-account snapshot read';end if;
 select revision into rev from public.inventory where owner_id=auth.uid();
 select count(*) into n from public.inventory_account_backups;
 begin perform public.restore_inventory_backup(current_setting('backup.verify.id')::uuid,rev);exception when no_data_found then denied:=true;end;
 if not denied then raise exception 'Cross-account restore accepted';end if;
 if (select count(*) from public.inventory_account_backups)<>n then raise exception 'Denied restore modified history';end if;
 begin insert into public.inventory_account_backups(owner_id,revision,kind,data) values(auth.uid(),0,'manual','{}');raise exception 'Direct insert accepted';exception when insufficient_privilege then null;end;
 begin update public.inventory_account_backups set kind='manual';raise exception 'Direct update accepted';exception when insufficient_privilege then null;end;
 begin delete from public.inventory_account_backups;raise exception 'Direct delete accepted';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claim.sub','',true);
do $$ begin
 begin perform public.create_inventory_backup();raise exception 'Signed-out create accepted';exception when insufficient_privilege then null;end;
end $$;
reset role;
select 'Account backups: manual, automatic, restore safety, conflicts and ownership checks passed' as result;
rollback;
