// src/middleware/authorize.js — Autorización por rol.
// Debe usarse SIEMPRE después de requireAuth (necesita req.auth).
// Jerarquía de roles de Seguros (schema Fase 2): owner > admin > agent > readonly.
const { forbidden, unauthorized } = require('../utils/httpError');

const ROLE_RANK = { owner: 4, admin: 3, agent: 2, readonly: 1 };

// requireRole('admin') → owner/admin pasan; agent/readonly → 403.
// requireRole('agent','admin') → lista explícita permitida.
function requireRole(...allowed) {
  const minRank = allowed.length === 1 ? ROLE_RANK[allowed[0]] : null;
  return (req, res, next) => {
    if (!req.auth) return next(unauthorized());
    const rank = ROLE_RANK[req.auth.role] || 0;
    const ok = minRank ? rank >= minRank : allowed.includes(req.auth.role);
    if (!ok) return next(forbidden(`Requiere rol ${allowed.join(' o ')}`));
    next();
  };
}

module.exports = { requireRole, ROLE_RANK };
