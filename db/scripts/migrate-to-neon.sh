#!/usr/bin/env bash
# =============================================================================
# migrate-to-neon.sh
# Jalankan init.sql + semua migrations ke Neon (atau Postgres manapun)
#
# Usage:
#   DATABASE_URL="postgresql://..." ./db/scripts/migrate-to-neon.sh
#
# Atau dengan flag langsung:
#   ./db/scripts/migrate-to-neon.sh "postgresql://user:pass@host/db?sslmode=require"
# =============================================================================

set -euo pipefail

DB_URL="${1:-$DATABASE_URL}"

if [ -z "$DB_URL" ]; then
  echo "❌  DATABASE_URL tidak di-set."
  echo "    Gunakan: DATABASE_URL='postgresql://...' ./db/scripts/migrate-to-neon.sh"
  echo "    Atau: ./db/scripts/migrate-to-neon.sh 'postgresql://...'"
  exit 1
fi

SCHEMA_DIR="$(dirname "$0")/../schema/2026-clean"
INIT_FILE="$SCHEMA_DIR/init.sql"
MIGRATIONS_DIR="$SCHEMA_DIR/migrations"

echo "🚀  Mulai migrasi ke Neon..."
echo "    Database: ${DB_URL%%@*}@***"
echo ""

# 1. Jalankan init.sql (base schema)
echo "▶  Menjalankan init.sql..."
psql "$DB_URL" -f "$INIT_FILE"
echo "✅  init.sql selesai"
echo ""

# 2. Jalankan semua migrations urut
for f in "$MIGRATIONS_DIR"/0*.sql; do
  filename=$(basename "$f")
  echo "▶  $filename..."
  psql "$DB_URL" -f "$f"
  echo "✅  $filename selesai"
done

echo ""
echo "🎉  Semua migrations berhasil dijalankan!"
echo ""
echo "Langkah selanjutnya:"
echo "  1. Tambahkan DATABASE_URL ke Vercel Environment Variables"
echo "  2. Deploy project"
