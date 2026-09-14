# PostgreSQL / Neon → Supabase cutover

The current application contract is `DATABASE_URL`; there is no Vercel-owned database dependency in application code. The existing production database is documented as PostgreSQL/Neon. Supabase is therefore a PostgreSQL-to-PostgreSQL cutover.

## Principle

Do not move the old research/scraping database wholesale. Create the target schema from the lean Prisma schema and copy only commerce data.

Tables copied:

- Product
- Review
- Category
- Order
- Payment
- PaymentAttempt
- Refund
- Invoice
- CreditNote
- TrackingEvent
- WebhookEvent
- NewsletterSubscriber
- ContactMessage
- ProductOffer
- ProductOfferAudit

Historical `Research*` tables are deliberately excluded.

## Before cutover

1. Create a new Supabase project dedicated to eCasa.
2. Obtain the direct/session PostgreSQL connection string from Supabase.
3. Confirm the source database size and that the target plan has comfortable headroom.
4. Keep the current production Vercel pointed at the existing database.
5. Configure and test the new Vercel project initially against the existing database.
6. Run the lean branch build and commerce tests.

## Migration dry run

Install PostgreSQL client tools (`pg_dump`, `psql`) on the operator machine/runner, then set:

```bash
export SOURCE_DATABASE_URL='postgresql://...old...'
export TARGET_DATABASE_URL='postgresql://...supabase...'
```

Run:

```bash
bash scripts/db/migrate-commerce-to-supabase.sh
```

The script is intentionally defensive: it creates the target schema with Prisma, refuses to import into a target already containing commerce rows, exports only the business tables above, imports them, and compares row counts table-by-table.

## Final cutover

For the final production migration, temporarily stop new writes (checkout/admin/import mutations), rerun the migration against a clean target, verify counts, then update `DATABASE_URL` in the new Vercel project. Do not change the old Vercel project/database at the same instant; keep them available for rollback.

Validate after switching:

- catalogue totals and representative product pages
- active offers/funnels
- cart repricing and checkout creation
- order readback
- XPayments PaymentIntent flow
- webhook idempotency / WebhookEvent records
- invoices/refunds if applicable
- tracking lookup/events
- contact/newsletter writes
- transactional email

Only move `e-com.casa` / `www.e-com.casa` to the new Vercel project after the new deployment passes these checks.

## Connection strategy

At runtime use the Supabase PostgreSQL connection appropriate for serverless/pooled traffic as `DATABASE_URL`. Keep a direct/session connection separately as `DIRECT_URL` for controlled migration or maintenance tooling. The application currently reads only `DATABASE_URL`, so the provider can be changed without modifying storefront/payment code.

## Future Admin

The Admin/CRM should operate over the same normalized PostgreSQL tables. New admin-specific tables (users/roles, customer notes/tags, audit events, campaigns, shipments, attribution) should be introduced through explicit Prisma migrations rather than ad-hoc SQL or generated supplier schemas.
