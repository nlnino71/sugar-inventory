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

The sign-in screen includes **Create an account**. Anyone can register an email/password account, confirm the email from Supabase, and sign in. Registration does not add users to `inventory_members`; a project administrator grants inventory access with the membership insert in `supabase/setup.sql`. New users see a pending-approval message until granted access. Public sharing still works without an account.

Supabase must have email signup enabled and Site URL / allowed redirect URLs set to `https://sugar-inventory.vercel.app/`. The live project had signup enabled and confirmation required when this feature was implemented. Email sending limits and delivery are controlled by Supabase's mail configuration.

## Readable public URLs

Run `supabase/public-slugs.sql` after public-sharing.sql to enable `/view/public`. While signed in, change **More → Public view-only sharing → Public link slug**, then choose **Save slug**. Slugs use 3–64 lowercase letters, numbers and single hyphens. Changing the slug invalidates its previous path; the old token URL remains valid until replaced. **Replace link** rotates both the token and slug. **Disable public sharing** blocks both formats. Readable slugs are public, discoverable addresses and preserve the existing public projection and read-only database permissions.

Vercel rewrites `/view/:slug` to the app so shared links work on direct navigation and refresh.

## Messenger and Viber link previews

Public `/view/:slug` requests serve the app through `api/public-view.js`, which includes the exact canonical URL, Open Graph title/description, PNG image metadata and Twitter large-image tags in the initial HTML. No crawler JavaScript or account login is needed. Vercel includes the built `dist/index.html` in the function bundle. The 1200×630 preview at `/share-preview-v1.png` contains generic branding, not live inventory records or private client details.

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
