// scripts/activate-app-backend.js — Activa LOGIN de app_backend con la
// contraseña que el CEO define en backend/.env como APP_BACKEND_PASSWORD.
// El secreto NUNCA aparece en git ni se imprime. Uso: npm run role:activate
require('dotenv').config();
const { getPool } = require('../src/db/pool');

(async () => {
  const pw = process.env.APP_BACKEND_PASSWORD;
  if (!pw || pw.trim() === '') {
    console.error('FALTA APP_BACKEND_PASSWORD en backend/.env. Agrégala (valor secreto) y reintenta.');
    process.exit(1);
  }
  const pool = getPool();
  const client = await pool.connect();
  try {
    // Formato parametrizado imposible para ALTER ROLE ... PASSWORD; se usa
    // quote_literal en el servidor para escapar de forma segura sin loguear el valor.
    await client.query(
      "DO $do$ BEGIN EXECUTE 'ALTER ROLE app_backend LOGIN PASSWORD ' || quote_literal($1); END $do$",
      [pw]
    );
    const r = await client.query('SELECT rolcanlogin, rolbypassrls FROM pg_roles WHERE rolname = $1', ['app_backend']);
    console.log('app_backend →', JSON.stringify(r.rows[0]));
    console.log('OK — LOGIN activado. Ahora define APP_BACKEND_DATABASE_URL en .env con este rol.');
  } catch (e) {
    console.error('ERROR:', e.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
})();
