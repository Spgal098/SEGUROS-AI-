// src/middleware/auth.js — Autenticación (Supabase Auth).
// requireAuth: exige un JWT válido + un perfil activo. Deja en req.auth la
// identidad de confianza: { userId, email, orgId, role }. El org_id/role NUNCA
// se toman del request del cliente, solo del perfil en la base.
const { getUserFromToken } = require('../lib/supabaseAuth');
const { getActiveProfileByUserId } = require('../repositories/profiles.repository');
const { unauthorized, forbidden } = require('../utils/httpError');

function extractBearer(req) {
  const h = req.headers.authorization || '';
  const [scheme, token] = h.split(' ');
  return scheme === 'Bearer' && token ? token : null;
}

async function requireAuth(req, res, next) {
  try {
    const token = extractBearer(req);
    if (!token) throw unauthorized('Falta el token de sesión');

    const user = await getUserFromToken(token);
    if (user && user._networkError) {
      // Falla al contactar Supabase Auth: no podemos afirmar identidad → 401.
      req.log?.warn?.(`auth: fallo de red validando token: ${user._networkError}`);
      throw unauthorized('No se pudo validar la sesión');
    }
    if (!user) throw unauthorized('Token inválido o expirado');

    const profile = await getActiveProfileByUserId(user.id);
    if (!profile) throw forbidden('Usuario sin perfil activo en la organización');

    req.auth = {
      userId: profile.id,
      email: user.email,
      orgId: profile.org_id,
      role: profile.role,
      fullName: profile.full_name,
      orgSlug: profile.org_slug,
      orgName: profile.org_name,
    };
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { requireAuth };
