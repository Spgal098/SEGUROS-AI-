# Arquitectura — TextilIA Seguros

Fase 2 · 2026-07-07 · Documento canónico. Producto independiente de TextilIA Textiles (cero recursos compartidos; ver README).

## 1. Visión

CRM + IA comercial para agentes y empresas de seguros (México): clientes/leads, cotizaciones multi-aseguradora, pólizas, renovaciones, seguimiento comercial, WhatsApp, reportes.

## 2. Decisión de stack (ADR-S001)

- **Contexto:** el producto nace de cero; Textiles usa Express + Postgres con capas routes/services/repositories que ya demostraron funcionar.
- **Decisión:** mismo *stack y convenciones* que Textiles (Node/Express + Supabase Postgres/Auth + frontend modular con Vite), pero **implementación propia — nada de copiar código**: el dominio es distinto (pólizas ≠ pedidos) y copiar arrastraría deuda del single-file.
- **Consecuencia:** curva de aprendizaje cero entre productos; a nivel de conocimiento se comparten convenciones, a nivel de código nada.

## 3. Estructura de carpetas objetivo

```
textilia-seguros/
├── backend/
│   ├── server.js
│   ├── src/{routes,services,repositories,middleware,config,db}/
│   └── db/{schema.sql,seed.sql}          # seed = SOLO desarrollo
├── frontend/                              # Vite, modular desde el día 1 (sin single-file)
│   └── src/{modules,components,lib}/
└── docs/
```

## 4. Modelo de datos inicial (dominio Seguros)

Diseño completo en [`db/schema.sql`](../db/schema.sql) (borrador ejecutable para el proyecto Supabase de Seguros). Núcleo:

| Tabla | Propósito |
|---|---|
| `organizations` | agencia/promotoría (raíz; sin vocabulario tenant/industria desde el día 1) |
| `users_profiles` | perfil ligado a `auth.users` de Supabase (Fase 3) |
| `clients` | asegurados/prospectos (persona física o moral) |
| `leads` | prospectos comerciales con intención, prioridad y etapa |
| `insurers` | aseguradoras con las que trabaja la agencia (GNP, AXA, Qualitas…) |
| `lines_of_business` | ramos: vida, GMM, auto, hogar, empresarial, flotillas, RC, retiro |
| `quotes` / `quote_options` | cotización con N opciones (una por aseguradora/plan) |
| `policies` | póliza emitida: número, ramo, aseguradora, vigencia, prima, forma de pago |
| `renewals` | renovaciones: vencimiento, estado, recordatorios |
| `follow_ups` | seguimientos comerciales (llamada, WhatsApp, cita) |
| `conversations` / `messages` | WhatsApp por cliente/lead (Fase 5) |
| `activities`, `report_metrics`, `audit_logs` | actividad y reportes |

Reglas: `org_id NOT NULL` + RLS en toda tabla; soft-delete; fechas de vigencia y prima en `policies` como fuente de renovaciones (una renovación se genera desde la póliza, no se captura suelta).

Diferencias deliberadas vs Textiles: no hay inventario ni pedidos; el objeto central es la **póliza** y su ciclo (cotizar → emitir → renovar), no el pedido.

## 5. Endpoints iniciales (contratos)

| Módulo | Endpoints |
|---|---|
| Salud/config | `GET /api/health`, `GET/PUT /api/settings` |
| Auth (Fase 3) | middleware JWT Supabase + `GET /api/me` |
| Clientes | `GET/POST/PATCH /api/clients` |
| Leads | `GET/POST/PATCH /api/leads` |
| Cotizaciones | `GET/POST /api/quotes`, `POST /api/quotes/:id/options`, `POST /api/quotes/:id/send` |
| Pólizas | `GET/POST/PATCH /api/policies` |
| Renovaciones | `GET /api/renewals`, `POST /api/renewals/:id/remind`, `PATCH /api/renewals/:id` |
| Seguimiento | `GET/POST /api/follow-ups` |
| Dashboard | `GET /api/dashboard/summary` |
| WhatsApp (F5) | `POST /api/webhooks/whatsapp`, `GET /api/conversations` |

Convención de errores: `{ error: true, code, message }` (misma convención, implementación propia).

## 6. Supabase, ambientes y env vars

- **Proyecto Supabase PROPIO** (crear en dashboard de Supabase — acción humana pendiente; nombre sugerido: `textilia-seguros-dev`). Nunca reutilizar el de Textiles.
- Env vars: ver [`.env.example`](../.env.example). Mismas categorías que Textiles con **valores y credenciales totalmente distintos** (otro `DATABASE_URL`, otras keys, otro número de WhatsApp, otro puerto local por defecto: 3002).
- Ambientes: dev → staging → prod, espejo de la política de Textiles pero independientes.

## 7. Alertas legales del dominio (para JUSTICE, Fase 5/8)

- El software es una herramienta PARA agentes; no debe intermediar seguros (ámbito CNSF/LISF) — cuidar claims y funcionalidades que crucen esa línea.
- Datos de salud (GMM) son datos personales **sensibles** bajo LFPDPPP → consentimiento expreso; influye en el diseño de `clients`/`quotes` (minimizar datos sensibles almacenados).
