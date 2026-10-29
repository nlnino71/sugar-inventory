# Sugar Inventory

## Current client-facing scope

As requested on 29 October 2026, the inventory UI follows the supplied client HTML’s six sections: **Dashboard, Stock, SRO Registry, Withdrawal, Clients, More**. Existing workspace styling and Sugar/Edible Oil separation are retained. Dashboard contains only the sugar-type pie, combined vertical quantities/withdrawals/balance chart, and the separately requested vertical withdrawal chart for every client, all using all saved records. Reports, Spreadsheet, contact-directory editing, unit conversion controls, custom alert controls, movement trends, aging/sailing panels, and visible activity history are removed from the client workspace. Old Reports/Spreadsheet URLs redirect to Dashboard.

More retains quantity-unit labeling (without conversion), exports with full company filenames, file backup/restore, CSV import, and the previously requested public sharing for both companies. Client details show withdrawal totals and delivery history. Sign-in, private cloud storage, revision checks, automatic account snapshots, data auditing and the role-protected `/superadmin` administration URL continue. No saved inventory, contacts, history or company data is deleted by this UI update. Automatic snapshot creation remains active, while its extra account-backup management screen is no longer shown.

The historical implementation notes below describe earlier features and are superseded by this scope where they differ.

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

Overview includes six charts for the current inventory: received versus issued, running balance, balances by sugar type, positive stock mix, issuance by client, and receipts by mill. Movement charts use 7/30/90 local calendar days through today and include opening stock in the balance trend. Missing or invalid dates are counted and excluded from period charts. Sugar-type snapshots include all records, matching the inventory totals; negative balances remain visible in the bar chart and are excluded from the pie. The client withdrawal chart shows every client; the mill chart preserves totals using eight categories plus a remaining-total category. Shared views derive charts only from the inventory already authorized for that link. No additional SQL or admin permission is required.

### Automatic ISP/network persistence

Apply `supabase/network-enrichment.sql` after guest tracking; `network-enrichment.verify.sql` checks persistence and privileges with rollback. Configure production `IPINFO_TOKEN` as a server-only Vercel Secret. Both guest and authenticated browser batches now go through `/api/activity`; the server verifies any bearer token with Supabase and derives the request IP itself. Caller-supplied actor, IP and ISP values are ignored. Network names come from the IPinfo Lite ASN `as_name` field, with ASN/domain/country/continent and lookup time; the token travels only in the provider Authorization header.

The service-only `inventory_ip_networks` table caches each result for 24 hours. Audit inserts attach cached network metadata to guest/request IPs or Supabase session IPs, including confirmed inventory writes when a cache result exists. The private dashboard joins the cache for older events and auth history without rewriting their original records. Its lookup action also persists results. No network data is exposed through public inventories or ordinary account access. Provider failures do not discard activity; a previous cached result remains available. Missing/private/unresolvable IPs can have no network result. Lite identifies the network operator, which may be a VPN, shared gateway or hosting provider; it does not provide city, exact location, subscriber identity or device identity. The migration and permission verification were applied successfully to production.

### Authentication history availability

Supabase Authentication → Audit Logs → **Write audit logs to the database** must be enabled for provider history and sign-in charts. It was off and was enabled on 20 October 2026; missing older provider events cannot be reconstructed from the inventory audit. Apply `supabase/auth-history.sql` after network enrichment and verify with `auth-history.verify.sql`. The admin dashboard shows an explicit empty state for provider history and a separate list of stored Supabase sessions (creation, account, IP/network and browser only). Stored sessions are not a full sign-in history or proof that a session remains active; tokens and authentication secrets are never selected.

Navigation remembers the selected page in per-account browser `sessionStorage`, so refreshing the same tab restores it. Shared views restore only public-safe pages. Superadmin restoration always waits for the database role check; the stored page name never grants access. If browser storage is unavailable, navigation falls back to Overview.

### Inventory unit conversion

More → Convert inventory units supports LKg bags (50 kg), kilograms and metric tonnes (1,000 kg). It previews the conversion and changes every receipt and issuance quantity together through the existing revision-checked save. A failed save restores the confirmed inventory. Custom/ambiguous labels require an explicit kilograms-per-current-unit value; no bag weight is inferred from a plain “bags” label. New entries use the selected inventory unit. Conversion changes the stored quantities, so all stock, client totals, reports, shared views, backups and exports stay consistent. Quantity displays and spreadsheets retain up to additional fractional digits instead of rounding the stored quantities to two decimals.

