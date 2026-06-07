# Agent Commands Reference

## Quality Checks
- Lint: `npm run lint` (uses next lint, deprecated - will migrate to eslint CLI)
- Typecheck: `npx tsc --noEmit`

## Database Scripts
- Reset: `./db/scripts/safe-clean-reset.sh` - Drops and recreates database with 2026-clean schema
- Migrations are in `db/schema/2026-clean/migrations/` (numbered sequentially)