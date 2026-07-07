// src/middleware/errorHandler.js — Manejo central de errores y 404.
// No expone stack traces al cliente; en producción tampoco el message interno
// de errores 500 (posible fuga de detalles). Registra el error en el servidor.
const config = require('../config');

function notFound(req, res) {
  res.status(404).json({
    error: true,
    code: 'NOT_FOUND',
    message: `Ruta no encontrada: ${req.method} ${req.originalUrl}`,
  });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const status = err.status || 500;
  const code = err.code || 'INTERNAL_ERROR';

  // Log en servidor (con stack), nunca al cliente.
  if (status >= 500) console.error(`[error] ${code}:`, err.stack || err.message);

  // 5xx en producción: mensaje genérico. 4xx: mensaje seguro y accionable.
  const isServer = status >= 500;
  const message = isServer && config.env === 'production'
    ? 'Error interno'
    : err.message || 'Error interno';

  res.status(status).json({ error: true, code, message });
}

module.exports = { notFound, errorHandler };
