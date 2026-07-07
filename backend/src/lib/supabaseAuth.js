// src/lib/supabaseAuth.js — Validación de JWT de Supabase Auth.
//
// Valida el token contra el endpoint oficial GET {SUPABASE_URL}/auth/v1/user.
// Ventaja: no requiere el JWT secret en el backend y funciona igual con JWT
// HS256 o asimétricos. Deuda técnica declarada: es una llamada de red por
// request; en un bloque posterior se puede cachear/validar con JWKS local.
const config = require('../config');

// Devuelve { id, email } si el token es válido; null si no lo es.
async function getUserFromToken(token) {
  if (!token || !config.supabase.url || !config.supabase.anonKey) return null;
  let resp;
  try {
    resp = await fetch(`${config.supabase.url}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: config.supabase.anonKey,
      },
    });
  } catch (e) {
    // Falla de red al validar → tratamos como no autenticado (el middleware
    // devuelve 401); el detalle se registra en logs, no al cliente.
    return { _networkError: e.message };
  }
  if (!resp.ok) return null;
  const user = await resp.json();
  if (!user || !user.id) return null;
  return { id: user.id, email: user.email || null };
}

module.exports = { getUserFromToken };
