// src/utils/validate.js — Validadores de entrada. Lanzan HttpError 400.
const { HttpError } = require('./httpError');

const badRequest = (msg) => new HttpError(400, 'VALIDATION_ERROR', msg);

// String requerido, con trim y límites de longitud.
function requireString(value, field, { min = 1, max = 200 } = {}) {
  if (typeof value !== 'string') throw badRequest(`${field} es requerido`);
  const t = value.trim();
  if (t.length < min) throw badRequest(`${field} es requerido`);
  if (t.length > max) throw badRequest(`${field} no debe exceder ${max} caracteres`);
  return t;
}

// Boolean opcional: undefined pasa; cualquier otro no-boolean falla.
function optionalBoolean(value, field) {
  if (value === undefined) return undefined;
  if (typeof value !== 'boolean') throw badRequest(`${field} debe ser booleano`);
  return value;
}

// slug: minúsculas, números y guiones, 2–40.
function requireSlug(value) {
  const t = requireString(value, 'slug', { min: 2, max: 40 });
  if (!/^[a-z0-9-]{2,40}$/.test(t)) {
    throw badRequest('slug: solo minúsculas, números y guiones (2-40 caracteres)');
  }
  return t;
}

module.exports = { badRequest, requireString, optionalBoolean, requireSlug };
