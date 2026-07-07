# Auth, Roles, Permisos y RLS — TextilIA Seguros

Fase 3 · 2026-07-07 · Diseño canónico de seguridad. Estado: DISEÑO (el proyecto Supabase de Seguros aún no existe; nada implementado).
Producto independiente: usuarios, roles, policies y proyecto Supabase EXCLUSIVOS de Seguros. Un usuario de Textiles NO existe aquí (proyectos Auth distintos → JWTs con firmas distintas → rechazo automático).

## 1. Proveedor y principio

- **Supabase Auth** del proyecto propio de Seguros (pendiente de crear). Email + contraseña; sin registro abierto (solo invitación).
- Defensa en dos líneas: backend Express valida JWT + rol por endpoint; RLS en Postgres aísla por organización (agencia/promotoría).
- `SERVICE_ROLE` solo backend; frontend solo `ANON_KEY`.

## 2. Cinco modelos de roles evaluados

| # | Modelo | Roles | Veredicto |
|---|---|---|---|
| A | Plano | owner, agente | No distingue administración |
| B | Clásico 3 | owner, admin, agente | Sin solo-lectura (contador, auditor de promotoría) |
| **C** | **4 niveles** | **owner, admin, agent, readonly** | **RECOMENDADO** — refleja una agencia real: dueño/promotor, gerente, agentes, consulta |
| D | Jerárquico 6 | + supervisor de célula, capturista | Real en promotorías grandes; sobre-diseño para el MVP. Ruta: C→D si el mercado lo pide |
| E | RBAC dinámico | roles custom + permisos en tabla | Evolución futura de C sin migración destructiva |

**Recomendación: C** — ya está codificado en el CHECK de `users_profiles` del schema de Fase 2 (`owner,admin,agent,readonly`), así que diseño y esquema quedan alineados sin cambios.

## 3. Matriz rol → permiso → recurso (Seguros)

C=crear, R=leer, U=editar, D=eliminar (soft). Ámbito siempre: SU organización.

| Recurso | owner | admin | agent | readonly |
|---|---|---|---|---|
| Organización (settings) | CRUD | RU | R | R |
| Usuarios | CRUD | CRU (no toca owners) | ✗ | ✗ |
| Clientes | CRUD | CRUD | CRU (D ✗) | R |
| Leads | CRUD | CRUD | CRU (los propios + sin asignar) | R |
| Aseguradoras / ramos (catálogos) | CRUD | CRUD | R | R |
| Cotizaciones + opciones | CRUD | CRUD | CRU (las propias; R todas) | R |
| **Pólizas** | CRUD | CRUD | CRU (las de su cartera) | R |
| **Renovaciones** | CRUD | CRUD | RU (marcar contactado/renovada) | R |
| Seguimientos | CRUD | CRUD | CRU (los propios) | R |
| Conversaciones WhatsApp | CRUD | CRUD | CRU (asignadas) | R |
| Reportes | R | R | R (su cartera) | R |
| Auditoría | R | R | ✗ | ✗ |

Nota de dominio: la **cartera** del agente (`policies.agent_id`, `leads.assigned_to`) restringe la escritura, no la lectura — en agencias chicas todos ven el pipeline; si una promotoría exige carteras ciegas, se endurece la política de SELECT sin cambiar el esquema.

## 4. Flujos de usuario

Idénticos en convención a Textiles, implementación propia:

- **Login:** `signInWithPassword` → JWT → `Authorization: Bearer` → middleware → `req.user={id,orgId,role}`.
- **Invitación:** `POST /api/users/invite` (owner/admin) → `auth.admin.inviteUserByEmail` (service_role) → fila en `users_profiles`. Sin auto-registro.
- **Recuperación:** `resetPasswordForEmail` (Supabase directo).
- **Administración:** `GET/PATCH /api/users` — owner administra todo; admin no toca owners; desactivar = `status='disabled'` + ban en Auth, nunca borrar.

