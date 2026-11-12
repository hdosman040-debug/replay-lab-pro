-- Phase 2: apply only after the version-aware frontend is deployed and verified.
-- Stale open tabs must reload. They must never overwrite newer cloud data.
create or replace function private.check_user_state_revision()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if TG_OP = 'INSERT' then
    if NEW.revision is distinct from 1::bigint then
      raise exception 'New state must start at revision 1' using errcode = '40001';
    end if;
  else
    if NEW.user_id is distinct from OLD.user_id or NEW.key is distinct from OLD.key then
      raise exception 'State ownership and key cannot change' using errcode = '40001';
    end if;
    if NEW.revision is distinct from OLD.revision + 1 then
      raise exception 'State revision conflict; reload the latest app' using errcode = '40001';
    end if;
  end if;
  NEW.updated_at := pg_catalog.clock_timestamp();
  return NEW;
end;
$$;

revoke all on function private.check_user_state_revision() from public, anon, authenticated;
-- Keep tombstones, so deleting and recreating a key cannot reset its revision.
revoke all on table public.user_state from public, anon, authenticated;
grant select, insert, update on table public.user_state to authenticated;
drop policy if exists user_state_delete_own on public.user_state;
