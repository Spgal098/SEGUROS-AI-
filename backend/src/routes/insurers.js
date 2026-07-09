// src/routes/insurers.js — Rutas de aseguradoras.
// GET: requireAuth (lectura autenticada). POST/PUT/DELETE: + requireRole('admin')
// (owner también pasa por la jerarquía owner>admin). Soft delete.
const { Router } = require('express');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/authorize');
const { requireString, optionalBoolean } = require('../utils/validate');
const { HttpError } = require('../utils/httpError');
const repo = require('../repositories/insurers.repository');

const router = Router();

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const includeInactive = req.query.includeInactive === 'true';
    res.json({ insurers: await repo.list(req.auth, { includeInactive }) });
  } catch (e) { next(e); }
});

router.post('/', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const body = req.body || {};
    const name = requireString(body.name, 'name', { max: 120 });
    const active = optionalBoolean(body.active, 'active');
    res.status(201).json({ insurer: await repo.create(req.auth, { name, active }) });
  } catch (e) { next(e); }
});

router.put('/:id', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const body = req.body || {};
    const name = body.name === undefined ? undefined : requireString(body.name, 'name', { max: 120 });
    const active = optionalBoolean(body.active, 'active');
    if (name === undefined && active === undefined) {
      throw new HttpError(400, 'VALIDATION_ERROR', 'Nada que actualizar (name o active)');
    }
    const updated = await repo.update(req.auth, req.params.id, { name, active });
    if (!updated) throw new HttpError(404, 'NOT_FOUND', 'Aseguradora no encontrada');
    res.json({ insurer: updated });
  } catch (e) { next(e); }
});

router.delete('/:id', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const deleted = await repo.softDelete(req.auth, req.params.id);
    if (!deleted) throw new HttpError(404, 'NOT_FOUND', 'Aseguradora no encontrada');
    res.json({ ok: true, id: deleted.id });
  } catch (e) { next(e); }
});

module.exports = router;
