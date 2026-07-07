-- db/rls-policies.sql — Políticas RLS de TextilIA Seguros (Fase 3).
-- Ejecutar DESPUÉS de schema.sql en el proyecto Supabase PROPIO de Seguros.
-- Diseño: docs/AUTH_Y_PERMISOS.md. RLS ya viene ENABLED desde schema.sql.

-- ── Helpers de identidad dual (JWT de Supabase o backend-pool) ────
CREATE OR REPLACE FUNCTION app_org_id() RETURNS uuid AS $$
  SELECT COALESCE(
    (SELECT org_id FROM users_profiles WHERE id = auth.uid()),
    NULLIF(current_setting('app.org_id', true), '')::uuid
  )
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION app_role() RETURNS text AS $$
  SELECT COALESCE(
    (SELECT role FROM users_profiles WHERE id = auth.uid()),
    NULLIF(current_setting('app.role', true), '')
  )
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ── organizations / users_profiles ────────────────────────────────
CREATE POLICY org_self_select ON organizations FOR SELECT
  USING (id = app_org_id());
CREATE POLICY org_self_update ON organizations FOR UPDATE
  USING (id = app_org_id() AND app_role() IN ('owner','admin'));

CREATE POLICY profiles_select ON users_profiles FOR SELECT
  USING (org_id = app_org_id());
CREATE POLICY profiles_insert ON users_profiles FOR INSERT
  WITH CHECK (org_id = app_org_id() AND app_role() IN ('owner','admin'));
CREATE POLICY profiles_update ON users_profiles FOR UPDATE
  USING (org_id = app_org_id() AND app_role() IN ('owner','admin'));

-- ── Catálogos y configuración: escritura owner/admin ──────────────
DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY['settings','insurers','lines_of_business',
                               'activities','report_metrics'])
  LOOP
    EXECUTE format($f$CREATE POLICY sel ON %I FOR SELECT
                     USING (org_id = app_org_id())$f$, t);
    EXECUTE format($f$CREATE POLICY ins ON %I FOR INSERT
                     WITH CHECK (org_id = app_org_id() AND app_role() IN ('owner','admin'))$f$, t);
    EXECUTE format($f$CREATE POLICY upd ON %I FOR UPDATE
                     USING (org_id = app_org_id() AND app_role() IN ('owner','admin'))$f$, t);
    EXECUTE format($f$CREATE POLICY del ON %I FOR DELETE
                     USING (org_id = app_org_id() AND app_role() IN ('owner','admin'))$f$, t);
  END LOOP;
END $$;

-- ── Datos operativos: escritura agent+, borrado owner/admin ──────
DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY['clients','leads','quotes','quote_options',
                               'policies','renewals','follow_ups',
                               'conversations','messages'])
  LOOP
    EXECUTE format($f$CREATE POLICY sel ON %I FOR SELECT
                     USING (org_id = app_org_id())$f$, t);
    EXECUTE format($f$CREATE POLICY ins ON %I FOR INSERT
                     WITH CHECK (org_id = app_org_id()
                       AND app_role() IN ('owner','admin','agent'))$f$, t);
    EXECUTE format($f$CREATE POLICY upd ON %I FOR UPDATE
                     USING (org_id = app_org_id()
                       AND app_role() IN ('owner','admin','agent'))$f$, t);
    EXECUTE format($f$CREATE POLICY del ON %I FOR DELETE
                     USING (org_id = app_org_id() AND app_role() IN ('owner','admin'))$f$, t);
  END LOOP;
END $$;

-- ── Auditoría y webhooks: lectura admin+, sin update/delete ──────
CREATE POLICY sel ON audit_logs FOR SELECT
  USING (org_id = app_org_id() AND app_role() IN ('owner','admin'));
CREATE POLICY ins ON audit_logs FOR INSERT
  WITH CHECK (org_id = app_org_id());

CREATE POLICY sel ON webhook_events FOR SELECT
  USING (org_id = app_org_id() AND app_role() IN ('owner','admin'));
CREATE POLICY ins ON webhook_events FOR INSERT
  WITH CHECK (org_id = app_org_id() OR org_id IS NULL);
