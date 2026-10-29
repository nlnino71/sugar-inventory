# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Product Purpose

Sugar Inventory records SRO quantities and issuance batch lines and computes stock balances. The user now requests the client HTML’s six sections only: Dashboard, Stock, SRO Registry, Withdrawal, Clients, and More. Preserve the existing workspace styling and separate Sugar/Edible Oil inventories. Dashboard contains the sugar-type pie, combined vertical sugar quantities, and the separately requested vertical client withdrawal chart. Extra operational analytics, Reports, Spreadsheet, contact-directory editing, and unit conversion controls are removed from the inventory UI. Authentication, cloud persistence, file backups and the previously requested two-company public sharing remain.

## Operating Context

The app is deployed on Vercel with Supabase email/password authentication. Each registered account owns a private inventory, enforced by owner-only database row policies. New accounts start empty with public sharing disabled; the original owner keeps the existing records and /view/public link. Existing receipts, issues, JSON backup compatibility and quantity units must be preserved.

## Capabilities and Constraints

Vite and plain JavaScript frontend. Supabase stores the inventory as a JSONB document with revision checks. Feature additions must work with existing records and the current database schema. No pricing, monetary valuation, warehouse locations, or staff roles have been supplied.

## Open Decisions

Specific staff roles and warehouse organization have not been established. Activity history in each account’s document is operational history, not an immutable compliance audit.