Operational CSV exports include a Unit column. CSV imports with recognized units convert each row to the current inventory unit; unknown mismatches are rejected before import. A CSV without that column is interpreted in the current inventory unit, as indicated beside the import action. LKg definition: https://elibrary.judiciary.gov.ph/thebookshelf/showdocs/10/74970.

### Visitor and page traffic analytics

The private superadmin now includes visitor traffic inspired by the visitor dashboard in `jcnino-md`, adapted to the inventory app's data and appearance. Apply `supabase/visitor-traffic.sql` after network enrichment and run `visitor-traffic.verify.sql` (its synthetic records roll back). Both were applied and verified in production. The report offers Today, rolling 24 hours, 7/30 calendar days including today in Asia/Manila, and All time; page/shared-link and literal text search filters apply to every summary, ranking, breakdown and log row. Search covers IP, account, country, ISP/ASN, device, OS and browser. Summary counts use the entire matching period; the log paginates 50 rows at a time, page breakdown ranks up to 100 pages, and selectors list up to 1,000 recorded pages.

Visitors are estimates: signed-in accounts and guest browser sessions are counted separately; they do not identify unique people. Mobile share counts phone-classified views divided by all matching page views. Country comes from saved IPinfo Lite data (VPN/shared network caveats apply); unavailable data remains Unknown, with no invented city. Page paths are captured without query strings or URL hashes, so sharing tokens are excluded. Shared-link path breakdowns start with this update; older records without paths remain grouped by their recorded app section. The existing security statistics, authentication history and full audit timeline remain available below the visitor report. Only the existing database-verified superadmin role can execute the report.

### Multiple devices per account

Supabase's production **Enforce single session per user** setting is off, so one account can have multiple independent browser/device sessions. App sign-out explicitly uses `scope: 'local'`, ending only the current session rather than revoking other devices' refresh tokens. Tabs in the same browser profile share that browser's session. Inventory revision checks still prevent concurrent saves from silently overwriting another device's changes.

## Private account backups

Apply `supabase/account-backups.sql` after the account-inventories upgrade, then run `supabase/account-backups.verify.sql` as the project owner. Verification requires two existing account inventories and rolls every test change back. The migration and rollback verification were applied successfully to production on 25 October 2026. The migration seeds one initial snapshot per account and installs a database trigger that captures future inventory changes in the same transaction as the save, including imports, file restores, clearing data, spreadsheet edits and unit conversions. New account inventories receive an initial snapshot automatically. The migration can be run again without duplicating initial/automatic snapshots.

**More → Account backups** lists dated snapshots, revision numbers, units and record counts, 10 per page. **Create backup** snapshots the current server inventory; **Download** produces the full JSON backup, compatible with the existing file restore. **Restore** checks the current revision, saves a separate **Before restore** snapshot, and restores the selected inventory atomically. A stale restore reloads the latest inventory and asks the user to review it. The current activity history gains a restore entry. Inventory snapshots do not include passwords, sessions, public sharing configuration, or other accounts.

Backups are kept as separate immutable JSON snapshots in `inventory_account_backups`, not inside the live inventory document and not in public file storage. Owner-only row-level security governs list and download reads. Authenticated clients cannot insert, modify or delete snapshots directly; create/restore functions derive the owner from the authenticated session. Guests have no backup access, and public inventory responses continue to expose only their existing selected fields. Snapshots are retained without automatic pruning and are removed when their owning authentication account is deleted. Older versions from before activation cannot be reconstructed.

JSON backup file restores use `restore_inventory_json` from `supabase/json-restore-audit.sql` (apply after activity-tracking.sql). The RPC retains owner-only saving and revision checks and marks only its transaction as a JSON restore. The audit trigger emits one `inventory.restored_json` event with previous/restored SRO and issuance counts instead of per-record events or an extra inventory.saved event. Manual record edits retain their normal audit details. `json-restore-audit.verify.sql` exercises bulk replacement, conflicts and normal auditing in a rolled-back transaction. The migration and verification were applied successfully to production on 28 October 2026. Existing historical log entries are retained.

## Company inventories (client HTML update)

The Company selector separates Wilmar Sugar Philippines Inc. and Wilmar Edible Oil Philippines Inc. across stock, charts, registry, withdrawals, clients, reports, spreadsheets, settings and exports. Legacy inventory remains Edible Oil, matching the client HTML's original storage key. Sugar starts empty. Selection is remembered per account on each browser; the selected page stays open when switching. Units, thresholds and client contacts are independent. Saves retain both companies in the account's existing revision-checked JSON document; automatic account snapshots capture both, and account-backup restoration restores both together. No database migration is needed.

