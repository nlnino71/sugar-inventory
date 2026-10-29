---
name: Sugar Inventory
description: A clear view of stock, issuance and deliveries.
colors:
  bg: "#f4f6f5"
  surface: "#fff"
  ink: "#192d26"
  muted: "#5e7068"
  line: "#dce4df"
  soft: "#edf2ef"
  cane: "#226b4d"
  cane-ink: "#FFFFFF"
  cane-bg: "#e5f1e9"
  control-line: "#748a7b"
  forest-sidebar: "#163d2e"
  sidebar-text: "#c4d5cb"
  sidebar-active: "#e2eee6"
  sidebar-active-ink: "#17452f"
  tag: "#775000"
  tag-bg: "#FBEBC4"
  alert: "#A52E1B"
  alert-bg: "#F8DAD3"
  stock-ink: "#175D3E"
  focus: "#155B3B"
  info-bg: "#E6EEF8"
  info-ink: "#254F7C"
  dark-bg: "#101a15"
  dark-surface: "#18251e"
  dark-ink: "#e5eee8"
  dark-muted: "#a4b9ac"
  dark-line: "#33483b"
  dark-soft: "#203127"
  dark-cane: "#7ac69b"
  dark-cane-bg: "#223e2d"
  dark-control-line: "#708e7c"
typography:
  headline:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "30px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-.025em"
  body:
    fontFamily: "Barlow, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif"
    fontSize: "15px"
    lineHeight: 1.5
  quantity:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "40px"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "-.035em"
  label:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 500
rounded:
  control: "8px"
  surface: "12px"
  pill: "999px"
spacing:
  compact: "8px"
  field: "12px"
  mobile: "16px"
  panel: "20px"
  roomy: "24px"
  desktop: "40px"
components:
  button-primary:
    backgroundColor: "{colors.cane}"
    textColor: "{colors.cane-ink}"
    rounded: "{rounded.control}"
    padding: "11px 17px"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "11px 17px"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.surface}"
    padding: "20px"
  field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    height: "46px"
---

# Design System: Sugar Inventory

## Overview

A calm operational workspace for inspecting stock, SRO quantities, issuance and deliveries. Forest navigation anchors the desktop while pale neutral surfaces keep records and actions readable. Barlow headings and tabular figures give quantities a clear hierarchy.

This document records the implemented system in `index.html` and the later `workspace.css` overrides. The product serves private account inventories; the visual design does not imply pricing, warehouse organization, staff roles or immutable audit history. Descriptive language here summarizes the implemented direction rather than a separately approved brand metaphor.

**Key Characteristics:**

- Forest desktop navigation with neutral work surfaces.
- Prominent tabular quantities and restrained borders.
- Responsive bottom navigation and a split desktop sign-in.

## Colors

Forest green gives navigation and stock actions their identity; neutral surfaces carry operational content. `workspace.css` overrides the base page palette and display font.

- **Cane** uses `cane` for primary actions and quantities; `cane-bg` supports selected or summary surfaces.
- **Forest sidebar** is a desktop navigation and sign-in identity surface. Its selected item uses `sidebar-active` and `sidebar-active-ink`.
- **Neutrals** use `bg` behind `surface`, `ink` for content, `muted` for supporting text, `line` for separators, and `control-line` for field boundaries.
- **Statuses** retain amber `tag`, red `alert` and blue `info` pairs. Pair meaning with visible text.

Dark mode is selected through `data-theme="dark"`, or the system preference when light is not explicitly selected. The `dark-*` primitives override their matching workspace tokens; the sidebar keeps its forest palette. Base `index.html` dark tokens also change statuses, focus, gauge, stock ink and action text. Preserve those inherited semantic overrides when adding screens.

## Typography

Barlow is both the body and display family after the workspace override. Barlow Condensed remains imported but is no longer the active display stack. Use tabular figures for `.num`, `.big` and overview metrics.

The desktop overview heading is 30px; smaller section headings are 20–23px. Overview metric figures are 40px on desktop, 36px otherwise and 30px below 768px. Body text is 15px with 1.5 line height. Supporting labels are generally 12–13px. The desktop sign-in headline uses `clamp(40px,4.2vw,68px)` and 1.08 line height.

## Layout

