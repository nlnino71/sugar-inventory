# Sugar Inventory

Existing inventory interface, packaged with Vite for Vercel, using Supabase Auth and PostgreSQL. Every registered account owns a separate private inventory. Receipts, issuance lines, clients and settings are stored together in a JSONB document; revision checks prevent concurrent browser sessions from silently overwriting each other. This preserves the original backup format and atomic multi-record edits.

## Supabase setup

For the existing deployment, `supabase/account-inventories.sql` has been applied after setup.sql, public-sharing.sql and public-slugs.sql. It preserves the original `main` inventory for the verified owner email, adds owner-only row policies, backfills other accounts with empty records, and provisions each future signup automatically. `ensure_inventory()` repairs a missing inventory only for the signed-in caller. New public links start disabled and have unique slugs; `/view/public` stays with the original owner.

For a fresh installation, run setup.sql, create the original owner account (update the verified owner email in the migration), then run public-sharing.sql, public-slugs.sql, account-inventories.sql short-public-links.sql and edit-public-links.sql in that order. Enable Supabase email signups and confirmation. Do not run the historical setup/share scripts again after upgrading, since they describe the old shared installation.

The migration transaction keeps pre-upgrade inventory and sharing snapshots in an inaccessible `inventory_backup` schema. Database owners can inspect those snapshots; browser clients cannot. Never use a service-role key in the frontend.

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
5. Sign in, add an SRO quantity, refresh, and confirm it remains. Sign in on another device to verify the same account’s records persist. Register a second account and verify it starts empty and cannot access the first account’s records.

Existing data in the original file remains in that browser. Export a JSON backup there and use More → Restore from backup in the deployed app after signing in. Restore, sample data and delete-all affect only the signed-in account’s inventory.

## Verification

```sh
npm test
npm run build
```

Live database checks require running the SQL and provisioning a user in the supplied Supabase project. Publishing requires access to your GitHub/Vercel account.

## Expanded workflows

- **Overview:** totals, today's issues, low and over-issued SROs, unmatched issuance warnings, stock held for 90 days, upcoming sailings, and the latest saved changes.
- **Issuance:** combine keyword search (ATW, SRO, batch, waybill, vessel and other references), client and inclusive date filters.
- **Clients:** maintain contact person, phone, email and notes, including clients without deliveries. Renaming a client updates their existing issuance records.
- **Reports:** choose a date period and sugar type for opening, received, issued and closing quantities by SRO. Export CSV and see client issuance totals for the same period. Opening balances include movements before the period; end-date filtering excludes future movements.
- **More:** set the shared low-stock percentage and choose a local light/dark/device appearance preference.

New fields are stored in the existing inventory JSON document and default safely for old backups. No database migration is required. Activity is capped at 200 entries and is shared operational history, not an immutable or user-attributed audit log.

Browser workflow checks use mocked Supabase responses and never write to the live inventory:

```sh
npm run test:browser
```

They run in installed Google Chrome at desktop and mobile viewport sizes.

## Public view-only sharing

Run `supabase/public-sharing.sql` once after the initial database setup. This creates a random sharing token and enables the sharing link. While signed in, open **More → Public view-only sharing** to copy the link, disable sharing, or replace the link. Replacing it invalidates the previous link.

The public URL uses `/#view=TOKEN`. Visitors do not sign in. They can view Overview, stock details, issuance and reports, including client names and delivery references. Public controls do not offer editing, exports, contacts, notes or change history. The public database function returns an explicit field projection; client profiles and history are excluded at the database boundary. Anonymous users retain no table read/write privileges; the function only returns data for the exact enabled token. An incorrect or revoked token returns no inventory.

Disabling or replacing a link prevents future loads; it cannot retract information a visitor has already viewed or copied. “View only” prevents writes, not screenshots or copying displayed information.

## Desktop layout

At 1024px and wider, the workspace uses a fixed left sidebar, wider content area, stock and delivery columns, compact filter rows, and right-side detail/edit panels. At narrower widths, navigation remains at the bottom and sheets retain the mobile presentation. The layout applies to staff and public viewers, with the same permissions as before. Browser checks cover 390px, 768px, 1280px, 1440px and 1920px widths.

## Self-service accounts

The sign-in screen includes **Create an account**. Anyone can register an email/password account, confirm the email from Supabase, and sign in. Registration automatically creates a private empty inventory; administrator approval is no longer required. Database row policies scope reads, edits and sharing settings to `auth.uid()`. Public sharing still works without an account.

Supabase must have email signup enabled and Site URL / allowed redirect URLs set to `https://sugar-inventory.vercel.app/`. The live project had signup enabled and confirmation required when this feature was implemented. Email sending limits and delivery are controlled by Supabase's mail configuration.

