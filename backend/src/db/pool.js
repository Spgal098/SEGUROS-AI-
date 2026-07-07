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

module.exports = { getPool, hasDatabase: () => config.database.configured };
