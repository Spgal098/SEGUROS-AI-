# MVP TextilIA Seguros — Especificación Fase 4

2026-07-07 · APOLLO. Documento canónico del alcance MVP. Criterio: **mínimo VENDIBLE** a un agente/promotoría de seguros, no mínimo demo.

**Usuario tipo:** agente de seguros independiente o promotoría chica (1–15 agentes) en México. Vive de renovaciones y referidos; pierde dinero por seguimientos olvidados y renovaciones no contactadas. El objeto central es la **póliza y su ciclo**, no el pedido.

**Definición transversal de "hecho":** datos desde la API (cero hardcode), estados vacío/carga/error, permisos matriz Fase 3, RLS activa desde el día 1 (Seguros nunca opera sin auth), CA verificado por AEGIS.

**Diferencia estructural vs Textiles:** aquí NO hay catálogo de productos propios, inventario ni pedidos. Hay aseguradoras, ramos, pólizas y renovaciones. El flujo de dinero es prima/comisión, no precio×cantidad.

---

## Módulo 1 — Dashboard
- **Objetivo:** el agente ve en <10 seg: renovaciones próximas, seguimientos de hoy, pipeline de cotizaciones.
- **Datos:** `renewals` próximas 30/60/90 días, `follow_ups` vencidos y de hoy, `leads` por etapa, primas del mes.
- **Endpoints:** `GET /api/dashboard/summary`.
- **Pantallas:** 1. Estados completos; vacío honesto ("registra tu primera póliza").
- **Historias:**
  - S-DB-01 Como agente quiero ver renovaciones que vencen en 30 días para no perderlas. **CA:** lista = pólizas activas con `expiration_date` ≤ hoy+30 sin renovación cerrada; verificable por SQL.
  - S-DB-02 Como agente quiero ver mis seguimientos vencidos primero. **CA:** orden: vencidos → hoy → futuros.
- **NO entra:** comparativos de producción, metas por agente.

## Módulo 2 — Clientes y Leads
- **Objetivo:** prospectos y asegurados con su historial (pólizas, cotizaciones, seguimientos, conversaciones).
- **Datos:** `clients`, `leads` (schema Fase 2). Minimización LFPDPPP: lista blanca de campos; NADA de datos de salud en clients.
- **Endpoints:** `GET/POST/PATCH /api/clients`, `GET/POST/PATCH /api/leads`, `POST /api/leads/:id/convert`.
- **Pantallas:** lista con filtros · detalle 360° del cliente (pólizas + renovaciones + actividad) · formulario (3).
- **Historias:**
  - S-CL-01 Como agente quiero capturar un lead con ramo de interés (auto, GMM, vida…) para cotizarle. **CA:** `line_of_business_id` obligatorio; validación backend.
  - S-CL-02 Como agente quiero ver TODO el historial del cliente en una pantalla para atender renovación o siniestro informado. **CA:** el detalle agrega pólizas, cotizaciones, seguimientos y conversaciones del cliente vía API (1 llamada agregadora o paralelas).
  - S-CL-03 Como readonly (contador) puedo consultar pero no editar. **CA:** PATCH → 403.
- **NO entra:** expediente documental (INE, facturas — v2 con Supabase Storage), campos de salud.

## Módulo 3 — Cotizaciones multi-aseguradora
- **Objetivo:** UNA cotización con N opciones (aseguradora/plan/prima) para comparar frente al cliente. Captura manual de opciones (los portales de aseguradoras NO se integran en MVP).
- **Datos:** `quotes`, `quote_options`, `insurers`, `lines_of_business`.
- **Endpoints:** `GET/POST /api/quotes`, `POST /api/quotes/:id/options`, `PATCH /api/quotes/:id/status`, `GET /api/insurers`, `GET /api/lines-of-business`.
- **Pantallas:** lista · constructor (cliente + ramo + opciones comparadas en tabla) · vista comparativa presentable (3).
- **Historias:**
  - S-CO-01 Como agente quiero registrar 3 opciones (GNP/AXA/Qualitas) con prima y coberturas clave para comparar con el cliente. **CA:** tabla comparativa ordenada por prima; marcar opción elegida.
  - S-CO-02 Como agente quiero pasar la cotización a "aceptada" y que me proponga crear la póliza. **CA:** aceptar sin opción seleccionada → 400.
- **NO entra:** cotización automática vía APIs de aseguradoras, tarifas precargadas, PDF con diseño.

