-- db/migrations/app-backend-role.sql — Rol de backend SIN BYPASSRLS.
-- Objetivo: que el backend deje de conectarse como `postgres` (que ignora RLS)
-- y use un rol con privilegios mínimos que SÍ respeta las políticas RLS.
--
-- Este archivo NO contiene contraseñas. Se crea el rol como NOLOGIN; la
-- capacidad de LOGIN + contraseña se activa por separado con la contraseña
-- que defina el CEO (ver scripts/activate-app-backend.js y docs/BACKEND_FASE6.md).
-- Idempotente.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_backend') THEN
    CREATE ROLE app_backend NOLOGIN NOBYPASSRLS;
  ELSE
    ALTER ROLE app_backend NOBYPASSRLS;  -- garantía: nunca bypass
  END IF;
END $$;

-- Permisos mínimos sobre el esquema de datos
GRANT USAGE ON SCHEMA public TO app_backend;

-- CRUD sobre las tablas existentes (RLS sigue filtrando filas por org)
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_backend;

-- Secuencias (por si alguna tabla usa serial/identity)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_backend;

-- Ejecutar los helpers de identidad (app_org_id/app_role son SECURITY DEFINER)
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO app_backend;

-- Tablas/funciones FUTURAS heredan estos permisos automáticamente
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_backend;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO app_backend;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO app_backend;

-- Permitir que `postgres` haga SET ROLE app_backend (para pruebas de RLS)
GRANT app_backend TO postgres;
