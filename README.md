# Sugar Inventory

Existing inventory interface, packaged with Vite for Vercel, using Supabase Auth and PostgreSQL. Approved accounts share one inventory. Receipts, issuance lines, clients and settings are stored together in a JSONB document; revision checks prevent concurrent browser sessions from silently overwriting each other. This preserves the original backup format and atomic multi-record edits.

## Supabase setup

1. Open https://supabase.com/dashboard/project/nvkawrmoacikzdfowvem/sql/new and run `supabase/setup.sql` once.
2. Under Authentication → Users, create your email/password account. Disable public signups under Auth settings if only invited staff should sign in.
3. Run the membership insert shown at the bottom of `supabase/setup.sql`, with your email. Repeat for each staff member who should access the shared inventory.
4. Anonymous visitors and accounts without membership cannot read or update inventory. Never use a service-role key in this frontend.

The app uses the supplied project URL and public publishable key. These identify the project; database access is enforced with Auth and row level security.

## Run locally

Requires Node 22.12+.

```sh
npm ci
cp .env.example .env.local
npm run dev
```

## GitHub

Create an empty `sugar-inventory` repository at https://github.com/new while signed in as `nlnino71`. Do not initialize it with a README.

```sh
git init
git add .
git commit -m "Set up sugar inventory for Vercel and Supabase"
git branch -M main
git remote add origin https://github.com/nlnino71/sugar-inventory.git
git push -u origin main
```

`.env.local`, dependencies and generated build output are ignored. `Sugar Inventory.html` is the untouched original reference; the deployed entry is `index.html` with `app.js`.

## Deploy to Vercel

1. Import the GitHub repository into Vercel.
2. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` using `.env.example` for the values, in Production and Preview environments.
3. Deploy. `vercel.json` configures Vite, the build command, and the `dist` output directory.
4. In Supabase Authentication → URL Configuration set Site URL to the production Vercel URL.
5. Sign in, add an SRO quantity, refresh, and confirm it remains. Sign in on another device to verify shared access. Verify an unapproved account cannot load inventory.

Existing data in the original file remains in that browser. Export a JSON backup there and use More → Restore from backup in the deployed app after signing in. Restore, sample data and delete-all affect the shared inventory for every approved account.

## Verification

```sh
npm test
npm run build
```

Live database checks require running the SQL and provisioning a user in the supplied Supabase project. Publishing requires access to your GitHub/Vercel account.
