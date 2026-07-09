// scripts/verify-catalogs.js — Verifica el CRUD de catálogos a nivel repos+RLS
// usando la conexión real de la app (app_backend, sin bypass). Siembra 2 orgs
// con un pool admin, opera con contextos de auth sintéticos (sin JWT real) y
// limpia todo al final. NO depende de un usuario Supabase real.
const crypto = require('crypto');
const { getPool, getAdminPool } = require('../src/db/pool');
const insurers = require('../src/repositories/insurers.repository');
const lob = require('../src/repositories/linesOfBusiness.repository');

(async () => {
  const app = getPool();
  const admin = getAdminPool();
  let fail = 0;
  const check = (n, ok, x = '') => { console.log(`  ${ok ? 'OK ' : 'FALLA'} · ${n}${x ? ' → ' + x : ''}`); if (!ok) fail++; };
  const expectThrow = async (n, fn, code) => {
    try { await fn(); check(n, false, 'no lanzó'); }
    catch (e) { check(n, e.code === code || e.status === 409, `${e.code || e.status}`); }
  };

  // Conexión segura
  const who = (await app.query('SELECT current_user u')).rows[0].u;
  const rb = (await app.query('SELECT rolbypassrls FROM pg_roles WHERE rolname=current_user')).rows[0].rolbypassrls;
  check('current_user = app_backend', who === 'app_backend', who);
  check('app_backend sin bypassrls', rb === false, `bypassrls=${rb}`);

  // 2 orgs de prueba (admin/bypass)
  const o1 = crypto.randomUUID(), o2 = crypto.randomUUID();
  await admin.query("INSERT INTO organizations(id,slug,name) VALUES ($1,$2,'Cat Uno'),($3,$4,'Cat Dos')",
    [o1, 'c1-' + o1.slice(0, 8), o2, 'c2-' + o2.slice(0, 8)]);
  const a1 = { orgId: o1, role: 'admin' };
  const a2 = { orgId: o2, role: 'admin' };
  const noCtx = { orgId: '', role: '' };

  try {
    // ── insurers ──
    const ins = await insurers.create(a1, { name: 'GNP' });
    check('insurer creado en org1', !!ins.id);
    check('org1 ve su insurer', (await insurers.list(a1)).length === 1);
    check('org2 NO ve el insurer de org1', (await insurers.list(a2)).length === 0);
    check('sin contexto no ve insurers (falla cerrada)', (await insurers.list(noCtx)).length === 0);
    await expectThrow('insurer duplicado → 409', () => insurers.create(a1, { name: 'gnp' }), 'DUPLICATE'); // case-insensitive
    check('update de org ajena no afecta (null→404)', (await insurers.update(a2, ins.id, { name: 'X' })) === null);
    check('soft delete insurer', (await insurers.softDelete(a1, ins.id)) !== null);
    check('insurer borrado deja de listarse', (await insurers.list(a1)).length === 0);

    // ── lines_of_business ──
    const r = await lob.create(a1, { slug: 'auto', name: 'Autos' });
    check('ramo creado en org1', !!r.id);
    check('org1 ve su ramo', (await lob.list(a1)).length === 1);
    check('org2 NO ve el ramo de org1', (await lob.list(a2)).length === 0);
    await expectThrow('ramo slug duplicado → 409', () => lob.create(a1, { slug: 'auto', name: 'Auto 2' }), 'DUPLICATE');
    check('soft delete ramo', (await lob.softDelete(a1, r.id)) !== null);
    check('ramo borrado deja de listarse', (await lob.list(a1)).length === 0);
    // tras borrar, el slug puede reutilizarse (índice parcial)
    check('slug reutilizable tras borrado', !!(await lob.create(a1, { slug: 'auto', name: 'Autos v2' })).id);
  } finally {
    await admin.query('DELETE FROM organizations WHERE id = ANY($1)', [[o1, o2]]); // cascade
    await app.end();
    await admin.end();
  }

  console.log(fail === 0 ? '\nRESULTADO: catálogos OK ✅' : `\nRESULTADO: ${fail} FALLA(S) ⚠`);
  process.exit(fail === 0 ? 0 : 1);
})();
