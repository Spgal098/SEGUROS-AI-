// src/config/index.js — Config central de TextilIA Seguros.
// Todos los parámetros salen de variables de entorno; cero hardcode.
require('dotenv').config();

const str = (v, d) => (v === undefined || v === '' ? d : String(v));
const num = (v, d) => (v === undefined || v === '' ? d : Number(v));
const bool = (v, d) => (v === undefined || v === '' ? d : String(v) === 'true');

module.exports = {
  env: str(process.env.NODE_ENV, 'development'),
  port: num(process.env.PORT, 3002),
  corsOrigin: str(process.env.CORS_ALLOWED_ORIGIN, 'http://localhost:5174'),

  database: {
    url: str(process.env.DATABASE_URL, ''),
    get configured() { return this.url !== ''; },
  },

  supabase: {
    url: str(process.env.SUPABASE_URL, ''),
    anonKey: str(process.env.SUPABASE_ANON_KEY, ''),
    // service_role SOLO se lee aquí (backend); jamás debe llegar al frontend.
    serviceRoleKey: str(process.env.SUPABASE_SERVICE_ROLE_KEY, ''),
  },

  // Seguros NUNCA opera sin auth en endpoints de datos (regla de producto).
  // Este flag solo permite levantar /api/health durante la Fase 5.
  auth: {
    provider: str(process.env.AUTH_PROVIDER, 'supabase'),
  },

  integrations: {
    ai: bool(process.env.AI_ENABLED, false),
    whatsapp: bool(process.env.WHATSAPP_ENABLED, false),
  },

  rateLimit: {
    windowMs: num(process.env.RATE_LIMIT_WINDOW_MS, 60000),
    max: num(process.env.RATE_LIMIT_MAX_REQUESTS, 100),
  },

  logLevel: str(process.env.LOG_LEVEL, 'info'),
};
