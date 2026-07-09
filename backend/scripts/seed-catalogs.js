// scripts/seed-catalogs.js — Seed de DESARROLLO de catálogos (dev-only).
// Idempotente. Usa conexión ADMIN (postgres) porque debe asegurar la
// organización demo, y la tabla `organizations` no tiene política RLS de INSERT
// (solo un rol con bypass puede crearla). Los catálogos se insertan solo si no
// existen (INSERT ... WHERE NOT EXISTS). Cero datos personales/sensibles.
const { getAdminPool } = require('../src/db/pool');

const DEMO_ORG = { slug: 'demo-agencia', name: 'Agencia Demo (desarrollo)' };
const INSURERS = ['GNP', 'AXA', 'Qualitas', 'MetLife', 'Mapfre', 'Chubb'];
const LINES = [
  { slug: 'auto', name: 'Automóvil' },
  { slug: 'vida', name: 'Vida' },
  { slug: 'gmm', name: 'Gastos médicos mayores' },
  { slug: 'hogar', name: 'Hogar' },
  { slug: 'empresarial', name: 'Empresarial' },
  { slug: 'rc', name: 'Responsabilidad civil' },
];

(async () => {
  const pool = getAdminPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1) organización demo (idempotente)
    await client.query(
      `INSERT INTO organizations (slug, name) VALUES ($1, $2) ON CONFLICT (slug) DO NOTHING`,
      [DEMO_ORG.slug, DEMO_ORG.name]
    );
    const { rows: [org] } = await client.query('SELECT id FROM organizations WHERE slug = $1', [DEMO_ORG.slug]);

    // 2) aseguradoras (solo si no existen y no están borradas)
    for (const name of INSURERS) {
      await client.query(
        `INSERT INTO insurers (org_id, name)
         SELECT $1, $2
         WHERE NOT EXISTS (
           SELECT 1 FROM insurers WHERE org_id = $1 AND lower(name) = lower($2) AND deleted_at IS NULL
         )`,
        [org.id, name]
      );
    }

    // 3) ramos (solo si no existen y no están borrados)
    for (const l of LINES) {
      await client.query(
        `INSERT INTO lines_of_business (org_id, slug, name)
         SELECT $1, $2, $3
         WHERE NOT EXISTS (
           SELECT 1 FROM lines_of_business WHERE org_id = $1 AND slug = $2 AND deleted_at IS NULL
         )`,
        [org.id, l.slug, l.name]
      );
    }

    await client.query('COMMIT');

    const ni = (await client.query('SELECT COUNT(*)::int n FROM insurers WHERE org_id = $1 AND deleted_at IS NULL', [org.id])).rows[0].n;
    const nl = (await client.query('SELECT COUNT(*)::int n FROM lines_of_business WHERE org_id = $1 AND deleted_at IS NULL', [org.id])).rows[0].n;
    console.log(`seed OK — org '${DEMO_ORG.slug}' | aseguradoras: ${ni} | ramos: ${nl}`);
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('ERROR — rollback:', e.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
})();
