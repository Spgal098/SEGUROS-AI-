// src/repositories/profiles.repository.js — Acceso a users_profiles.
// El perfil liga al usuario de Supabase Auth (id = auth.users.id) con su
// organización y rol. Fuente de verdad de org_id/role para todo el backend.
const { query } = require('../db/pool');

// Devuelve el perfil activo o null. Incluye datos de la organización.
async function getActiveProfileByUserId(userId) {
  const { rows } = await query(
    `SELECT p.id, p.org_id, p.role, p.status, p.full_name,
            o.slug AS org_slug, o.name AS org_name
       FROM users_profiles p
       JOIN organizations o ON o.id = p.org_id
      WHERE p.id = $1 AND p.status = 'active'`,
    [userId]
  );
  return rows[0] || null;
}

module.exports = { getActiveProfileByUserId };