At 1024px and above, navigation becomes a fixed 232px forest sidebar. Main content uses a 1440px maximum width and 36px 40px 60px padding. The earlier 1600px sidebar sizing is overridden by the later workspace stylesheet. Overview panels sit in two columns and four metrics share a bordered horizontal surface.

Below 768px, metrics become a two-by-two grid, overview panels stack, and main padding is 24px 16px. Mobile uses four primary bottom destinations with other sections accessible from the menu; desktop shows the full sidebar. Forms gain two columns at 480px and desktop filters can use four. Tables retain horizontal scrolling instead of compressing every column.

Desktop sign-in reserves 48% of the viewport for a forest introduction and centers the form in the remaining space. Below 1024px it becomes a single centered form. Sheets rise from the bottom on smaller screens and attach to the right edge on desktop. Safe-area padding supports mobile devices.

## Elevation & Depth

Borders and tonal surfaces provide most depth. Primary buttons use `0 3px 7px rgb(0 0 0 / .08)`; mobile bottom navigation adds `0 -4px 20px rgb(0 0 0 / .05)`. Modal scrims use `rgba(6,14,10,.55)`. Do not apply button shadows to every content surface.

## Shapes

Cards, registers, metrics and filter panels use 12px corners. Buttons and fields use 8px corners; chips remain pills. Separators are thin and restrained. Gauges are 7px high with 4px rounding, without the older gauge pseudo-element.

## Components

- **Buttons:** primary cane fill and semantic action text; secondary neutral surface and border. Standard buttons have 11px 17px padding and a 44px minimum height. Pressing shifts them down 1px; disabled controls reduce opacity and use a disabled cursor.
- **Fields:** neutral surface, control-line border and 8px corners. Typical fields are 46px high; search is 48px and sign-in fields 50px. Invalid fields use the alert border. Visible keyboard focus uses a 2px focus outline with 2px offset.
- **Cards:** white or dark semantic surfaces, thin borders and generous 20px padding, reduced to 16px on small screens. Stock type cards use 22px padding, reduced to 18px on mobile.
- **Navigation:** forest sidebar with pale active selection and labeled icons. Mobile uses a neutral bottom bar. Keep active-page semantics with `aria-current`.
- **Chips:** compact 11px status labels with 4px 10px padding and pill shape. Filter chips are larger, with 44px minimum height.
- **Metrics:** a connected four-cell surface with the first cell tinted cane, separate labels and prominent tabular figures; two columns on mobile.
- **Sheets and dialogs:** respect viewport height, retain internal scrolling, and distinguish modal state with a scrim. Desktop sheets use a right-hand panel.

State transitions last .18s with `ease` only under `prefers-reduced-motion:no-preference`; the field focus shadow is also in that media query. The base mobile sheet entrance uses .18s `ease-out` only when motion is allowed. Preserve visible outline focus when motion is reduced.

## Do's and Don'ts

### Do:

- Do use tabular figures for quantities and balances.
- Do preserve visible focus and clear labels alongside status colors.
- Do use the existing dark theme tokens and responsive navigation patterns.

### Don't:

- Don’t infer pricing, warehouse roles or audit guarantees from the visual design.
- Don’t replace operational quantities with decorative metrics.
- Don’t introduce unconditional animation; respect reduced motion.

Admin analytics uses the existing workspace surface and 12px radius, with a two-column desktop grid and one column below 768px. Activity, registrations and hourly charts span the desktop grid. Green leads each comparison; blue, amber and muted categorical colors distinguish series, with separate light/dark palettes. Chart counts use zero-based numeric axes and exact-value disclosure tables. These categorical colors apply only to data visualization, not new interface accents. Reporting uses Asia/Manila consistently.

Inventory charts reuse the analytics grid and chart renderer on Overview. Movement and running-balance charts span both columns; type, mix, client and mill comparisons pair below. Keep movement-period labels distinct from all-record stock snapshots. Quantities retain decimal precision and shortages remain visible below zero. Charts follow appearance changes, offer exact-value tables and release observers/canvases on navigation.