## Readable public URLs

Run `supabase/short-public-links.sql` after account-inventories.sql. New accounts receive a unique random 6-character lowercase letter/number code, such as `/view/a7b2c9`, with sharing **disabled**. Enable public sharing explicitly to expose the read-only projection. **Replace link** generates a fresh code and token, invalidates the old link, and preserves the enabled/disabled setting. Owners can edit codes to 3–6 letters/numbers. Availability is checked automatically 350 ms after typing pauses; stale results are ignored. Saving is checked by the unique database index, so a code claimed after the availability check is rejected. Editing preserves sharing enablement and invalidates the previous token and path. Database uniqueness checks retry collisions. Existing enabled links, including `/view/public`, are preserved. Short public codes are discoverable addresses, not authentication credentials.

Vercel rewrites `/view/:slug` to the app so shared links work on direct navigation and refresh.

## Messenger and Viber link previews

Public `/view/:slug` requests serve the app through `api/public-view.js`, which includes the exact canonical URL, Open Graph title/description, PNG image metadata and Twitter large-image tags in the initial HTML. No crawler JavaScript or account login is needed. Vercel includes the built `dist/index.html` in the function bundle. The 1200×630 preview at `/share-preview-v2.png` contains generic branding, not live inventory records or private client details.

Regenerate the committed preview image with `node scripts/generate-preview.mjs` (requires local Google Chrome). The image is already included in the repository; Vercel does not run Chrome during builds. Messenger/Viber control actual preview rendering and caching. Previously shared messages may retain their old previews; test by pasting the URL in a fresh message. Facebook's Sharing Debugger can request a fresh scrape.

## Accessibility and input hardening

Dialogs and nested confirmations have accessible names, move and contain keyboard focus, make the background inert, and restore focus on close. Ledger records use explicit Edit buttons. Authentication provides the active main landmark. Report and ledger scrolling regions are named and keyboard-focusable. Receipt and issuance errors are announced and identify invalid controls; failed saves retain the form contents. Imported identifiers/dates are escaped for HTML, and record aggregation supports reserved object-property names without breaking the interface. The optional spreadsheet script loads asynchronously, so it cannot block app startup.

`e2e/hardening.spec.js` covers keyboard focus, nested confirmations, validation, failed saves and unusual imported records, with the optional Excel CDN unavailable. This pass does not claim to resolve the baseline audit's status-color contrast, 320px filter sizing, touch targets or large-data calculation findings; those remain for the recommended colorize/adapt/optimize passes.

## Semantic color roles

Primary actions retain cane green. Healthy-stock text uses a separate high-contrast green token; warnings use amber; over-issuance and invalid fields use red; neutral depleted stock has its own text token; information and public read-only labels use blue. Theme-specific control outlines and focus rings are separate from subtle separators. Native date/select widgets inherit the selected light or dark color scheme.

`e2e/colors.spec.js` measures rendered contrast for all four stock states, errors, information panels, form outlines and focus indicators in light, dark and automatic themes at desktop and phone sizes. It also checks that the Fully issued badge stays compact and verifies labeled stock states under simulated deuteranopia.

## Narrow-screen and touch adaptation

Phone filters and paired form fields stack below 480px; wider screens keep their existing columns and desktop sidebar. Date inputs can shrink without forcing page-level horizontal scrolling. Long SRO/client references wrap, while report-table horizontal scrolling remains inside a named keyboard-accessible region. Chips, close/remove controls, batch actions, issuance lines and receipt rows have at least 44px touch targets. Narrow form action buttons stack so Save and Cancel remain readable.

`e2e/adaptation.spec.js` uses long mixed-character record names to check 320px, 390px, tablet, landscape, desktop, 4K and a 640px viewport representing desktop reflow at 200% zoom. These are Chrome viewport simulations rather than physical-device or cross-browser certification.

### Performance

Reports and client totals use indexed aggregation. Client search updates results without replacing the input or navigation. The Excel library is bundled locally and downloaded only when exporting; CSV remains available if Excel export fails. Run `node scripts/benchmark-features.mjs` for the synthetic large-inventory computation benchmark. See UI-AUDIT.md for measured before/after results and remaining scale limits.

### App branding

The sugar-cube and cane-sprout mark is available as `public/app-icon.svg`, with a matching `public/logo.svg` wordmark. Browser favicon, Apple touch icon, 192/512px app icons and the web manifest use the same mark. `node scripts/generate-icons.mjs` renders PNGs using Chrome; `magick public/app-icon-512.png -define icon:auto-resize=64,48,32,16 public/favicon.ico` regenerates the ICO. `node scripts/generate-preview.mjs` renders the Messenger/Viber Open Graph artwork. Preview artwork uses a versioned URL so services can fetch the refreshed branding; previously shared messages may retain their cached preview.

