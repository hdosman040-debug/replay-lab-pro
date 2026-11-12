-- Run after phase 2 as the database administrator. Every test write rolls back.
begin;
select set_config('request.jwt.claim.sub', (select id::text from auth.users order by created_at limit 1), true);
select set_config('request.jwt.claims', jsonb_build_object('sub', current_setting('request.jwt.claim.sub'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
declare
  owner_id text := (select auth.uid())::text;
  test_key text := '__revision_regression__' || pg_catalog.gen_random_uuid()::text;
  changed integer;
  observed bigint;
begin
  insert into public.user_state(user_id, key, value, revision) values(owner_id, test_key, 'first', 1);
  update public.user_state set value = 'second', revision = 2
    where user_id = owner_id and key = test_key and revision = 1;
  get diagnostics changed = row_count;
  assert changed = 1, 'Current version must save';
  update public.user_state set value = 'stale', revision = 2
    where user_id = owner_id and key = test_key and revision = 1;
  get diagnostics changed = row_count;
  assert changed = 0, 'Stale save must not replace newer data';
  begin
    update public.user_state set value = 'legacy overwrite' where user_id = owner_id and key = test_key;
    raise exception 'Legacy unversioned update was accepted';
  exception when serialization_failure then null;
  end;
  begin
    insert into public.user_state(user_id, key, value) values(owner_id, test_key, 'legacy upsert')
      on conflict(user_id, key) do update set value = excluded.value;
    raise exception 'Legacy upsert was accepted';
  exception when serialization_failure then null;
  end;
  begin
    update public.user_state set revision = 5 where user_id = owner_id and key = test_key;
    raise exception 'Skipped revision was accepted';
  exception when serialization_failure then null;
  end;
  update public.user_state set value = '', deleted = true, revision = 3
    where user_id = owner_id and key = test_key and revision = 2;
  update public.user_state set value = 'recreated', deleted = false, revision = 4
    where user_id = owner_id and key = test_key and revision = 3;
  select revision into observed from public.user_state where user_id = owner_id and key = test_key;
  assert observed = 4, 'Delete and recreate must preserve revision history';
  begin
    delete from public.user_state where user_id = owner_id and key = test_key;
    raise exception 'Hard deletion was accepted';
  exception when insufficient_privilege then null;
  end;
  assert not has_table_privilege(current_user, 'public.user_state', 'TRUNCATE'), 'Clients must not truncate state';
  begin
    update public.user_state set key = test_key || '-renamed', revision = 5 where user_id = owner_id and key = test_key;
    raise exception 'Changing a key was accepted';
  exception when serialization_failure then null;
  end;
  perform set_config('request.jwt.claim.sub', pg_catalog.gen_random_uuid()::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', current_setting('request.jwt.claim.sub'), 'role', 'authenticated')::text, true);
  assert not exists(select 1 from public.user_state where user_id = owner_id and key = test_key), 'Other accounts must not read state';
  update public.user_state set value = 'other account', revision = 5 where user_id = owner_id and key = test_key;
  get diagnostics changed = row_count;
  assert changed = 0, 'Other accounts must not update state';
  begin
    insert into public.user_state(user_id, key, value) values(owner_id, test_key || '-other', 'other account');
    raise exception 'Other account insert was accepted';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;
select 'user_state revision, tombstone and account-isolation checks passed' as result;
rollback;
