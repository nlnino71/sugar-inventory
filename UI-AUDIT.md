# Sugar Inventory — Impeccable technical audit

Date: 19 October 2026 (Asia/Manila). Reviewed commit `83ddacd`.

## Implementation integrity verdict

**Pass, with accessibility and scalability weaknesses.** The interface is product-specific: SRO quantities, sugar types, batch issuances, crop years, sailing dates and client movement reports share the existing green/Barlow visual system. Desktop navigation, mobile navigation and public-view permissions are coherent. The bundled detector returned `[]`; its lack of findings does not certify accessibility. Manual inspection and rendered scans found the issues below.

No application code, production records, database policies or deployments were changed during this audit.

## Audit health score

| Dimension | Score | Key finding |
|---|---:|---|
| Accessibility | 2/4 | Dialog focus/names, pointer-only ledger actions and contrast |
| Performance | 2/4 | Eager spreadsheet script and repeated linear lookups as data grows |
| Responsive design | 2/4 | 320px date-filter overflow and undersized touch controls |
| Theming | 3/4 | Consistent tokens and dark mode, but status colors fail text contrast |
| Implementation integrity | 3/4 | Coherent product system; interaction semantics need hardening |
| **Total** | **12/20** | **Acceptable — significant work needed** |

These rubric scores are qualitative assessments supported by the measured findings, not a WCAG conformance certification or a Lighthouse score.

## Executive summary

**8 issues: 0 P0, 4 P1, 4 P2, 0 P3.** Prioritize dialog accessibility, keyboard access to ledger actions, badge contrast and narrow-screen report usability. The regular workflows are functional, but existing passing workflow tests do not exercise these accessibility requirements.

## Scope and evidence

- Read current source, theme tokens, responsive CSS, calculation helpers and built assets.
- Ran axe-core 4.10.3 in local Google Chrome against login, Overview, Stock, issuance form, Reports and Clients at 1440×1000 light, 390×844 light/dark, and 320×800 light. Settings and a confirmation dialog were additionally checked at desktop size.
- Used mocked Supabase responses and illustrative inventory, without creating accounts or modifying live data.
- Captured stock/form screenshots and raw scans in `.impeccable/review/audit/`. The settled-animation scan is `results.json`; the initial scan is `results-initial.json`.
- Verified code paths and keyboard behavior in addition to automated rules. Mobile screenshots are viewport simulations, not tests on physical phones. Screen-reader interaction, real network Core Web Vitals and all possible data combinations remain outside scope.
- Verified that Chrome automatically makes the overflowing report container keyboard-focusable: Tab moved from Export report CSV into `.table-scroll`, despite `tabIndex=-1`. The axe `scrollable-region-focusable` result was therefore a false positive in this tested browser and is excluded from the issue count. Explicit region naming and cross-browser testing would still be useful.
- Discarded initial form-label contrast warnings caused by scanning the mobile sheet during its opacity animation. They disappeared after waiting for animation completion. Stock badge contrast failures persisted.

## P1 — Major

### 1. Dialogs lack accessible names and focus management

**Locations:** `index.html:334`, `index.html:335`, `app.js:285`, `app.js:286`, `app.js:288`, `app.js:297`.

**Category:** Accessibility. Axe reports `aria-dialog-name` for both `#sheet` and `#dlg`. Opening New issuance leaves focus on the underlying New issuance button, outside the dialog, in all four audited configurations. `openSheet()` does not move focus or make the background inert; neither sheet nor confirmation dialog traps focus or restores the trigger on close. `aria-modal="true"` alone does not implement modal behavior.

**Impact:** Keyboard and screen-reader users can lose context and interact with obscured background controls while the app claims a modal is active.

**Standards:** WCAG 2.1.1 Keyboard, 2.4.3 Focus Order and 4.1.2 Name, Role, Value; modal-dialog interaction conventions.

**Recommendation:** Give each dialog an `aria-labelledby` linked to its heading; focus an appropriate element on open, contain focus while open, make the underlying content inert and restore the original trigger when closing. Handle nested confirmation dialogs explicitly.

**Suggested command:** `$impeccable harden`.

### 2. Ledger-row edit actions are not keyboard-operable

**Locations:** `app.js:303`, `app.js:304`, `app.js:407`, `app.js:998`.

**Category:** Accessibility. SRO and client ledger rows use `<tr data-act="editReceipt">` / `<tr data-act="editIssue">` with delegated click handlers. They contain no edit button/link, have no tab stop and implement no Enter/Space activation.

**Impact:** A pointer user can open a record from its ledger row; a keyboard user cannot activate that same action there.

**Standard:** WCAG 2.1.1 Keyboard.

