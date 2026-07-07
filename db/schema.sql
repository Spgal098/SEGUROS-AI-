-- db/schema.sql — Esquema inicial de TextilIA Seguros (borrador Fase 2).
-- Destino: proyecto Supabase PROPIO de Seguros (pendiente de crear).
-- Reglas: org_id NOT NULL en toda tabla de datos; RLS activada en todas;
-- las POLÍTICAS de RLS se definen en Fase 3 junto con Supabase Auth.
-- Sin vocabulario tenant/industria: la raíz es `organizations`.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── Raíz: agencia / promotoría ────────────────────────────────────
CREATE TABLE organizations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        TEXT UNIQUE NOT NULL,
  name        TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','trial','deleted')),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Perfiles ligados a Supabase Auth (FK real a auth.users se agrega en Fase 3)
CREATE TABLE users_profiles (
  id          UUID PRIMARY KEY,               -- = auth.users.id
  org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  full_name   TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'agent' CHECK (role IN ('owner','admin','agent','readonly')),
  status      TEXT NOT NULL DEFAULT 'active',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE settings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
  config_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── Catálogos del dominio ─────────────────────────────────────────
CREATE TABLE insurers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,                  -- GNP, AXA, Qualitas, ...
  active      BOOLEAN NOT NULL DEFAULT true,
  deleted_at  TIMESTAMPTZ
);

CREATE TABLE lines_of_business (               -- ramos
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  slug        TEXT NOT NULL,                  -- vida, gmm, auto, hogar, empresarial, flotilla, rc, retiro
  name        TEXT NOT NULL,
  UNIQUE (org_id, slug)
);

-- ── Personas ──────────────────────────────────────────────────────
CREATE TABLE clients (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  kind          TEXT NOT NULL DEFAULT 'person' CHECK (kind IN ('person','company')),
  full_name     TEXT NOT NULL,
  rfc           TEXT,
  email         TEXT,
  phone         TEXT,
  city          TEXT,
  -- LFPDPPP: NO almacenar datos sensibles (salud) aquí; ver docs/ARQUITECTURA.md §7
  custom_fields JSONB DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  deleted_at    TIMESTAMPTZ
);

CREATE TABLE leads (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  client_id       UUID REFERENCES clients(id),
  contact_name    TEXT NOT NULL,
  phone           TEXT,
  email           TEXT,
  line_of_business_id UUID REFERENCES lines_of_business(id),
  intent          TEXT,
  priority        TEXT NOT NULL DEFAULT 'media' CHECK (priority IN ('alta','media','baja')),
  stage           TEXT NOT NULL DEFAULT 'nuevo',
  estimated_premium NUMERIC DEFAULT 0,
  message         TEXT,
  source          TEXT NOT NULL DEFAULT 'manual',
  assigned_to     UUID REFERENCES users_profiles(id),
  custom_fields   JSONB DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ
);

-- ── Ciclo comercial: cotización → póliza → renovación ────────────
CREATE TABLE quotes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  lead_id     UUID REFERENCES leads(id),
  client_id   UUID REFERENCES clients(id),
  line_of_business_id UUID REFERENCES lines_of_business(id),
  status      TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','accepted','rejected','expired')),
  notes       TEXT,
  created_by  UUID REFERENCES users_profiles(id),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  deleted_at  TIMESTAMPTZ
);