On phones and tablets below 1024px, staff navigation has four buttons: Overview, Stock, Issuance and Menu. Menu opens SRO Quantity, Clients, Reports and Settings & sharing in a keyboard-accessible sheet. The desktop sidebar retains all sections. Public viewers retain their four read-only destinations.

Account-isolation database checks were rehearsed against Supabase in a rolled-back transaction using account-inventories.sql followed by account-inventories.verify.sql in place of COMMIT. The verification fixture asserts the original deployment snapshot (8 receipts / 24 issuance lines); adapt those snapshot assertions for other datasets. Browser account tests use mocks; they supplement rather than prove database authorization.

Run `supabase/edit-public-links.sql` after short-public-links.sql to install authenticated availability checks and owner-only custom code saves. Anonymous users cannot call these functions; availability responses disclose only a boolean, not inventory data.

## Private superadmin

Apply `supabase/superadmin.sql` in the Supabase SQL Editor **after** the account-inventories upgrade. The migration requires an existing confirmed `jcnino16@gmail.com` account and pins that user's UUID. No browser or ordinary account can grant admin access. Sign in again, then open **More → Open superadmin**. Account, authentication and audit data is returned only by a database function that verifies this role; existing inventory ownership policies stay in force.

The console includes a paginated account directory, authentication history with provider-recorded IPs when available, database-triggered inventory/sharing change counts, and browser-reported app-open device details (user agent, platform, language, screen/viewport resolution, pixel ratio, timezone). App-open reports are limited to once per minute per account. Inventory changes start logging after migration; previous device reports cannot be recovered. No passwords or bearer/sharing tokens are exposed by the dashboard. The expanded audit includes complete before/after values of changed inventory records, including client contact details, visible only to superadmin. Auth history depends on Supabase's database auth audit-log setting and retention. Device reports are untrusted claims, not device identity. The additional activity-tracking migration below upgrades these count summaries to per-record before/after changes and browser interaction events.

For optional ISP/network organization lookup, configure `IPINFO_TOKEN` in Vercel server environment, along with `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` (the existing `VITE_` equivalents are accepted). Never prefix the IPinfo token with `VITE_`. Deploy the API and frontend. Lookup calls send only the selected IP to IPinfo, from the server, after verifying the session and database admin role. Network organization can be a VPN, hosting provider or mobile carrier; city/region are approximate. Local Vite does not serve Vercel API functions. Use deployed Vercel or Vercel dev for lookups.

Database owners remain able to manage these tables. Audit tables are inaccessible and unwritable to application roles except through the fixed, bounded app-open recorder; database triggers record inventory and sharing writes. Logs currently retain records until the project owner removes them; establish retention and disclose device/security logging in your privacy information before rollout.


### Expanded activity tracking

Apply `supabase/activity-tracking.sql` **after** `supabase/superadmin.sql`. Verify with `supabase/activity-tracking.verify.sql`; its transaction rolls back. Both migrations and verification scripts were exercised in a local PostgreSQL engine (PGlite) with representative Supabase auth tables; this does not replace running the verification against the actual project.