## 5. RLS por tabla (SQL ejecutable: `db/rls-policies.sql`)

Mismo patrón de identidad dual que la convención TAIOS (helpers `app_org_id()` / `app_role()`; caminos JWT y backend-pool con `SET LOCAL app.org_id/app.role`).

| Tabla | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| organizations | miembros (id = app_org_id()) | nadie | owner/admin | nadie |
| users_profiles | miembros | owner/admin | owner/admin | nadie |
| settings, insurers, lines_of_business | miembros | owner/admin | owner/admin | owner/admin |
| clients, leads, quotes, quote_options, follow_ups | miembros | rol ≥ agent | rol ≥ agent | owner/admin |
| policies | miembros | rol ≥ agent | rol ≥ agent | owner/admin |
| renewals | miembros | rol ≥ agent (normalmente las genera el backend desde policies) | rol ≥ agent | owner/admin |
| conversations, messages | miembros | rol ≥ agent / webhook vía backend | rol ≥ agent | owner/admin |
| activities, report_metrics | miembros | owner/admin (backend) | owner/admin | owner/admin |
| audit_logs | owner/admin | backend | nadie | nadie |
| webhook_events | owner/admin | backend | nadie | nadie |

## 6. Endpoints protegidos

| Endpoint | Auth | Rol mínimo |
|---|---|---|
| `GET /api/health` | pública | — |
| `POST /api/webhooks/whatsapp` | verify token + firma HMAC | — |
| `GET /api/me` | JWT | cualquiera |
| `GET/PUT /api/settings` | JWT | R: readonly · W: admin |
| `/api/clients`, `/api/leads`, `/api/quotes`, `/api/policies`, `/api/follow-ups` | JWT | matriz §3 |
| `/api/renewals` (+ `/remind`) | JWT | R: readonly · U: agent · remind: agent |
| `/api/users*` | JWT | owner/admin |
| `/api/dashboard/summary`, `/api/conversations` | JWT | readonly |

## 7. Casos negativos (tests de Fase 6)

Los 12 de la convención TAIOS (sin token→401; token inválido/expirado→401; **token del proyecto Supabase de TEXTILES→401 por firma**; readonly escribe→403; agent borra→403; admin toca owner→403; usuario disabled→403; org_id inyectado en request→ignorado+0 filas; webhook sin firma→401; brute force→rate limit; service_role en frontend→prohibido; org A no ve org B), más 2 propios del dominio:

13. Agent intenta `PATCH /api/policies/:id` de una póliza de otro agente → 403 (regla de cartera).
14. Datos sensibles (salud/GMM) en payloads de cotización → el backend rechaza campos no permitidos en `clients` (minimización LFPDPPP; lista blanca de campos).

## 8. Plan de implementación

| Paso | Acción | Necesita |
|---|---|---|
| 1 | **Crear proyecto Supabase `textilia-seguros-dev`** | **Acción humana (dashboard)** |
| 2 | Ejecutar `db/schema.sql` + `db/rls-policies.sql` en ese proyecto | DATABASE_URL de Seguros |
| 3 | Backend Express nuevo (Fase 4) nace CON el middleware auth desde el primer endpoint — aquí no hay flag `AUTH_ENABLED=false`: Seguros nunca opera sin auth | Paso 1-2 |
| 4 | Frontend nace con pantalla de login | Paso 3 |

## Control de calidad
- **Sé con certeza:** el schema de Fase 2 define los 4 roles y `org_id NOT NULL` en todas las tablas (VERIFICADO por validación tx+rollback, 18 tablas).
- **Asumo:** una organización por despacho/promotoría; agentes independientes = organización de 1 usuario.
- **Falta validar:** todo lo que dependa del proyecto Supabase real (PENDIENTE DE VERIFICAR hasta que exista).
- **Riesgo si se implementa mal:** pólizas con datos personales visibles entre organizaciones = incidente LFPDPPP; por eso RLS nace activada y Seguros jamás opera con auth apagada.
