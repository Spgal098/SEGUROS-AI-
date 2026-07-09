-- db/migrations/catalogs.sql — Migración ADITIVA de catálogos (Seguros).
-- Enriquece las tablas existentes insurers y lines_of_business para el CRUD
-- posterior. NO crea tablas ni toca datos. NO cambia RLS (ya cubierta en Fase 3).
-- Idempotente. Aplicar con: npm run db:migrate:catalogs  (dry-run: :dry)

BEGIN;

-- ── insurers: timestamps + unicidad de nombre por organización ──────
ALTER TABLE insurers ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE insurers ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Nombre único por org, case-insensitive, ignorando borrados (permite
-- reutilizar un nombre tras un soft delete).
CREATE UNIQUE INDEX IF NOT EXISTS insurers_org_name_uidx
  ON insurers (org_id, lower(name)) WHERE deleted_at IS NULL;

-- ── lines_of_business: active + soft delete + timestamps ────────────
-- (Se agregan las columnas ANTES de crear el índice parcial que usa deleted_at.)
ALTER TABLE lines_of_business ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;
ALTER TABLE lines_of_business ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE lines_of_business ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE lines_of_business ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Reemplazo seguro del UNIQUE(org_id, slug) TOTAL por índice parcial que
-- respeta el soft delete. Seguro: la tabla está vacía (sin duplicados activos).
-- 1) crear el índice parcial nuevo, 2) soltar el constraint total viejo.
CREATE UNIQUE INDEX IF NOT EXISTS lines_of_business_org_slug_uidx
  ON lines_of_business (org_id, slug) WHERE deleted_at IS NULL;
ALTER TABLE lines_of_business DROP CONSTRAINT IF EXISTS lines_of_business_org_id_slug_key;

COMMIT;