Database triggers log every receipt/issuance add, edit, and deletion, client membership/profile changes, settings, and sharing changes. Record events include before/after values, owner, actor, server timestamp, and inventory revision. Clear/import/restore operations produce individual record diffs. Physical inventory/sharing deletions are also audited. Sharing token values are excluded. Where available, events attach the authenticated Supabase session ID, session IP, and user agent. Session IP is authentication metadata, not proof of the IP used for every request. See [Supabase session claims](https://supabase.com/docs/guides/auth/sessions).

Browser events cover initial and subsequent page views, detail/confirmation panels, close/cancel actions, control clicks, form submissions, committed field/filter changes (field names only), completed download handoffs, failed/conflicting saves, visibility, sign-out and page exit. Page views include browser/device, screen/viewport resolution and timezone. These are browser-reported events, not evidence a person read the content. The recorder never collects passwords, raw typed values, complete DOM, or authentication tokens. Draft keystrokes, mouse movement and scroll positions are not recorded.

Activity queues flush in batches of up to 50 with unique event IDs, retries and database deduplication. Sign-out drains queued events; hidden/exit events make a best-effort keepalive send. Network failures or abrupt browser termination can lose browser events; delivery failures remain internal and do not appear in the user interface. Queues cap at 2,000 events in memory; the server limits untrusted activity to roughly 6,000 events/minute per inventory. Confirmed database changes do not share that limit. There is no automatic log deletion yet; the project owner must set a retention policy as volume grows. Existing activity cannot be reconstructed retroactively.

Shared public viewers can append browser events only for a currently enabled valid sharing link. The database resolves the inventory owner and stores these separately as browser-reported shared activity, with no anonymous access to audit reads or confirmed-write privileges. Anonymous shared-link activity has no verified identity; the guest upgrade below adds server-observed request IPs. Knowing a public link allows a caller to forge browser reports, so these must never be treated as authoritative record changes.

### Guests and signed-out visitors

Apply `supabase/guest-tracking.sql` after the activity migration, then run `supabase/guest-tracking.verify.sql`. Add **server-only** `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_URL` to Vercel and redeploy. Do not use a `VITE_` prefix for the service-role key. The key stays in `/api/activity` and is never sent to the browser. Vite alone does not run this endpoint.

Signed-out visits, sign-in/sign-up navigation, failed/successful authentication attempts (outcome only), public loading/unavailable pages, public inventory interactions, visibility and exits now use anonymous session IDs and the server collector. Guest reports remain untrusted browser activity with null verified actor ID; signing in switches to authenticated tracking. Guest identity is not inferred from IP, screen size, or browser. Form credentials and typed values remain excluded.

The server derives request IPs from Vercel's overwritten `X-Forwarded-For` header when running on Vercel, or from the direct socket peer otherwise; it ignores client-submitted network metadata. See [Vercel request headers](https://vercel.com/docs/headers/request-headers). Behind another proxy the observed IP may be the proxy. Guest IPs are available for the same admin-only ISP lookup when configured.

Only `service_role` may execute the guest append function. It cannot grant guests audit reads or inventory writes. The collector validates bounded JSON/event kinds, rejects cross-origin browser requests, deduplicates event IDs, and enforces a transactional database limit of 600 guest events/minute per observed IP (missing IPs share one bucket). Endpoint submissions are not proof of human activity. Site-wide guest records have no inventory owner; valid enabled sharing context is resolved to its owner by the database. The global superadmin timeline includes both, labelled Guest. These migrations and privilege checks passed locally; production activation and verification remain required.

### Superadmin statistics

`supabase/admin-stats.sql` adds the admin-only `inventory_admin_stats(days)` reporting function; apply after the audit migrations and verify with `supabase/admin-stats.verify.sql`. It aggregates the full selected period rather than the current 50-row log page. Reporting windows are 7, 30 or 90 calendar days including today, using Asia/Manila and server timestamps. Zero-activity dates and all 24 hourly buckets remain visible.

The private console includes nine Chart.js charts: daily activity/page views (line), popular pages (bar), guest/signed-in sessions (pie), device categories (bar), browsers (pie), record add/edit/delete counts (grouped bar), sign-ins/reported failures (line), registrations (bar), and activity by hour (bar). Every nonempty chart has an expandable data table. Empty periods remain empty without invented data. Browser sessions are not unique people; device/browser categories and failed-attempt telemetry are untrusted reports. Supabase sign-in counts depend on auth audit retention. Confirmed record changes come from database triggers. Admin charts load only inside the admin console, have no entrance animation, follow light/dark appearance changes, and dispose when navigating away.

### Inventory statistics

Overview includes six charts for the current inventory: received versus issued, running balance, balances by sugar type, positive stock mix, issuance by client, and receipts by mill. Movement charts use 7/30/90 local calendar days through today and include opening stock in the balance trend. Missing or invalid dates are counted and excluded from period charts. Sugar-type snapshots include all records, matching the inventory totals; negative balances remain visible in the bar chart and are excluded from the pie. Client/mill charts preserve totals using eight categories plus a remaining-total category. Shared views derive charts only from the inventory already authorized for that link. No additional SQL or admin permission is required.

### Automatic ISP/network persistence

Apply `supabase/network-enrichment.sql` after guest tracking; `network-enrichment.verify.sql` checks persistence and privileges with rollback. Configure production `IPINFO_TOKEN` as a server-only Vercel Secret. Both guest and authenticated browser batches now go through `/api/activity`; the server verifies any bearer token with Supabase and derives the request IP itself. Caller-supplied actor, IP and ISP values are ignored. Network names come from the IPinfo Lite ASN `as_name` field, with ASN/domain/country/continent and lookup time; the token travels only in the provider Authorization header.

The service-only `inventory_ip_networks` table caches each result for 24 hours. Audit inserts attach cached network metadata to guest/request IPs or Supabase session IPs, including confirmed inventory writes when a cache result exists. The private dashboard joins the cache for older events and auth history without rewriting their original records. Its lookup action also persists results. No network data is exposed through public inventories or ordinary account access. Provider failures do not discard activity; a previous cached result remains available. Missing/private/unresolvable IPs can have no network result. Lite identifies the network operator, which may be a VPN, shared gateway or hosting provider; it does not provide city, exact location, subscriber identity or device identity. The migration and permission verification were applied successfully to production.
