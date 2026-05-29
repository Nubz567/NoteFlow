-- NoteFlow: enable Settings → Delete account
--
-- IMPORTANT: Copy everything BELOW this line (from "create or replace" to the end).
-- Do NOT paste the file path (e.g. Noteflow/supabase/...) into SQL Editor.
--
-- 1. Supabase Dashboard → your project → SQL Editor → New query
-- 2. Paste only the SQL commands below → Run
-- 3. Wait ~30 seconds, then try Delete account in the app

create or replace function public.delete_own_account()
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  user_id uuid;
begin
  user_id := auth.uid();

  if user_id is null then
    raise exception 'Not authenticated';
  end if;

  delete from auth.users where id = user_id;

  return json_build_object('deleted', true);
end;
$$;

alter function public.delete_own_account() owner to postgres;

revoke all on function public.delete_own_account() from public;
grant execute on function public.delete_own_account() to authenticated;
grant execute on function public.delete_own_account() to service_role;

notify pgrst, 'reload schema';