CREATE TABLE quote_options (                   -- una opción por aseguradora/plan
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  quote_id    UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  insurer_id  UUID REFERENCES insurers(id),
  plan_name   TEXT,
  annual_premium NUMERIC NOT NULL DEFAULT 0,
  coverage_json  JSONB DEFAULT '{}'::jsonb,
  selected    BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE policies (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  client_id      UUID NOT NULL REFERENCES clients(id),
  quote_id       UUID REFERENCES quotes(id),
  insurer_id     UUID REFERENCES insurers(id),
  line_of_business_id UUID REFERENCES lines_of_business(id),
  policy_number  TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','lapsed','cancelled','expired')),
  effective_date DATE NOT NULL,
  expiration_date DATE NOT NULL,
  annual_premium NUMERIC NOT NULL DEFAULT 0,
  payment_mode   TEXT DEFAULT 'annual' CHECK (payment_mode IN ('annual','semiannual','quarterly','monthly')),
  agent_id       UUID REFERENCES users_profiles(id),
  custom_fields  JSONB DEFAULT '{}'::jsonb,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  deleted_at     TIMESTAMPTZ,
  UNIQUE (org_id, policy_number)
);

CREATE TABLE renewals (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  policy_id   UUID NOT NULL REFERENCES policies(id) ON DELETE CASCADE,
  due_date    DATE NOT NULL,
  status      TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming','contacted','in_process','renewed','lost')),
  reminder_sent_at TIMESTAMPTZ,
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE follow_ups (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  lead_id     UUID REFERENCES leads(id),
  client_id   UUID REFERENCES clients(id),
  policy_id   UUID REFERENCES policies(id),
  kind        TEXT NOT NULL DEFAULT 'call' CHECK (kind IN ('call','whatsapp','email','meeting','other')),
  due_at      TIMESTAMPTZ,
  done_at     TIMESTAMPTZ,
  notes       TEXT,
  assigned_to UUID REFERENCES users_profiles(id),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── WhatsApp (Fase 5) ─────────────────────────────────────────────
CREATE TABLE conversations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  client_id   UUID REFERENCES clients(id),
  lead_id     UUID REFERENCES leads(id),
  wa_phone    TEXT NOT NULL,
  opt_in_at   TIMESTAMPTZ,                    -- consentimiento registrado (LFPDPPP)
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  direction       TEXT NOT NULL CHECK (direction IN ('in','out')),
  body            TEXT,
  wa_message_id   TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Actividad y reportes ──────────────────────────────────────────
CREATE TABLE activities (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  type        TEXT NOT NULL DEFAULT 'info',
  text        TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE report_metrics (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  metric_key   TEXT NOT NULL,
  metric_value TEXT NOT NULL,
  UNIQUE (org_id, metric_key)
);

CREATE TABLE audit_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id     UUID,
  action      TEXT NOT NULL,
  entity      TEXT,
  entity_id   UUID,
  detail_json JSONB DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE webhook_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID REFERENCES organizations(id),
  source      TEXT NOT NULL,
  payload     JSONB NOT NULL,
  received_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Índices ───────────────────────────────────────────────────────
CREATE INDEX idx_clients_org      ON clients(org_id)  WHERE deleted_at IS NULL;
CREATE INDEX idx_leads_org_stage  ON leads(org_id, stage) WHERE deleted_at IS NULL;
CREATE INDEX idx_policies_org_exp ON policies(org_id, expiration_date) WHERE deleted_at IS NULL;
CREATE INDEX idx_renewals_due     ON renewals(org_id, due_date, status);
CREATE INDEX idx_followups_due    ON follow_ups(org_id, due_at) WHERE done_at IS NULL;
CREATE INDEX idx_messages_conv    ON messages(conversation_id, created_at);

-- ── RLS: activada en TODAS las tablas (políticas en Fase 3) ──────
ALTER TABLE organizations     ENABLE ROW LEVEL SECURITY;
ALTER TABLE users_profiles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings          ENABLE ROW LEVEL SECURITY;
ALTER TABLE insurers          ENABLE ROW LEVEL SECURITY;
ALTER TABLE lines_of_business ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients           ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads             ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes            ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_options     ENABLE ROW LEVEL SECURITY;
ALTER TABLE policies          ENABLE ROW LEVEL SECURITY;
ALTER TABLE renewals          ENABLE ROW LEVEL SECURITY;
ALTER TABLE follow_ups        ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations     ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages          ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities        ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_metrics    ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs        ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_events    ENABLE ROW LEVEL SECURITY;
