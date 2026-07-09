// scripts/apply-db.js — Aplica db/schema.sql + db/rls-policies.sql al Supabase
// PROPIO de Seguros. Requiere DATABASE_URL en backend/.env.
// Uso: npm run db:apply    (idempotencia: schema usa CREATE TABLE sin IF NOT EXISTS
// a propósito — este script es para el ALTA INICIAL del proyecto, no para re-runs).
const fs = require('fs');
const path = require('path');
const { getAdminPool } = require('../src/db/pool');

(async () => {
  // Operación admin (DDL): como postgres, nunca app_backend.
  const pool = getAdminPool(); // lanza error claro si falta DATABASE_URL
  const read = (f) => fs.readFileSync(path.join(__dirname, '..', '..', 'db', f), 'utf8');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    console.log('Aplicando schema.sql ...');
    await client.query(read('schema.sql'));
    console.log('Aplicando rls-policies.sql ...');
    await client.query(read('rls-policies.sql'));
    await client.query('COMMIT');
    const t = await client.query(
      "SELECT COUNT(*)::int AS tables FROM information_schema.tables WHERE table_schema='public'"
    );
    const p = await client.query(
      "SELECT COUNT(*)::int AS policies FROM pg_policies WHERE schemaname='public'"
    );
    console.log(`OK — tablas: ${t.rows[0].tables}, políticas RLS: ${p.rows[0].policies}`);
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('ERROR — nada aplicado (rollback):', e.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
})();
