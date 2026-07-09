// scripts/create-app-backend.js — Aplica db/migrations/app-backend-role.sql.
// Crea el rol app_backend (NOLOGIN, NOBYPASSRLS) y sus permisos mínimos.
// No maneja contraseñas. Idempotente. Uso: npm run role:create
const fs = require('fs');
const path = require('path');
const { getAdminPool } = require('../src/db/pool');

(async () => {
  // Operación admin: como postgres (crear roles requiere privilegios elevados).
  const pool = getAdminPool();
  const sql = fs.readFileSync(path.join(__dirname, '..', '..', 'db', 'migrations', 'app-backend-role.sql'), 'utf8');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    const r = await client.query('SELECT rolname, rolbypassrls, rolcanlogin FROM pg_roles WHERE rolname = $1', ['app_backend']);
    const row = r.rows[0];
    console.log('app_backend →', JSON.stringify(row));
    console.log(row && row.rolbypassrls === false ? 'OK — rol creado SIN bypassrls ✅' : 'ERROR — el rol no quedó como se esperaba ⚠');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('ERROR — nada aplicado (rollback):', e.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
})();
