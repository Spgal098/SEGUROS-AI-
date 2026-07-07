# TextilIA Seguros

CRM + IA comercial + WhatsApp + cotizaciones + clientes + pólizas + renovaciones + seguimiento comercial + reportes para agentes y empresas de seguros en México.

## Independencia total (regla inviolable)

Este producto es **completamente independiente de TextilIA Textiles**:

- Repositorio, frontend, backend y roadmap propios.
- Proyecto **Supabase propio** (base de datos + Auth), con RLS y aislamiento de datos.
- Usuarios, roles, permisos, variables de entorno, dominio y deploy propios.
- **Prohibido**: compartir código, datos, auth, configuración o infraestructura con Textiles; selectores de industria; presets multi-industria; campos tipo `industry_id`.

Lo único compartible con Textiles: conocimiento, convenciones y librerías públicas de npm.

## Estado

- **Fase 1 (separación):** repositorio creado. ✅
- **Fase 2 (arquitectura + base de datos):** pendiente — aquí se define stack, estructura y el proyecto Supabase de Seguros.

La referencia de dominio (ramos, tipos de póliza, etapas del funnel de seguros) vive en `..\_seguros-seed\` y se usa solo como insumo de diseño, nunca como código base.
