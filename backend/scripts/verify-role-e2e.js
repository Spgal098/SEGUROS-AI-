// scripts/verify-role-e2e.js — Verifica RLS END-TO-END desde la conexión REAL
// del backend (rol app_backend, sin bypass). Siembra 2 orgs con un pool admin
// (postgres), consulta con el pool de la app respetando el contexto, y limpia.
const crypto = require('crypto');
const { getPool, getAdminPool, withOrgContext } = require('../src/db/pool');

(async () => {
  const app = getPool();     // app_backend (si APP_BACKEND_DATABASE_URL está puesta)
  const admin = getAdminPool(); // postgres, solo para sembrar/limpiar
  let fail = 0;
  const check = (n, ok, x = '') => { console.log(`  ${ok ? 'OK ' : 'FALLA'} · ${n}${x ? ' → ' + x : ''}`); if (!ok) fail++; };

  // 0. El backend conecta como app_backend, sin bypass
  const who = (await app.query('SELECT current_user AS u')).rows[0].u;
  check('backend conecta como app_backend', who === 'app_backend', who);
  const rb = (await app.query('SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user')).rows[0].rolbypassrls;
  check('el rol de conexión NO tiene bypassrls', rb === false, `bypassrls=${rb}`);

  // Semilla (admin/bypass): 2 orgs + 1 cliente cada una
  const o1 = crypto.randomUUID(), o2 = crypto.randomUUID();
  await admin.query("INSERT INTO organizations(id,slug,name) VALUES ($1,$2,'E2E Uno'),($3,$4,'E2E Dos')",
    [o1, 'e2e1-' + o1.slice(0, 8), o2, 'e2e2-' + o2.slice(0, 8)]);
  await admin.query("INSERT INTO clients(org_id,full_name) VALUES ($1,'Cliente E2E A'),($2,'Cliente E2E B')", [o1, o2]);

  try {
    // Contexto org1 → 1 cliente
    const n1 = await withOrgContext({ orgId: o1, role: 'agent' }, async (c) =>
      (await c.query('SELECT COUNT(*)::int n FROM clients')).rows[0].n);
    check('contexto org1 ve solo su cliente', n1 === 1, `${n1}`);

    // Contexto org2 → 1 cliente (el otro)
    const n2 = await withOrgContext({ orgId: o2, role: 'agent' }, async (c) =>
      (await c.query('SELECT COUNT(*)::int n FROM clients')).rows[0].n);
    check('contexto org2 ve solo su cliente', n2 === 1, `${n2}`);

    // Sin contexto → 0 (falla cerrada)
    const n0 = await withOrgContext({ orgId: '', role: '' }, async (c) =>
      (await c.query('SELECT COUNT(*)::int n FROM clients')).rows[0].n);
    check('sin contexto de organización ve 0', n0 === 0, `${n0}`);

    // org_id ajeno → 0
    const nf = await withOrgContext({ orgId: crypto.randomUUID(), role: 'agent' }, async (c) =>
      (await c.query('SELECT COUNT(*)::int n FROM clients')).rows[0].n);
    check('org_id ajeno inyectado ve 0', nf === 0, `${nf}`);
  } finally {
    // Limpieza (admin): borra lo sembrado
    await admin.query('DELETE FROM clients WHERE org_id = ANY($1)', [[o1, o2]]);
    await admin.query('DELETE FROM organizations WHERE id = ANY($1)', [[o1, o2]]);
    await app.end();
    await admin.end();
  }

  console.log(fail === 0 ? '\nRESULTADO: RLS end-to-end desde app_backend ✅' : `\nRESULTADO: ${fail} FALLA(S) ⚠`);
  process.exit(fail === 0 ? 0 : 1);
})();
