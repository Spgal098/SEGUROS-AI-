// scripts/activate-app-backend.js — Activa LOGIN de app_backend con la
// contraseña que el CEO define en backend/.env como APP_BACKEND_PASSWORD.
// El secreto NUNCA aparece en git ni se imprime. Uso: npm run role:activate
require('dotenv').config();
const { getAdminPool } = require('../src/db/pool');

(async () => {
  const pw = process.env.APP_BACKEND_PASSWORD;
  if (!pw || pw.trim() === '') {
    console.error('FALTA APP_BACKEND_PASSWORD en backend/.env. Agrégala (valor secreto) y reintenta.');
    process.exit(1);
  }
  // Operación admin: siempre como postgres (app_backend aún no puede alterarse a sí mismo).
  const pool = getAdminPool();
  const client = await pool.connect();
  try {
    // ALTER ROLE ... PASSWORD no admite bind params. Escapamos el valor en el
    // servidor con quote_literal (parametrizado, seguro) y lo interpolamos ya
    // escapado. El secreto no se imprime en ningún momento.
    const { rows } = await client.query('SELECT quote_literal($1) AS lit', [pw]);
    await client.query(`ALTER ROLE app_backend LOGIN PASSWORD ${rows[0].lit}`);
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