## Módulo 4 — Pólizas (corazón del MVP)
- **Objetivo:** cartera completa: número, aseguradora, ramo, vigencia, prima, forma de pago, agente.
- **Datos:** `policies` (schema Fase 2).
- **Endpoints:** `GET/POST/PATCH /api/policies`, `GET /api/policies/:id`.
- **Pantallas:** cartera con filtros (ramo/aseguradora/estado/vencimiento) · detalle · formulario (3).
- **Historias:**
  - S-PO-01 Como agente quiero registrar una póliza emitida (desde cotización aceptada o directa) para tener mi cartera en un lugar. **CA:** `(org, policy_number)` único → duplicado 409; al crear se genera automáticamente su renovación futura.
  - S-PO-02 Como agente quiero filtrar mi cartera por vencimiento para planear el mes. **CA:** filtro server-side por rango.
  - S-PO-03 Como agent NO edito pólizas de la cartera de otro agente. **CA:** 403 (regla de cartera, caso negativo #13).
- **NO entra:** endosos, siniestros como módulo (solo nota en seguimientos), cobranza de recibos por fracción.

## Módulo 5 — Renovaciones (la razón de compra del producto)
- **Objetivo:** ninguna renovación se pierde: se generan solas desde la póliza y avanzan por estados.
- **Datos:** `renewals`; regla de negocio: al crear/renovar una póliza el BACKEND genera la próxima renovación (`due_date = expiration_date`).
- **Endpoints:** `GET /api/renewals?window=30|60|90&status=`, `PATCH /api/renewals/:id` (contactado/en proceso/renovada/perdida), `POST /api/renewals/:id/remind` (Fase 5: dispara WhatsApp; MVP: marca recordatorio manual).
- **Pantallas:** tablero por ventana de vencimiento (30/60/90) · detalle rápido inline (1-2).
- **Historias:**
  - S-RE-01 Como agente quiero que cada póliza genere su renovación automáticamente para no depender de mi memoria. **CA:** crear póliza → renovación `upcoming` con due_date correcto (test automático).
  - S-RE-02 Como agente quiero marcar "renovada" y que se cree la póliza del nuevo periodo ligada. **CA:** nueva vigencia = anterior +1 año; la vieja queda `expired`; nueva renovación generada.
  - S-RE-03 Como owner quiero ver tasa de renovación del trimestre. **CA:** renovadas / (renovadas+perdidas) del periodo, calculado en backend.
- **NO entra:** recordatorios automáticos programados (Fase 5), multi-recordatorio configurable.

## Módulo 6 — Seguimiento comercial
- **Objetivo:** tareas con fecha ligadas a lead/cliente/póliza; lo que hoy vive en la libreta del agente.
- **Datos:** `follow_ups`.
- **Endpoints:** `GET /api/follow-ups?due=today|overdue|week`, `POST`, `PATCH /:id/done`.
- **Pantallas:** lista "mi día" + creación rápida desde cualquier detalle (1 + componente).
- **Historias:**
  - S-SE-01 Como agente quiero agendar "llamar a Carlos el jueves" desde la ficha del cliente. **CA:** aparece en "mi día" del jueves; vencida si pasa.
  - S-SE-02 Como admin quiero ver seguimientos vencidos del equipo. **CA:** filtro por agente (admin+).
- **NO entra:** sincronización con Google Calendar, recordatorios push.

## Módulo 7 — WhatsApp / Conversaciones (lectura; flujos en Fase 5)
- Igual convención que Textiles: bandeja + hilo ligado a cliente/lead, `opt_in_at` registrado. **Endpoints:** `GET /api/conversations`, `GET /api/conversations/:id/messages`.
- **Historia:** S-WA-01 Como agente quiero el historial WhatsApp junto a la póliza del cliente. **CA:** ligado por teléfono normalizado.
- **NO entra:** envío, plantillas, bot, recordatorios de renovación por WhatsApp (Fase 5 — con JUSTICE revisando consentimiento).

## Módulo 8 — Reportes
- **Objetivo:** primas del periodo, pólizas nuevas vs renovadas, tasa de renovación, ramo top, pipeline.
- **Endpoints:** `GET /api/reports/summary?from&to` (cálculo en vivo).
- **Historia:** S-RP-01 Como owner quiero cifras del trimestre reproducibles. **CA:** verificables por SQL; sin datos → ceros honestos.
- **NO entra:** producción por aseguradora para bonos, exportes.

## Módulo 9 — IA comercial (versión honesta)
- **Objetivo:** clasificación de intención/prioridad de mensajes entrantes con reglas del dominio seguros (renovación urgente > cotización > información) + textos sugeridos.
- **Endpoints:** `POST /api/ai/classify`, `GET /api/ai/suggestions/:leadId`.
- **Historia:** S-IA-01 Como agente quiero que "mi póliza venció" llegue prioridad ALTA. **CA:** reglas de keywords del dominio; explicación visible.
- **NO entra:** LLM en producción (presupuesto/keys = decisión humana), respuestas autónomas, y NUNCA asesoría de cobertura generada por IA sin revisión del agente (línea CNSF — JUSTICE).

---

## Orden de implementación

```
0. Crear proyecto Supabase Seguros + aplicar schema.sql + rls-policies.sql   ← BLOQUEANTE HUMANO
1. Backend esqueleto (server, middleware auth SIEMPRE on, /api/health, /api/me)
2. Catálogos: insurers + lines_of_business (seed dev desde _seguros-seed)
3. Clientes/Leads
4. Pólizas + generación automática de renovaciones   ← corazón
5. Renovaciones (tablero + ciclo renovar)
6. Cotizaciones multi-aseguradora
7. Seguimientos
8. Dashboard + Reportes
9. Conversaciones (lectura) → puerta a Fase 5
10. IA sugerencias
```

**MVP mínimo vendible si hay presión:** 1-5 (dashboard, clientes, pólizas, renovaciones) — un agente paga solo por el tablero de renovaciones confiable. Cotizaciones y seguimientos, siguiente release.

## Riesgos
1. **Todo depende del paso 0** (proyecto Supabase) — sin él, Seguros es solo papel. Es la acción humana pendiente más importante del proyecto.
2. Regla renovación automática mal implementada = pólizas sin renovación silenciosas → test automático obligatorio (S-RE-01) desde el primer commit.
3. Datos sensibles: cualquier campo de salud que se cuele en `clients`/`custom_fields` = riesgo LFPDPPP → lista blanca en backend (caso negativo #14).
4. Tentación de copiar código de Textiles "para avanzar" → veto SEP; solo convenciones.

## Checklist de cierre (especificación)
- [x] 9 módulos especificados con CA verificables (16 historias)
- [x] Diferencias estructurales vs Textiles explícitas (póliza/renovación vs pedido/inventario)
- [x] Orden de implementación + MVP mínimo vendible (1-5)
- [x] Riesgos con mitigación
- [ ] Implementación — bloqueada por creación del proyecto Supabase (humano)
