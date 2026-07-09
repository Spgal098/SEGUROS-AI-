// src/routes/linesOfBusiness.js — Rutas de ramos de seguro.
// GET: requireAuth. POST/PUT/DELETE: + requireRole('admin') (owner incluido).
const { Router } = require('express');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/authorize');
const { requireString, requireSlug, optionalBoolean } = require('../utils/validate');
const { HttpError } = require('../utils/httpError');
const repo = require('../repositories/linesOfBusiness.repository');

const router = Router();

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const includeInactive = req.query.includeInactive === 'true';
    res.json({ linesOfBusiness: await repo.list(req.auth, { includeInactive }) });
  } catch (e) { next(e); }
});

router.post('/', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const body = req.body || {};
    const slug = requireSlug(body.slug);
    const name = requireString(body.name, 'name', { max: 120 });
    const active = optionalBoolean(body.active, 'active');
    res.status(201).json({ lineOfBusiness: await repo.create(req.auth, { slug, name, active }) });
  } catch (e) { next(e); }
});

router.put('/:id', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const body = req.body || {};
    const slug = body.slug === undefined ? undefined : requireSlug(body.slug);
    const name = body.name === undefined ? undefined : requireString(body.name, 'name', { max: 120 });
    const active = optionalBoolean(body.active, 'active');
    if (slug === undefined && name === undefined && active === undefined) {
      throw new HttpError(400, 'VALIDATION_ERROR', 'Nada que actualizar (slug, name o active)');
    }
    const updated = await repo.update(req.auth, req.params.id, { slug, name, active });
    if (!updated) throw new HttpError(404, 'NOT_FOUND', 'Ramo no encontrado');
    res.json({ lineOfBusiness: updated });
  } catch (e) { next(e); }
});

router.delete('/:id', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const deleted = await repo.softDelete(req.auth, req.params.id);
    if (!deleted) throw new HttpError(404, 'NOT_FOUND', 'Ramo no encontrado');
    res.json({ ok: true, id: deleted.id });
  } catch (e) { next(e); }
});

module.exports = router;
