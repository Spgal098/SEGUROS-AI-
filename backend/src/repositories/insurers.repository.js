// src/repositories/insurers.repository.js — CRUD de aseguradoras.
// Usa el pool de la APP (app_backend, sin bypass) vía withOrgContext, de modo
// que TODAS las consultas respetan RLS. org_id y role vienen de req.auth
// (perfil), nunca del body/query. Soft delete con deleted_at.
const { withOrgContext } = require('../db/pool');
const { HttpError } = require('../utils/httpError');

function mapRow(r) {
  return { id: r.id, name: r.name, active: r.active, createdAt: r.created_at, updatedAt: r.updated_at };
}

// Traduce la violación del índice único parcial a un 409 claro.
function asDuplicate(e) {
  if (e && e.code === '23505') return new HttpError(409, 'DUPLICATE', 'Ya existe una aseguradora con ese nombre');
  return e;
}

async function list(auth, { includeInactive = false } = {}) {
  return withOrgContext(auth, async (c) => {
    const cond = includeInactive ? '' : 'AND active = true';
    const { rows } = await c.query(
      `SELECT id, name, active, created_at, updated_at
         FROM insurers
        WHERE deleted_at IS NULL ${cond}
        ORDER BY name`
    );
    return rows.map(mapRow);
  });
}

async function create(auth, { name, active }) {
  return withOrgContext(auth, async (c) => {
    try {
      const { rows } = await c.query(
        `INSERT INTO insurers (org_id, name, active)
         VALUES ($1, $2, COALESCE($3, true))
         RETURNING id, name, active, created_at, updated_at`,
        [auth.orgId, name, active]
      );
      return mapRow(rows[0]);
    } catch (e) {
      throw asDuplicate(e);
    }
  });
}

async function update(auth, id, { name, active }) {
  return withOrgContext(auth, async (c) => {
    try {
      const { rows } = await c.query(
        `UPDATE insurers
            SET name = COALESCE($2, name),
                active = COALESCE($3, active),
                updated_at = now()
          WHERE id = $1 AND deleted_at IS NULL
        RETURNING id, name, active, created_at, updated_at`,
        [id, name, active]
      );
      return rows[0] ? mapRow(rows[0]) : null; // null → la ruta responde 404
    } catch (e) {
      throw asDuplicate(e);
    }
  });
}

async function softDelete(auth, id) {
  return withOrgContext(auth, async (c) => {
    const { rows } = await c.query(
      `UPDATE insurers
          SET deleted_at = now(), active = false, updated_at = now()
        WHERE id = $1 AND deleted_at IS NULL
      RETURNING id`,
      [id]
    );
    return rows[0] ? { id: rows[0].id } : null;
  });
}

module.exports = { list, create, update, softDelete };
