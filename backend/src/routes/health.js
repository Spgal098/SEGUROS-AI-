// src/routes/health.js — Endpoint público de salud (sin auth).
const { Router } = require('express');
const config = require('../config');
const { hasDatabase } = require('../db/pool');

const router = Router();

router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'TextilIA Seguros API',
    environment: config.env,
    database: hasDatabase() ? 'configured' : 'pending',
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
