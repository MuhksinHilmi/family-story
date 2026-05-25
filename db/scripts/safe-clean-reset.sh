#!/bin/bash

# =============================================================================
# FAMILY STORY - SAFE CLEAN RESET SCRIPT
# =============================================================================
# Script ini digunakan untuk menghapus database lokal dan mengganti dengan
# schema baru (2026-clean) secara AMAN dengan banyak konfirmasi.
#
# Cara pakai:
#   chmod +x db/scripts/safe-clean-reset.sh
#   ./db/scripts/safe-clean-reset.sh
#
# PERINGATAN: Script ini akan MENGHAPUS SEMUA DATA di database family_story
# =============================================================================

set -e

DB_NAME="family_story"
NEW_SCHEMA="db/schema/2026-clean/init.sql"
BACKUP_DIR="$HOME/family_story_backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/family_story_backup_${TIMESTAMP}.sql"

echo "======================================================"
echo "   FAMILY STORY - SAFE DATABASE CLEAN RESET"
echo "======================================================"
echo ""
echo "Database yang akan direset : $DB_NAME"
echo "Schema baru yang akan dipakai: $NEW_SCHEMA"
echo ""

# 1. Pre-check: Pastikan aplikasi tidak sedang berjalan
echo ">>> LANGKAH 1: Periksa apakah aplikasi sedang berjalan..."
if pgrep -f "next dev" > /dev/null || pgrep -f "npm run dev" > /dev/null; then
    echo "⚠️  PERINGATAN: Aplikasi sepertinya masih berjalan (npm run dev / next dev)."
    echo "   Saran: Hentikan dulu dengan Ctrl+C di terminal yang menjalankan app."
    read -p "Apakah kamu sudah menghentikan aplikasi? (ketik 'yes' untuk lanjut): " APP_CONFIRM
    if [ "$APP_CONFIRM" != "yes" ]; then
        echo "❌ Dibatalkan. Hentikan aplikasi terlebih dahulu."
        exit 1
    fi
else
    echo "✅ Aplikasi tidak terdeteksi berjalan."
fi
echo ""

# 2. Cek apakah psql tersedia
echo ">>> LANGKAH 2: Memeriksa PostgreSQL client..."
if ! command -v psql &> /dev/null; then
    echo "❌ psql tidak ditemukan. Pastikan PostgreSQL sudah terinstall."
    exit 1
fi
echo "✅ psql ditemukan."
echo ""

# 3. Cek apakah database ada
echo ">>> LANGKAH 3: Memeriksa keberadaan database..."
if ! psql -lqt | cut -d \| -f 1 | grep -qw "$DB_NAME"; then
    echo "⚠️  Database '$DB_NAME' tidak ditemukan."
    read -p "Lanjutkan? (yes/no): " CONTINUE
    if [ "$CONTINUE" != "yes" ]; then
        echo "Dibatalkan."
        exit 0
    fi
else
    echo "✅ Database '$DB_NAME' ditemukan."
fi
echo ""

# 4. Backup
echo ">>> LANGKAH 4: Membuat backup (WAJIB)"
mkdir -p "$BACKUP_DIR"

echo "Membuat backup ke: $BACKUP_FILE"
pg_dump "$DB_NAME" > "$BACKUP_FILE"

if [ $? -eq 0 ]; then
    BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo "✅ Backup berhasil dibuat ($BACKUP_SIZE)"
else
    echo "❌ Backup gagal!"
    exit 1
fi
echo ""

# 5. Konfirmasi pertama
echo "======================================================"
echo "   PERINGATAN KERAS"
echo "======================================================"
echo "Anda akan MENGHAPUS TOTAL database '$DB_NAME'"
echo "Semua data (user, node, family, marriage, invitation, dll) AKAN HILANG."
echo ""
echo "Backup sudah dibuat di:"
echo "  $BACKUP_FILE"
echo ""
read -p "Apakah kamu YAKIN ingin melanjutkan? (ketik 'DELETE' untuk konfirmasi): " CONFIRM1

if [ "$CONFIRM1" != "DELETE" ]; then
    echo "❌ Dibatalkan. Backup tetap tersimpan."
    exit 0
fi
echo ""

# 6. Konfirmasi kedua (lebih kuat)
read -p "Ketik nama database untuk konfirmasi terakhir ('$DB_NAME'): " CONFIRM2

if [ "$CONFIRM2" != "$DB_NAME" ]; then
    echo "❌ Nama database tidak cocok. Dibatalkan."
    exit 0
fi
echo ""

# 7. Eksekusi Drop & Recreate
echo ">>> LANGKAH 5: Menghapus dan membuat ulang database..."
dropdb "$DB_NAME" || true
createdb "$DB_NAME"
echo "✅ Database baru '$DB_NAME' berhasil dibuat."
echo ""

# 8. Jalankan schema baru (init.sql)
echo ">>> LANGKAH 6: Menjalankan schema baru (init.sql)..."
if [ ! -f "$NEW_SCHEMA" ]; then
    echo "❌ File schema tidak ditemukan: $NEW_SCHEMA"
    exit 1
fi

psql -v ON_ERROR_STOP=1 -d "$DB_NAME" -f "$NEW_SCHEMA"

if [ $? -eq 0 ]; then
    echo "✅ Schema baru (init.sql) berhasil dijalankan."
else
    echo "❌ Gagal menjalankan schema baru! (script dihentikan karena error)"
    exit 1
fi
echo ""

# 9. Jalankan migrasi tambahan (jika ada)
echo ">>> LANGKAH 7: Menjalankan migrasi tambahan..."
MIGRATIONS_DIR="db/schema/2026-clean/migrations"

if [ -d "$MIGRATIONS_DIR" ]; then
    # Get all .sql files sorted alphabetically (001_, 002_, etc.)
    MIGRATION_FILES=$(ls "$MIGRATIONS_DIR"/*.sql 2>/dev/null | sort)

    if [ -n "$MIGRATION_FILES" ]; then
        echo "   Ditemukan migrasi tambahan:"
        for migration in $MIGRATION_FILES; do
            echo "   - $(basename "$migration")"
            psql -v ON_ERROR_STOP=1 -d "$DB_NAME" -f "$migration"

            if [ $? -ne 0 ]; then
                echo "❌ Gagal menjalankan migrasi: $(basename "$migration")"
                exit 1
            fi
        done
        echo "✅ Semua migrasi tambahan berhasil dijalankan."
    else
        echo "   Tidak ada file migrasi tambahan."
    fi
else
    echo "   Folder migrations tidak ditemukan (lewati)."
fi
echo ""

# 8. Verifikasi
echo ">>> LANGKAH 8: Verifikasi tabel..."
echo "Tabel yang ada di database baru:"
psql -d "$DB_NAME" -c "\dt" | head -30

echo ""
echo "======================================================"
echo "   RESET BERHASIL"
echo "======================================================"
echo ""
echo "Database '$DB_NAME' sudah bersih dan menggunakan schema baru."
echo "Backup lama tersimpan di:"
echo "  $BACKUP_FILE"
echo ""
echo "Langkah selanjutnya:"
echo "  1. Jalankan aplikasi: npm run dev"
echo "  2. Test register user baru"
echo "  3. Test flow invitation (3 metode)"
echo ""
echo "Script selesai."
