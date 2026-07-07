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
    pool = new Pool({
      connectionString: config.database.url,
      ssl: config.database.url.includes('localhost') ? false : { rejectUnauthorized: false },
      max: 10,
    });
  }
  return pool;
}

// Query simple sobre el pool.
function query(text, params) {
  return getPool().query(text, params);
}

// Ejecuta `fn(client)` dentro de una transacción con el contexto de identidad
// fijado (app.org_id / app.role). Cuando exista el rol `app_backend` sin
// BYPASSRLS (deuda técnica), estas variables activarán las políticas RLS.
// Hoy el pool entra como rol con BYPASSRLS, así que el aislamiento efectivo
// lo garantiza el código filtrando por org_id (defensa en profundidad).
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

module.exports = { getPool, query, withOrgContext, hasDatabase: () => config.database.configured };