**Recommendation:** Keep semantic table rows and place clearly named edit buttons or links in cells. Avoid making an entire row impersonate a button.

**Suggested command:** `$impeccable harden`.

### 3. Status badges fail text contrast in both themes

**Locations:** `index.html:40`, `index.html:51`, `index.html:57`, `index.html:127`, `index.html:128`.

**Category:** Accessibility / Theming.

| Badge | Theme | Foreground / background | Measured ratio | Required |
|---|---|---|---:|---:|
| Low | Light | `#B77A00` / `#FBEBC4` | 3.06:1 | 4.5:1 |
| In stock | Dark | `#3DAA78` / `#183A2B` | 4.30:1 | 4.5:1 |

Both use 12px normal-weight text. Measurements persisted after animations completed.

**Impact:** Inventory status text becomes difficult to read for people with low vision and under poor viewing conditions.

**Standard:** WCAG 1.4.3 Contrast (Minimum).

**Recommendation:** Separate badge text tokens from gauge/accent colors; adjust text/background pairs to at least 4.5:1 in each theme without changing the established identity.

**Suggested command:** `$impeccable colorize`.

### 4. Date filters cause page-level overflow at 320px

**Locations:** `index.html:171`, `index.html:254`, `app.js:940`, `app.js:966`.

**Category:** Responsive design / Accessibility. At 320 CSS pixels, the two date-field tracks retain roughly 160px minimum widths plus their 20px gap, producing a 340px filter area inside a 288px content region. Controls extend to approximately x=356. Both Issuance and Reports exhibit document-level horizontal overflow. The report table itself is allowed to scroll horizontally; the date controls causing the whole page to overflow are the defect.

**Impact:** Users on narrow phones or desktop zoom/reflow scenarios must pan to reach form controls; overlay/background alignment becomes confusing.

**Standard:** WCAG 1.4.10 Reflow, excluding the legitimate two-dimensional table exception.

**Recommendation:** Collapse date filters to one column when necessary; use `minmax(0,1fr)` and explicit minimum sizing rules for native date inputs. Keep horizontal scrolling confined to the table region.

**Suggested command:** `$impeccable adapt`.

## P2 — Minor

### 5. Several touch controls fall below the 44px ergonomic target

**Locations:** `index.html:169`, `index.html:178`, filter-chip CSS, `app.js:367`.

**Category:** Responsive design. Measured filter chips are 34px high; the close button is 40×40px; remove-batch controls are 40px wide; Add batch code is 40px high. Some issuance line buttons measure about 43px high.

**Impact:** Small or crowded controls are harder to tap accurately, especially while working on a phone.

**Standard:** 44×44px is the WCAG 2.5.5 enhanced/AAA target and the skill's ergonomic guideline. These measurements alone do **not** establish a failure of WCAG 2.2's smaller 24px AA minimum.

**Recommendation:** Increase target boxes or padding to 44px, retaining compact-looking icons where desired.

**Suggested command:** `$impeccable adapt`.

### 6. Spreadsheet export loads eagerly on every page

**Location:** `index.html:339`.

**Category:** Performance. The third-party `xlsx-js-style` bundle is loaded through a classic script without `async`/`defer`, before the app module. Login and public viewers download it although they do not use spreadsheet export. The local built app module is approximately 286KiB before gzip, in addition to the separate CDN script.

**Impact:** Initial interaction depends on an unnecessary third-party download; a slow CDN can delay startup. No real-network loading time or Core Web Vitals claim is made here.

**Recommendation:** Lazy-load the spreadsheet code only when an approved user requests Excel export; keep the public viewer and authentication entry independent of it. Measure transfer size and loading behavior afterward.

**Suggested command:** `$impeccable optimize`.

### 7. Report and client calculations become expensive with larger inventories

**Locations:** `features.js:12`, `features.js:38`, `app.js:125`, `app.js:935`.

**Category:** Performance. Reports call `receipts.find()` for each issuance; the client directory filters all issuance lines per client. Searches replace the main content and recompute the directory on each keystroke.

**Evidence:** A synthetic local Node run with 5,000 SROs, 50,000 issuance lines and 1,000 clients measured approximately **1,060ms** for `stockReport()` and **677ms** for `clientDirectory()`, before DOM rendering. This is a stress fixture, not a measurement of the user's current inventory or a phone benchmark.

**Impact:** As records accumulate, reports and client search can block the main thread and feel unresponsive.

**Recommendation:** Index receipts by SRO, aggregate clients in one pass, reuse derived results until inventory changes and paginate/virtualize larger registers. Avoid rebuilding the whole view on each search character.

**Suggested command:** `$impeccable optimize`.

### 8. Authentication content has no main landmark

**Locations:** `index.html:324`, `index.html:331`, `app.js:60`.

