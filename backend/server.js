// server.js — TextilIA Seguros API (esqueleto Fase 5: solo infraestructura).
// Los módulos de negocio llegan en Fase 6, todos detrás del middleware de auth.
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const config = require('./src/config');
const { hasDatabase } = require('./src/db/pool');

const app = express();

app.use(helmet());
app.use(cors({ origin: config.corsOrigin, methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'] }));
app.use(express.json());
app.use(morgan('dev'));
app.use('/api', rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: true, code: 'RATE_LIMITED', message: 'Demasiadas peticiones, intenta más tarde.' },
}));

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'TextilIA Seguros API',
    environment: config.env,
    database: hasDatabase() ? 'configured' : 'pending (crear proyecto Supabase de Seguros)',
    timestamp: new Date().toISOString(),
  });
});

// Fase 6: aquí se montan las rutas de negocio, SIEMPRE detrás de auth.

app.use((req, res) => {
  res.status(404).json({ error: true, code: 'NOT_FOUND', message: `Ruta no encontrada: ${req.method} ${req.originalUrl}` });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  res.status(err.status || 500).json({ error: true, code: err.code || 'INTERNAL_ERROR', message: err.message || 'Error interno' });
});

app.listen(config.port, () => {
  console.log(`TextilIA Seguros API en http://localhost:${config.port} | env: ${config.env} | DB: ${hasDatabase() ? 'configurada' : 'pendiente'}`);
});

module.exports = app;
