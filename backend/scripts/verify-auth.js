// scripts/verify-auth.js — Verificación de la base de auth (Fase 6, Seguros).
// Ejecuta comprobaciones DETERMINISTAS de la capa de seguridad:
//  - carga de perfil inexistente → null (rama 403 de requireAuth)
//  - helpers RLS bajo un rol SIN bypass (authenticated) devuelven el contexto
//  - conteo de tablas / políticas / RLS activa
// Las pruebas HTTP (401 sin token, 401 token inválido) se hacen aparte con curl.
const crypto = require('crypto');
const { getPool } = require('../src/db/pool');
const { getActiveProfileByUserId } = require('../src/repositories/profiles.repository');

(async () => {
  const pool = getPool();
  let fail = 0;
  const check = (name, ok, extra = '') => {
    console.log(`  ${ok ? 'OK ' : 'FALLA'} · ${name}${extra ? ' → ' + extra : ''}`);
    if (!ok) fail++;
  };

  // A. Perfil inexistente → null (esto es lo que dispara el 403 en requireAuth)
  const randomId = crypto.randomUUID();
  const profile = await getActiveProfileByUserId(randomId);
  check('perfil de UUID aleatorio es null (rama 403)', profile === null);

  // B. Integridad del esquema
  const t = (await pool.query("SELECT COUNT(*)::int n FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'")).rows[0].n;
  const p = (await pool.query("SELECT COUNT(*)::int n FROM pg_policies WHERE schemaname='public'")).rows[0].n;
  const rls = (await pool.query("SELECT COUNT(*)::int n FROM pg_class c JOIN pg_namespace ns ON ns.oid=c.relnamespace WHERE ns.nspname='public' AND c.relkind='r' AND c.relrowsecurity=true")).rows[0].n;
  check('18 tablas', t === 18, String(t));
  check('65 políticas', p === 65, String(p));
  check('RLS activa en todas', rls === t, `${rls}/${t}`);

  // C. La conexión de la app (app_backend cuando está activado) NO debe tener
  //    bypass, y los helpers de identidad deben reflejar el contexto fijado.
  //    (La prueba de aislamiento de filas con datos reales vive en
  //    verify-role-e2e.js, que corre como app_backend end-to-end.)
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const who = (await client.query('SELECT current_user AS u')).rows[0].u;
    const rb = (await client.query('SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user')).rows[0].rolbypassrls;
    const fakeOrg = crypto.randomUUID();
    await client.query("SELECT set_config('app.org_id', $1, true)", [fakeOrg]);
    await client.query("SELECT set_config('app.role', 'agent', true)");
    const org = (await client.query('SELECT app_org_id() AS v')).rows[0].v;
    const role = (await client.query('SELECT app_role() AS v')).rows[0].v;
    await client.query('ROLLBACK');
    check(`conexión de la app (${who}) sin bypassrls`, rb === false, `bypassrls=${rb}`);
    check('app_org_id() refleja el contexto fijado', org === fakeOrg);
    check('app_role() refleja el contexto fijado', role === 'agent');
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    check('verificación de helpers de identidad', false, e.message);
  } finally {
    client.release();
  }

  await pool.end();
  console.log(fail === 0 ? '\nRESULTADO: TODO OK ✅' : `\nRESULTADO: ${fail} FALLA(S) ⚠`);
  process.exit(fail === 0 ? 0 : 1);
})();
