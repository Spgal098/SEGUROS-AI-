// scripts/run-migration.js — Ejecuta un archivo SQL en UNA transacción, con
// conexión ADMIN (postgres/DATABASE_URL, no app_backend).
// Uso:
//   node scripts/run-migration.js <archivo.sql> --dry-run   → ejecuta y ROLLBACK
//   node scripts/run-migration.js <archivo.sql> --commit    → ejecuta y COMMIT
// Sin flag explícito no hace nada (protección contra ejecuciones accidentales).
const fs = require('fs');
const path = require('path');
const { getAdminPool } = require('../src/db/pool');

const [, , file, mode] = process.argv;
if (!file || !['--dry-run', '--commit'].includes(mode)) {
  console.log('Uso: node scripts/run-migration.js <archivo.sql> --dry-run | --commit');
  process.exit(1);
}

const abs = path.isAbsolute(file) ? file : path.resolve(process.cwd(), file);

(async () => {
  // El archivo trae su propio BEGIN/COMMIT; los neutralizamos y controlamos la
  // transacción desde aquí para poder hacer dry-run (ROLLBACK).
  const sql = fs.readFileSync(abs, 'utf8').replace(/^BEGIN;/m, '').replace(/^COMMIT;\s*$/m, '');
  const pool = getAdminPool();
  const client = await pool.connect();
  const t0 = Date.now();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    if (mode === '--commit') {
      await client.query('COMMIT');
      console.log(`COMMIT OK — ${path.basename(abs)} aplicado en ${Date.now() - t0} ms`);
    } else {
      await client.query('ROLLBACK');
      console.log(`DRY-RUN OK — ${path.basename(abs)} ejecuta sin errores (${Date.now() - t0} ms); nada persistido`);
    }
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    console.error(`ERROR — rollback automático, nada aplicado: ${e.message}`);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
})();
