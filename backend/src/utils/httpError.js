// src/utils/httpError.js — Error HTTP con status y code, para el manejador central.
class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const unauthorized = (msg = 'No autenticado') => new HttpError(401, 'UNAUTHORIZED', msg);
const forbidden = (msg = 'Sin permisos suficientes') => new HttpError(403, 'FORBIDDEN', msg);

module.exports = { HttpError, unauthorized, forbidden };
