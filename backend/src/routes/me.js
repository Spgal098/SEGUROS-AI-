// src/routes/me.js — Identidad del usuario autenticado.
// Protegido por requireAuth: solo devuelve datos del propio req.auth (nunca
// acepta un id/org del cliente).
const { Router } = require('express');
const { requireAuth } = require('../middleware/auth');

const router = Router();

router.get('/me', requireAuth, (req, res) => {
  const { userId, email, orgId, role, fullName, orgSlug, orgName } = req.auth;
  res.json({
    user: { id: userId, email, fullName },
    organization: { id: orgId, slug: orgSlug, name: orgName },
    role,
  });
});

module.exports = router;
