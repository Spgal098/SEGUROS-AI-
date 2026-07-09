// src/db/pool.js — Pool de PostgreSQL (Supabase propio de Seguros).
// Lazy: no se conecta hasta el primer query, y falla con mensaje claro
// si DATABASE_URL no está configurada (el proyecto Supabase es requisito).
const { Pool } = require('pg');
const config = require('../config');

let pool = null;

function getPool() {
  if (!config.database.configured) {
    throw new Error(
      'DATABASE_URL no configurada. Crea el proyecto Supabase de Seguros y completa backend/.env (ver .env.example).'
    );
  }
  if (!pool) {
    // Prefiere la conexión del rol dedicado app_backend (sin BYPASSRLS) si está
    // configurada; si no, cae a DATABASE_URL (rol postgres, bypass — deuda).
    const url = config.database.appUrl || config.database.url;
    pool = new Pool({
      connectionString: url,
      ssl: url.includes('localhost') ? false : { rejectUnauthorized: false },
      max: 10,
    });
  }
  return pool;
}

// Query simple sobre el pool (rol de aplicación).
function query(text, params) {
  return getPool().query(text, params);
}

// Pool ADMIN: siempre usa DATABASE_URL (rol postgres), nunca app_backend.
// Para migraciones y operaciones que requieren privilegios elevados
// (crear/alterar roles, aplicar esquema). Uso efímero: el llamador hace end().
function getAdminPool() {
  if (!config.database.url) {
    throw new Error('DATABASE_URL (rol postgres) no configurada; requerida para operaciones admin.');
  }
  return new Pool({
    connectionString: config.database.url,
    ssl: config.database.url.includes('localhost') ? false : { rejectUnauthorized: false },
    max: 4,
  });
}

// Ejecuta `fn(client)` dentro de una transacción con el contexto de identidad
// fijado (app.org_id / app.role). Con el rol app_backend (sin BYPASSRLS) estas
// variables activan las políticas RLS; el aislamiento por org queda garantizado
// tanto por la RLS como por el filtrado por org_id en el código.
async function withOrgContext({ orgId, role }, fn) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT set_config($1, $2, true)', ['app.org_id', orgId || '']);
    await client.query('SELECT set_config($1, $2, true)', ['app.role', role || '']);
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

module.exports = { getPool, getAdminPool, query, withOrgContext, hasDatabase: () => config.database.configured };
