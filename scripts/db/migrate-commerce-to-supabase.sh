#!/usr/bin/env bash
set -euo pipefail

: "${SOURCE_DATABASE_URL:?Set SOURCE_DATABASE_URL to the current production PostgreSQL/Neon direct URL}"
: "${TARGET_DATABASE_URL:?Set TARGET_DATABASE_URL to the new Supabase PostgreSQL direct/session URL}"

if [[ "$SOURCE_DATABASE_URL" == "$TARGET_DATABASE_URL" ]]; then
  echo "SOURCE_DATABASE_URL and TARGET_DATABASE_URL must be different." >&2
  exit 1
fi

for command_name in pg_dump psql bun; do
  command -v "$command_name" >/dev/null 2>&1 || {
    echo "Missing required command: $command_name" >&2
    exit 1
  }
done

TABLES=(
  Product
  Review
  Category
  Order
  Payment
  PaymentAttempt
  Refund
  Invoice
  CreditNote
  TrackingEvent
  WebhookEvent
  NewsletterSubscriber
  ContactMessage
  ProductOffer
  ProductOfferAudit
)

DUMP_FILE="$(mktemp -t ecom-commerce-XXXXXX.sql)"
trap 'rm -f "$DUMP_FILE"' EXIT

echo "[1/5] Checking source and target connectivity..."
psql "$SOURCE_DATABASE_URL" -v ON_ERROR_STOP=1 -Atc 'SELECT current_database();' >/dev/null
psql "$TARGET_DATABASE_URL" -v ON_ERROR_STOP=1 -Atc 'SELECT current_database();' >/dev/null

echo "[2/5] Creating/updating the lean commerce schema on the target..."
DATABASE_URL="$TARGET_DATABASE_URL" bunx prisma db push

echo "[3/5] Refusing to overwrite a non-empty commerce target..."
existing_rows=0
for table in "${TABLES[@]}"; do
  count="$(psql "$TARGET_DATABASE_URL" -v ON_ERROR_STOP=1 -Atc "SELECT COUNT(*) FROM \"$table\";")"
  existing_rows=$((existing_rows + count))
done
if (( existing_rows > 0 )); then
  echo "Target already contains $existing_rows commerce rows. Use a clean target or clear it deliberately before migration." >&2
  exit 1
fi

echo "[4/5] Exporting only commerce data (Research* tables are intentionally excluded)..."
pg_dump_args=(
  "$SOURCE_DATABASE_URL"
  --data-only
  --no-owner
  --no-privileges
  --inserts
  --on-conflict-do-nothing
)
for table in "${TABLES[@]}"; do
  pg_dump_args+=("--table=public.\"$table\"")
done
pg_dump "${pg_dump_args[@]}" > "$DUMP_FILE"

psql "$TARGET_DATABASE_URL" -v ON_ERROR_STOP=1 -f "$DUMP_FILE" >/dev/null

echo "[5/5] Comparing source and target row counts..."
failed=0
printf '%-28s %12s %12s\n' TABLE SOURCE TARGET
printf '%-28s %12s %12s\n' '----------------------------' '------------' '------------'
for table in "${TABLES[@]}"; do
  source_count="$(psql "$SOURCE_DATABASE_URL" -v ON_ERROR_STOP=1 -Atc "SELECT COUNT(*) FROM \"$table\";")"
  target_count="$(psql "$TARGET_DATABASE_URL" -v ON_ERROR_STOP=1 -Atc "SELECT COUNT(*) FROM \"$table\";")"
  printf '%-28s %12s %12s\n' "$table" "$source_count" "$target_count"
  if [[ "$source_count" != "$target_count" ]]; then
    failed=1
  fi
done

if (( failed != 0 )); then
  echo "Migration completed with row-count mismatches. Do NOT cut over DATABASE_URL." >&2
  exit 2
fi

echo "Commerce data migration verified. Keep the source database available until application-level cutover checks pass."
