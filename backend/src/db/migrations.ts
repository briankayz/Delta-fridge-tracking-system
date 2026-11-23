// Append-only list of schema migrations. Never edit an applied entry; add a new one.
// Statements are separated by a semicolon at end of line.
export const MIGRATIONS: string[] = [
  /* 1: core schema */ `
CREATE TABLE retailers (
  id            text PRIMARY KEY,
  name          text NOT NULL,
  region        text NOT NULL DEFAULT 'Harare',
  address       text,
  contact_name  text,
  contact_phone text,
  lat           double precision,
  lng           double precision,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE assets (
  id                 text PRIMARY KEY,
  cooler_serial      text,
  model              text NOT NULL DEFAULT 'Display cooler',
  asset_type         text NOT NULL DEFAULT 'Display cooler',
  imei               text,
  retailer_id        text REFERENCES retailers(id),
  anchor_lat         double precision NOT NULL,
  anchor_lng         double precision NOT NULL,
  geofence_radius_m  integer NOT NULL DEFAULT 50 CHECK (geofence_radius_m BETWEEN 5 AND 5000),
  open_hour          smallint NOT NULL DEFAULT 7 CHECK (open_hour BETWEEN 0 AND 23),
  close_hour         smallint NOT NULL DEFAULT 22 CHECK (close_hour BETWEEN 0 AND 23),
  status             text NOT NULL DEFAULT 'active' CHECK (status IN ('active','decommissioned')),
  is_virtual         boolean NOT NULL DEFAULT false,
  demo_scenario      text,
  device_token_hash  text,
  provisioned_at     timestamptz,
  provisioned_by     text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX assets_retailer_idx ON assets (retailer_id);

CREATE TABLE asset_state (
  asset_id          text PRIMARY KEY REFERENCES assets(id) ON DELETE CASCADE,
  lat               double precision,
  lng               double precision,
  speed_kmh         double precision NOT NULL DEFAULT 0,
  bearing_deg       double precision NOT NULL DEFAULT 0,
  distance_m        double precision NOT NULL DEFAULT 0,
  internal_temp_c   double precision,
  mains_connected   boolean NOT NULL DEFAULT true,
  mains_off_since   timestamptz,
  voltage_ac        double precision,
  battery_pct       double precision,
  device_status     text,
  last_seen         timestamptz,
  risk_score        integer NOT NULL DEFAULT 0,
  severity          text NOT NULL DEFAULT 'nominal',
  confidence        integer NOT NULL DEFAULT 0,
  geofence_breached boolean NOT NULL DEFAULT false,
  reasons           jsonb NOT NULL DEFAULT '[]'::jsonb,
  calm_count        integer NOT NULL DEFAULT 0
);

CREATE TABLE telemetry (
  id              bigserial PRIMARY KEY,
  asset_id        text NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  received_at     timestamptz NOT NULL DEFAULT now(),
  lat             double precision NOT NULL,
  lng             double precision NOT NULL,
  speed_kmh       double precision NOT NULL,
  battery_pct     double precision,
  mains_connected boolean NOT NULL,
  internal_temp_c double precision,
  risk_score      integer NOT NULL,
  severity        text NOT NULL,
  payload         jsonb NOT NULL
);
CREATE INDEX telemetry_asset_time_idx ON telemetry (asset_id, received_at DESC);

CREATE TABLE users (
  id            text PRIMARY KEY,
  email         text NOT NULL UNIQUE,
  name          text NOT NULL,
  phone         text,
  role          text NOT NULL CHECK (role IN ('admin','ops_lead','area_manager','asset_protection','technician','viewer')),
  region        text,
  password_hash text NOT NULL,
  active        boolean NOT NULL DEFAULT true,
  token_version integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz
);

CREATE SEQUENCE incident_seq START 1001;

CREATE TABLE incidents (
  id              text PRIMARY KEY,
  asset_id        text NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  kind            text NOT NULL CHECK (kind IN ('displacement','power','signal_lost')),
  severity        text NOT NULL,
  status          text NOT NULL DEFAULT 'open' CHECK (status IN ('open','acknowledged','resolved')),
  opened_at       timestamptz NOT NULL DEFAULT now(),
  acknowledged_at timestamptz,
  acknowledged_by text,
  assigned_to     text REFERENCES users(id),
  resolved_at     timestamptz,
  resolved_by     text,
  resolution      text,
  peak_score      integer NOT NULL DEFAULT 0,
  reasons         jsonb NOT NULL DEFAULT '[]'::jsonb,
  origin_lat      double precision,
  origin_lng      double precision,
  origin_name     text
);
CREATE INDEX incidents_open_idx ON incidents (asset_id, kind) WHERE status <> 'resolved';
CREATE INDEX incidents_time_idx ON incidents (opened_at DESC);

CREATE TABLE incident_events (
  id          bigserial PRIMARY KEY,
  incident_id text NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  at          timestamptz NOT NULL DEFAULT now(),
  actor_id    text,
  actor_name  text NOT NULL,
  type        text NOT NULL,
  message     text,
  data        jsonb
);
CREATE INDEX incident_events_idx ON incident_events (incident_id, at);

CREATE TABLE relocations (
  id              text PRIMARY KEY,
  asset_id        text NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  reason          text NOT NULL,
  to_retailer_id  text REFERENCES retailers(id),
  to_lat          double precision NOT NULL,
  to_lng          double precision NOT NULL,
  window_start    timestamptz NOT NULL,
  window_end      timestamptz NOT NULL,
  status          text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','completed','expired')),
  requested_by    text NOT NULL,
  requested_at    timestamptz NOT NULL DEFAULT now(),
  decided_by      text,
  decided_at      timestamptz,
  completed_at    timestamptz
);
CREATE INDEX relocations_asset_idx ON relocations (asset_id, status);

CREATE TABLE notifications (
  id          bigserial PRIMARY KEY,
  at          timestamptz NOT NULL DEFAULT now(),
  channel     text NOT NULL,
  recipient   text NOT NULL,
  subject     text NOT NULL,
  body        text NOT NULL,
  incident_id text,
  status      text NOT NULL DEFAULT 'queued',
  error       text
);

CREATE TABLE audit_log (
  id         bigserial PRIMARY KEY,
  at         timestamptz NOT NULL DEFAULT now(),
  actor_id   text,
  actor_name text NOT NULL,
  action     text NOT NULL,
  target     text,
  detail     jsonb,
  ip         text
);
CREATE INDEX audit_log_time_idx ON audit_log (at DESC)
`,
];