**Category:** Accessibility / Implementation integrity. On the signed-out screen, the account section sits outside `<main>`, while `#main` is hidden. Axe reports `landmark-one-main` and `region` on the account heading and inputs.

**Impact:** Screen-reader landmark navigation cannot jump directly to the active login/signup task.

**Standard:** Landmark/navigation best practice; related to WCAG 1.3.1 and 2.4.1. The automated best-practice result alone is not presented as a standalone WCAG AA conformance failure.

**Recommendation:** Place authentication inside the active main landmark or switch which container supplies that landmark for each app state; ensure only one main landmark is active.

**Suggested command:** `$impeccable harden`.

## Patterns and systemic issues

- Modal semantics were added without a shared focus lifecycle. Ledger actions similarly rely on pointer delegation rather than native interactive controls.
- Theme accent tokens are reused for small text without checking the actual background pair.
- Responsive coverage at 390px and above missed native-input minimum sizing at the 320px reflow boundary.
- Whole-document calculations and view replacement are adequate for small data sets but scale poorly.

## Positive findings

- Recognizable green semantic palette and Barlow typography remain consistent across the workspace.
- Desktop sidebar and mobile bottom navigation preserve the same primary workflows.
- Most form fields have visible labels; login and signup use appropriate email/password autocomplete behavior.
- Focus-visible styling, `aria-current` navigation, status/toast live regions and pressed filter states are implemented.
- Sheet motion respects `prefers-reduced-motion`; the dark theme is mostly token-driven.
- The audited ordinary layouts at 390px and 1440px avoid page-level horizontal overflow.
- Public sharing strips private profile/history fields at the database boundary and prevents viewer writes; this audit did not modify those protections.

## Recommended actions

1. **P1 — `$impeccable harden`:** Implement dialog naming/focus and accessible ledger edit controls; include the login landmark in the same pass.
2. **P1 — `$impeccable colorize`:** Correct the two verified stock-status contrast failures using theme-specific text tokens.
3. **P1/P2 — `$impeccable adapt`:** Repair date-filter reflow at 320px and improve touch target dimensions.
4. **P2 — `$impeccable optimize`:** Lazy-load spreadsheet export and replace repeated record scans with indexed/aggregated data.
5. **Final — `$impeccable polish`:** Check the corrected states visually and with keyboard interaction once the functional fixes are complete.

You can ask me to run these one at a time, all at once, or in any order you prefer. Re-run `$impeccable audit` after fixes to see your score improve.

## Subsequent hardening pass — 19 October 2026

The original findings and score above describe commit `83ddacd` and remain a historical baseline. A later hardening pass addresses dialog names/focus, ledger keyboard controls and the authentication landmark. It also adds explicit named scrolling regions, announced validation, finite quantity checks, inert imported identifiers/dates, reserved-key-safe aggregation and a non-blocking optional spreadsheet script. Contrast, 320px reflow, touch ergonomics, lazy-loading and large-data aggregation work remain separate follow-ups. This is not a new full-audit score.

Verification for the hardening pass: 16 unit tests passed; the desktop/mobile workflow run passed 22 checks, followed by 10 targeted hardening checks covering the additional unusual-record cases. Settled rendered scans of desktop light and phone dark views report no dialog-name or login-landmark violations. The stock-badge contrast findings remain. Public viewers continue to have no edit controls or write access.

## Subsequent colorize pass — 19 October 2026

The baseline stock-badge contrast findings are addressed: light Low text is approximately 6.07:1 (previously 3.06:1), and dark In stock text is approximately 7.26:1 (previously 4.30:1). Dedicated status text, warning-fill, information, form-outline and focus tokens preserve the green identity while separating semantic roles. Error text has also been strengthened. Light, dark and automatic-theme browser checks verify all four stock badge text pairs at 4.5:1 or better and form/focus boundaries at 3:1 or better. A simulated deuteranopia inspection retains explicit status labels. This targeted verification is not a replacement full-audit score; responsive and large-data work remain outstanding.

## Subsequent adapt pass — 19 October 2026

The baseline 320px date-filter overflow and undersized audited touch targets are addressed. Filters and paired fields stack on narrow screens; native inputs have bounded minimum sizing; record labels wrap; batch/close/chip controls and interactive rows meet 44px target dimensions. Reports retain their intentional horizontal scroll region, with keyboard ArrowRight scrolling verified independently of page scrolling. Seven Chrome viewport scenarios cover narrow phone, standard phone, tablet, landscape, desktop, 4K and 200%-zoom-equivalent reflow using long mixed-character references. Public reports retain view-only controls. This targeted pass does not replace a full audit or physical-device testing. The large-data performance work remains outstanding.
