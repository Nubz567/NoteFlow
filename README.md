# NoteFlow

A desktop notes app built with Tauri and Vite.

**Current version:** 0.2.0

## Release on GitHub

### 1. Push source code

From the `Noteflow` folder (where `.git` lives):

```powershell
git add .
git status
git commit -m "Release NoteFlow 0.2.0"
git push origin main
```

### 2. Tag the release (recommended)

```powershell
git tag v0.2.0
git push origin v0.2.0
```

### 3. Create a GitHub Release

1. Open https://github.com/Nubz567/noteflow/releases → **Draft a new release**
2. Choose tag `v0.2.0`
3. Title: **NoteFlow 0.2.0**
4. Paste the **0.2.0** section from [CHANGELOG.md](CHANGELOG.md)
5. Attach built installers (optional, see below)

### 4. Build installers (optional)

```powershell
cd Noteflow
npm install
npm run tauri build
```

Installers are created under:

`src-tauri/target/release/bundle/`

- **Windows:** `.msi` / `.exe` in `bundle/msi/` or `bundle/nsis/`
- Upload those files to the GitHub release

### What to include in the repository

| Include | Do not include |
|--------|----------------|
| `src/`, `src-tauri/`, `supabase/` | `.env` (secrets) |
| `package.json`, `package-lock.json` | `node_modules/` |
| `index.html`, `vite`/`ts` config | `dist/` |
| `README.md`, `CHANGELOG.md` | `src-tauri/target/` |
| `.gitignore` | `*.log` |

Copy `.env.example` to `.env` locally for Supabase keys; never commit `.env`.

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