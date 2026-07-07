// server.js — TextilIA Seguros API (Fase 6: base segura de backend).
// Módulos comerciales (clientes, pólizas, renovaciones, cotizaciones, WhatsApp,
// IA, reportes) NO están aquí todavía: llegan en bloques posteriores de Fase 6,
// todos detrás de requireAuth + requireRole.
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const config = require('./src/config');
const healthRouter = require('./src/routes/health');
const meRouter = require('./src/routes/me');
const { notFound, errorHandler } = require('./src/middleware/errorHandler');

const app = express();
app.disable('x-powered-by');

// ── Seguridad base ──────────────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: config.corsOrigin, methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'] }));
app.use(express.json({ limit: '1mb' }));
app.use(morgan('dev'));
app.use('/api', rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: true, code: 'RATE_LIMITED', message: 'Demasiadas peticiones, intenta más tarde.' },
}));

// ── Rutas ───────────────────────────────────────────────────────
app.use('/api', healthRouter); // pública
app.use('/api', meRouter);     // protegida (requireAuth dentro de la ruta)

// ── 404 + errores ───────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

if (require.main === module) {
  app.listen(config.port, () => {
    console.log(`TextilIA Seguros API en http://localhost:${config.port} | env: ${config.env}`);
  });
}

module.exports = app;
