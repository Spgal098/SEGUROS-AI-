# Backend Fase 6 — Base segura (TextilIA Seguros)

2026-07-07 · Primer bloque de Fase 6: auth, autorización, estructura y seguridad base. **Sin módulos comerciales todavía.**

## Endpoints

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/api/health` | pública | Estado del servicio y DB |
| GET | `/api/me` | requireAuth | Identidad del usuario autenticado (user, organización, rol) |

`/api/me` responde solo con datos de `req.auth` (derivados del token + perfil); **nunca** acepta `org_id`/`role` del cliente.

## Middleware

- **`requireAuth`** (`src/middleware/auth.js`): exige `Authorization: Bearer <jwt>`. Valida el JWT contra Supabase Auth (`GET {SUPABASE_URL}/auth/v1/user`), carga el perfil activo de `users_profiles` y deja `req.auth = { userId, email, orgId, role, ... }`. El `org_id`/`role` salen del perfil en DB, no del request.
- **`requireRole(...roles)`** (`src/middleware/authorize.js`): jerarquía `owner>admin>agent>readonly`. Usar siempre después de `requireAuth`.
- **`errorHandler` + `notFound`** (`src/middleware/errorHandler.js`): respuestas JSON uniformes; **sin stack traces**; 5xx en producción → mensaje genérico.

## Respuestas de error

`{ error: true, code, message }`. Códigos: `UNAUTHORIZED` (401), `FORBIDDEN` (403), `NOT_FOUND` (404), `RATE_LIMITED` (429), `INTERNAL_ERROR` (500).

## Seguridad base

helmet · CORS restringido a `CORS_ALLOWED_ORIGIN` · rate limit en `/api` · `x-powered-by` desactivado · body JSON limitado a 1mb · errores sin stack.

## Variables requeridas (backend/.env — NO se sube)

`DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY` (para validar tokens), `SUPABASE_SERVICE_ROLE_KEY` (invitaciones/admin, bloques futuros), `PORT`, `CORS_ALLOWED_ORIGIN`.

## Casos negativos cubiertos (evidencia en `scripts/verify-auth.js` + curl)

| Caso | Esperado |
|---|---|
| `/api/me` sin token | 401 `UNAUTHORIZED` |
| `/api/me` token inválido/expirado | 401 (validado contra Supabase Auth) |
| Header sin esquema `Bearer` | 401 |
| Usuario válido sin perfil activo | 403 `FORBIDDEN` (rama verificada: perfil inexistente → null) |
| Forzar `org_id` en request | ignorado (identidad viene del perfil) |
| Ruta inexistente | 404 |

## Cómo probar

1. `cd backend && npm run verify:auth` → checks de DB/RLS/perfil.
2. `node server.js` y en otra terminal:
   - `curl -i localhost:3002/api/health` → 200
   - `curl -i localhost:3002/api/me` → 401
   - `curl -i -H "Authorization: Bearer x.y.z" localhost:3002/api/me` → 401

## Rol de base de datos `app_backend` (endurecimiento)

El backend NO debe conectarse como `postgres` (que ignora RLS). Se creó el rol **`app_backend` con `NOBYPASSRLS`** y permisos mínimos (`db/migrations/app-backend-role.sql`).

**Estado actual:** rol creado como `NOLOGIN` (no requiere contraseña, no inventamos secretos). RLS **probada con datos reales** bajo este rol (`npm run verify:role`): con contexto de org1 ve solo su cliente, con org2 solo el suyo, sin contexto o con org ajena ve 0 (falla cerrada).

**Activación (requiere contraseña del CEO):**
1. `npm run role:create` — crea el rol (ya hecho).
2. Agrega `APP_BACKEND_PASSWORD=<secreto>` en `backend/.env` y corre `npm run role:activate` — da LOGIN + contraseña.
3. Agrega `APP_BACKEND_DATABASE_URL=<cadena con usuario app_backend>` en `backend/.env`. Cuando está presente, el pool la usa en vez de `DATABASE_URL`, y **todo el backend pasa a respetar RLS**.

Permisos otorgados a `app_backend`: `USAGE` en schema public; `SELECT/INSERT/UPDATE/DELETE` en todas las tablas (RLS filtra filas); `USAGE/SELECT` en secuencias; `EXECUTE` en funciones; default privileges para objetos futuros. `GRANT app_backend TO postgres` solo para poder probar RLS con `SET ROLE`.

## Deuda técnica declarada

1. **Validación de JWT por llamada de red** a Supabase Auth en cada request. Mejorar con verificación local (JWKS/JWT secret) + caché.
2. **Activación de `app_backend` pendiente** de que el CEO defina `APP_BACKEND_PASSWORD` + `APP_BACKEND_DATABASE_URL`. Hasta entonces el pool sigue usando `DATABASE_URL` (rol `postgres`, bypass); el aislamiento efectivo lo da el código (`org_id`) + la RLS ya verificada. El rol y su prueba ya existen.
3. **Prueba 403 end-to-end** (usuario real sin perfil) pendiente de un usuario Supabase de prueba; hoy verificada a nivel unitario (loader → null).
4. **Claves Supabase de distinta generación** (`ANON_KEY` JWT legacy + service `sb_secret_`): revisar antes del bloque de invitaciones/admin.
