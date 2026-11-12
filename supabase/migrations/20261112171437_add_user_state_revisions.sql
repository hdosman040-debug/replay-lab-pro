-- Phase 1: deploy before the version-aware frontend. Existing clients remain usable.
alter table public.user_state
  add column revision bigint not null default 1,
  add column deleted boolean not null default false,
  add constraint user_state_revision_positive check (revision > 0);

create schema if not exists private;

create function private.check_user_state_revision()
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
    -- Temporary compatibility for clients that have not loaded the new frontend.
    if NEW.revision = OLD.revision then
      NEW.revision := OLD.revision + 1;
    elsif NEW.revision is distinct from OLD.revision + 1 then
      raise exception 'State revision conflict' using errcode = '40001';
    end if;
  end if;
  NEW.updated_at := pg_catalog.clock_timestamp();
  return NEW;
end;
$$;

revoke all on function private.check_user_state_revision() from public, anon, authenticated;
create trigger user_state_revision_guard
before insert or update on public.user_state
for each row execute function private.check_user_state_revision();
