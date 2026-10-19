# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Product Purpose

Sugar Inventory records SRO quantities and issuance batch lines and computes stock balances. The user requested expansion across stock monitoring, delivery tracking, and client reports (confirmed: all three).

## Operating Context

The app is deployed on Vercel with Supabase email/password authentication. Approved inventory members share a single inventory. Existing receipts, issues, JSON backup compatibility and quantity units must be preserved.

## Capabilities and Constraints

Vite and plain JavaScript frontend. Supabase stores the inventory as a JSONB document with revision checks. Feature additions must work with existing records and the current database schema. No pricing, monetary valuation, warehouse locations, or staff roles have been supplied.

## Open Decisions

Specific staff roles and warehouse organization have not been established. Activity history in the shared document is operational history, not an immutable compliance audit.