Visitor traffic expands the private admin with the reference dashboard's five range controls, search/page filters, four summary values, ranked page/country/OS/browser lists and paginated visitor rows. Preserve the inventory's green palette and native controls. The range buttons wrap, four metrics become two columns on phones, ranking lists stack below 768px, and tables scroll inside named regions. Progress bars visualize each category's share of actual page views. Estimated visitors and country-only locations are labelled explicitly.

## Client HTML reference

Use the supplied Wilmar Sugar Inventory Monitoring HTML as a reference for dashboard widgets and information only. Keep this app’s existing workspace layout, typography, palette, navigation and responsive behavior. Retain sugar-type totals, received/issued/balance values, stock meters, grouped running SRO balances, search and status filters, alongside all additional app features. Do not copy the HTML’s branding, condensed font, narrow stacked layout or bottom navigation.

Wilmar personalization uses the client-supplied wordmark, the full company name “WILMAR EDIBLE OIL PHILIPPINES INC.” and product name “Sugar Inventory Monitoring” on sign-in and workspace navigation. Preserve the existing workspace styling; use the client-supplied public/wilmar-white.png without color filters directly on the forest sidebar and desktop sign-in panel. Mobile sign-in also uses the supplied transparent white logo; render it dark in light appearance and white in dark appearance.

## Current client-content alignment

The inventory workspace now follows the six client sections: Dashboard, Stock, SRO Registry, Withdrawal, Clients and More. Keep the existing fonts, forest sidebar, palettes, spacing, buttons, form sheets and mobile menu. Dashboard shows only the sugar-type pie (with quantities and percentages), combined vertical SRO Quantity/Withdrawal/Balance bars, and the explicitly requested vertical withdrawals per client. All three use all saved company records. Stock retains type totals, grouped balances, search and status chips. Clients shows withdrawal totals and delivery detail without contact management. More offers the quantity-unit label, existing public sharing, exports, JSON backup/restore, CSV import, sample data and delete-all. Automatic database snapshots continue in the background. Private superadmin remains a role-protected administrative URL outside the client menu.

The combined sugar-type bar graph follows the client's screenshot: grouped company-accent receipts, amber withdrawals and slate balances, rounded bar tops, bold category labels, five abbreviated quantity ticks, and vertical exact quantities above each bar. Light appearance uses darker versions of the same colors. The graph reserves label space, preserves negative balances, and scrolls within the panel when categories exceed the available width. Other charts retain their existing palette.

The sugar-type pie includes a matching HTML legend with teal Raw Sugar, amber Refined Sugar and blue Washed Sugar swatches, plus stable categorical colors for additional sugar types. Each row shows its quantity and percentage. Hovering a slice highlights its text row; hovering, focusing or tapping a row highlights its slice and tooltip. Highlighted labels gain readable color, weight and underline, while quantities and percentages become bold. The legend remains usable on narrow screens and in light/dark appearances.

## Company themes and selection

Selecting Wilmar Sugar applies blue workspace surfaces and accents; selecting Wilmar Edible Oil applies teal. Theme tokens cover the sidebar, navigation selection, controls, stock quantities, gauges, focus, surfaces, primary chart series and exported Excel headers in light/dark/device appearances. Sugar-type pie colors retain their categorical meaning. The company trigger sits beneath the sidebar logo and above Sugar Inventory Monitoring, opening two company buttons with SRO/withdrawal counts and a Current badge. The selected button uses that company's blue/teal fill. Mobile keeps the same chooser accessible at the top of the page.

Clients opens with a company-accent summary banner: “Issued to N clients” above a large, bold Barlow Condensed total. Quantity text scales down on phones, uses tabular numerals, and retains exact displayed precision. Banner foreground follows the company theme's action-text color for light/dark contrast; the rest of the workspace keeps Barlow.

Backup and import uses the existing company-colored pill buttons for Selected company / Both companies JSON scope. Supporting text names the target and explains that CSV import always uses the company named on its button. File actions wrap long company names on small screens. Restores explicitly confirm their affected company names and quantities.

The company chooser is now a compact popover anchored 8px below its trigger, rather than a right-side sheet. Company names are uppercase in both trigger and choices. It leaves the workspace visible, closes on outside click/Escape/resize and repositions during page scrolling, supports arrow/Home/End navigation, and returns focus after selection or keyboard dismissal. On narrow screens its width stays within the viewport.
