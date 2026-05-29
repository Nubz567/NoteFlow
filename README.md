# NoteFlow

A desktop notes app built with Tauri and Vite.

## Account deletion

Users can delete their account from **Settings → Delete account**.

### Setup (required once per Supabase project)

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → your project → **SQL Editor**.
2. Click **New query**, open [`supabase/delete_own_account.sql`](supabase/delete_own_account.sql), copy the **entire** file, paste it into the editor, and click **Run** (not only Save).
3. Wait about 30 seconds for the API schema to refresh.
4. In NoteFlow, sign in, open **Settings → Delete account**, enter your password when asked.

If you still see an error, check **Database → Functions** for `delete_own_account`. If it is missing, the SQL did not run successfully.

### Alternative (Edge Function)

Deploy [`supabase/functions/delete-account`](supabase/functions/delete-account) with the Supabase CLI. The app tries the SQL function first, then falls back to this function.