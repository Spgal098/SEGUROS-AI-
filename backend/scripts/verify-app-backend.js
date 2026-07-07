// scripts/verify-app-backend.js — Prueba que RLS se aplica REALMENTE bajo un
// rol sin BYPASSRLS. Inserta datos de dos organizaciones dentro de una
// transacción, hace SET ROLE app_backend y comprueba que solo ve la org de su
// contexto. Todo se revierte con ROLLBACK (no persiste nada).
const crypto = require('crypto');
const { getPool } = require('../src/db/pool');

(async () => {
  const pool = getPool();
  let fail = 0;
  const check = (n, ok, x = '') => { console.log(`  ${ok ? 'OK ' : 'FALLA'} · ${n}${x ? ' → ' + x : ''}`); if (!ok) fail++; };

  // 0. El rol existe y NO tiene bypass
  const role = (await pool.query("SELECT rolbypassrls, rolcanlogin FROM pg_roles WHERE rolname='app_backend'")).rows[0];
  check('app_backend existe', !!role);
  check('app_backend SIN bypassrls', role && role.rolbypassrls === false, role ? `bypassrls=${role.rolbypassrls}` : 'n/a');

  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    // Sembramos 2 orgs + 1 cliente en cada una (como postgres, bypass).
    const o1 = crypto.randomUUID(); const o2 = crypto.randomUUID();
    await c.query("INSERT INTO organizations(id,slug,name) VALUES ($1,$2,'Org Uno'),($3,$4,'Org Dos')", [o1, 'o1-' + o1.slice(0, 8), o2, 'o2-' + o2.slice(0, 8)]);
    await c.query("INSERT INTO clients(org_id,full_name) VALUES ($1,'Cliente A'),($2,'Cliente B')", [o1, o2]);

    // Cambiamos al rol sin bypass.
    await c.query('SET LOCAL ROLE app_backend');

    // Contexto = org1 → solo debe ver 1 cliente (el de org1)
    await c.query("SELECT set_config('app.org_id',$1,true)", [o1]);
    await c.query("SELECT set_config('app.role','agent',true)");
    const nOrg1 = (await c.query('SELECT COUNT(*)::int n FROM clients')).rows[0].n;
    check('contexto=org1 ve solo su cliente', nOrg1 === 1, `${nOrg1} (esperado 1)`);

    // Contexto = org2 → ve el otro cliente, no el de org1
    await c.query("SELECT set_config('app.org_id',$1,true)", [o2]);
    const nOrg2 = (await c.query('SELECT COUNT(*)::int n FROM clients')).rows[0].n;
    check('contexto=org2 ve solo su cliente', nOrg2 === 1, `${nOrg2} (esperado 1)`);

    // Sin contexto → 0 filas (falla cerrada)
    await c.query("SELECT set_config('app.org_id','',true)");
    const nNone = (await c.query('SELECT COUNT(*)::int n FROM clients')).rows[0].n;
    check('sin contexto ve 0 (falla cerrada)', nNone === 0, `${nNone} (esperado 0)`);

    // org_id inyectado que no es el suyo → 0 (no puede ver otra org)
    await c.query("SELECT set_config('app.org_id',$1,true)", [crypto.randomUUID()]);
    const nFake = (await c.query('SELECT COUNT(*)::int n FROM clients')).rows[0].n;
    check('org_id ajeno inyectado ve 0', nFake === 0, `${nFake} (esperado 0)`);

    await c.query('RESET ROLE');
    await c.query('ROLLBACK');
  } catch (e) {
    await c.query('ROLLBACK').catch(() => {});
    check('prueba RLS con app_backend', false, e.message);
  } finally {
    c.release();
  }

  await pool.end();
  console.log(fail === 0 ? '\nRESULTADO: RLS aplicada bajo app_backend ✅' : `\nRESULTADO: ${fail} FALLA(S) ⚠`);
  process.exit(fail === 0 ? 0 : 1);
})();