After applying company-public-sharing.sql, the existing public link exposes filtered records for both companies with a Company selector. Each company's Excel workbook is available from More with the correct company heading and filename. CSV and downloaded JSON backups apply to the selected company. Company JSON files include their company ID to prevent restoring into the other company; full account snapshot files restore both companies after an explicit confirmation. Account backup summary counts currently describe Edible Oil, while snapshot contents include both companies.

In SRO Quantity, select a sugar type to reveal bulk deletion. Crop year and search filters determine the exact rows. The confirmation lists the company and associated withdrawal count. Following the client file, deleting the last receipt for an SRO also removes its withdrawal lines; withdrawals remain when another receipt for the same SRO survives. The operation uses one revision-checked save and is covered by automatic account backups.

## Latest client reference: withdrawal chart and vehicle reference

The dashboard's **Withdrawal by client** graph uses vertical bars for every client in the selected 7/30/90-day chart period and the selected company. It totals withdrawal batch lines per client, labels the quantity axis with the inventory unit, and provides exact values in its expandable table. Wider client lists scroll within the chart instead of combining smaller clients into Other. The combined sugar quantity/withdrawal/balance graph already uses vertical bars.

Withdrawals now include optional **Van # / Truck plate #**, as supplied in the latest HTML. This reference is saved and editable with the withdrawal, visible on delivery cards, searchable, and included in the spreadsheet editor, CSV import/export and Excel Issuance sheet. CSV import accepts Van # / Truck Plate #, Van #, Truck Plate # or Van/Truck Plate #. Older records without this field remain valid. The public database projection continues to omit vehicle references for both companies.

## Public sharing for both companies

`supabase/company-public-sharing.sql` updates the existing token/slug sharing flow to project Edible Oil and Sugar separately. It was applied and verified in production on 29 October 2026 using `company-public-sharing.verify.sql`. Verification rolls back its checks without editing inventory records or sharing settings. The internal projection helper is not executable by anonymous or authenticated clients. Both companies expose only the existing operational allowlist; client contacts/profiles, notes, history and vehicle references remain excluded.

More shows the same account-level sharing controls for either company. Enable/disable, link replacement and code changes apply to both. Existing enabled links now allow visitors to switch between both company inventories. Copying the link while Sugar is selected adds `?company=sugar`; existing Edible Oil URLs stay valid. Public navigation and reload preserve the selected company; exports use its records, unit and heading. Public visitors still cannot save, restore, import, or access Spreadsheet/account backups.

The private Spreadsheet page retains the Company selector and protects an unsaved draft before switching.

## Company themes and chooser

Company selection now opens two company buttons with record counts. The desktop trigger is below the Wilmar logo and above Sugar Inventory Monitoring; mobile uses a top-of-page trigger. Sugar uses blue accents and Edible Oil uses teal across workspace light/dark themes, navigation, stock, primary chart series and Excel headers. Pie category colors remain stable. Switching preserves company data separation, the current page and the existing private/public selection persistence.

## Selected-company or both-company backups

More → Backup and import has **Selected company** (default) and **Both companies** controls for JSON backup/restore. Company backups include a company label and only that company's inventory. Combined backups contain Edible Oil and Sugar, including independent units and an explicitly empty Sugar inventory for accounts that only use Oil. Filenames identify the company or both-company scope.

Selected-company restore can extract only that company from a combined JSON backup and preserves the other company's current records. Both-company restore requires a combined file; it refuses company-only files rather than clearing the other company. Labelled company files cannot be restored into the other company. Unlabelled legacy files remain usable in selected-company mode after confirmation. Restore confirmation names the affected company/companies and record counts. Both-company restores use one existing revision-checked JSON restore operation. Backup transport metadata is removed before saving inventory.

CSV imports add rows to the company named on the button, regardless of JSON backup scope. Switch company to import its CSV; use combined JSON restore for both inventories together. An optional Company column must match the selected company ID or full name; other or unknown company labels are rejected before import. A pending file operation is cancelled if the signed-in account or selected company changes while the file is being read. No new SQL migration is required; automatic account snapshots continue to capture both companies.

### Company-aware Superadmin

The Superadmin entry appears at the bottom of More for existing database-authorized administrators. Apply `supabase/admin-company-counts.sql` after the company inventory upgrade to show separate Sugar and Edible Oil SRO and withdrawal counts in Accounts. The function checks the existing administrator role, returns only requested account IDs, and is unavailable to anonymous users. It does not grant roles or modify inventory. The migration and `supabase/admin-company-counts.verify.sql` were applied and verified on the production Supabase project on 2026-10-29.
