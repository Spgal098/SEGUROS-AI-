// src/repositories/linesOfBusiness.repository.js — CRUD de ramos de seguro.
// Mismas reglas que insurers: pool app_backend + withOrgContext (RLS),
// identidad desde req.auth, soft delete. Unicidad por (org_id, slug) parcial.
const { withOrgContext } = require('../db/pool');
const { HttpError } = require('../utils/httpError');

function mapRow(r) {
  return { id: r.id, slug: r.slug, name: r.name, active: r.active, createdAt: r.created_at, updatedAt: r.updated_at };
}

function asDuplicate(e) {
  if (e && e.code === '23505') return new HttpError(409, 'DUPLICATE', 'Ya existe un ramo con ese slug');
  return e;
}

async function list(auth, { includeInactive = false } = {}) {
  return withOrgContext(auth, async (c) => {
    const cond = includeInactive ? '' : 'AND active = true';
    const { rows } = await c.query(
      `SELECT id, slug, name, active, created_at, updated_at
         FROM lines_of_business
        WHERE deleted_at IS NULL ${cond}
        ORDER BY name`
    );
    return rows.map(mapRow);
  });
}

async function create(auth, { slug, name, active }) {
  return withOrgContext(auth, async (c) => {
    try {
      const { rows } = await c.query(
        `INSERT INTO lines_of_business (org_id, slug, name, active)
         VALUES ($1, $2, $3, COALESCE($4, true))
         RETURNING id, slug, name, active, created_at, updated_at`,
        [auth.orgId, slug, name, active]
      );
      return mapRow(rows[0]);
    } catch (e) {
      throw asDuplicate(e);
    }
  });
}

async function update(auth, id, { slug, name, active }) {
  return withOrgContext(auth, async (c) => {
    try {
      const { rows } = await c.query(
        `UPDATE lines_of_business
            SET slug = COALESCE($2, slug),
                name = COALESCE($3, name),
                active = COALESCE($4, active),
                updated_at = now()
          WHERE id = $1 AND deleted_at IS NULL
        RETURNING id, slug, name, active, created_at, updated_at`,
        [id, slug, name, active]
      );
      return rows[0] ? mapRow(rows[0]) : null;
    } catch (e) {
      throw asDuplicate(e);
    }
  });
}

async function softDelete(auth, id) {
  return withOrgContext(auth, async (c) => {
    const { rows } = await c.query(
      `UPDATE lines_of_business
          SET deleted_at = now(), active = false, updated_at = now()
        WHERE id = $1 AND deleted_at IS NULL
      RETURNING id`,
      [id]
    );
    return rows[0] ? { id: rows[0].id } : null;
  });
}

module.exports = { list, create, update, softDelete };
