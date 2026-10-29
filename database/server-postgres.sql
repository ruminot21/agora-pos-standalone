-- DISEÑO DE LA FASE 2. NO se necesita para la app local.
-- PostgreSQL 16+, UUID enviados por clientes para idempotencia.
BEGIN;
CREATE TABLE organizations (
  id uuid PRIMARY KEY, name text NOT NULL CHECK(length(name) BETWEEN 1 AND 120),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE branches (
  id uuid PRIMARY KEY, org_id uuid NOT NULL REFERENCES organizations(id),
  name text NOT NULL, currency char(3) NOT NULL DEFAULT 'CLP',
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(org_id,id)
);
CREATE TABLE devices (
  id uuid PRIMARY KEY, org_id uuid NOT NULL REFERENCES organizations(id),
  branch_id uuid NOT NULL REFERENCES branches(id), name text NOT NULL,
  last_seen_at timestamptz, last_event_seq bigint NOT NULL DEFAULT 0,
  UNIQUE(org_id,id)
);
CREATE TABLE users_pos (
  id uuid PRIMARY KEY, org_id uuid NOT NULL REFERENCES organizations(id),
  name text NOT NULL, role text NOT NULL CHECK(role IN ('admin','supervisor','cashier')),
  password_hash text NOT NULL, disabled_at timestamptz
);
CREATE TABLE products (
  id uuid PRIMARY KEY, org_id uuid NOT NULL REFERENCES organizations(id),
  name text NOT NULL, sku text, barcode text, category text NOT NULL DEFAULT 'General',
  price_minor bigint NOT NULL CHECK(price_minor>=0), cost_minor bigint NOT NULL DEFAULT 0 CHECK(cost_minor>=0),
  track_stock boolean NOT NULL DEFAULT true, active boolean NOT NULL DEFAULT true,
  version bigint NOT NULL DEFAULT 1, updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX products_org_sku ON products(org_id,sku) WHERE sku IS NOT NULL AND sku<>'';
CREATE UNIQUE INDEX products_org_barcode ON products(org_id,barcode) WHERE barcode IS NOT NULL AND barcode<>'';
CREATE TABLE branch_stock (
  branch_id uuid NOT NULL REFERENCES branches(id), product_id uuid NOT NULL REFERENCES products(id),
  quantity bigint NOT NULL DEFAULT 0 CHECK(quantity>=0), reserved_offline bigint NOT NULL DEFAULT 0 CHECK(reserved_offline>=0),
  version bigint NOT NULL DEFAULT 1, PRIMARY KEY(branch_id,product_id)
);
CREATE TABLE cash_sessions (
  id uuid PRIMARY KEY, org_id uuid NOT NULL REFERENCES organizations(id), branch_id uuid NOT NULL REFERENCES branches(id),
  device_id uuid NOT NULL REFERENCES devices(id), opened_at timestamptz NOT NULL, closed_at timestamptz,
  opening_minor bigint NOT NULL CHECK(opening_minor>=0), counted_minor bigint, expected_minor bigint,
  status text NOT NULL CHECK(status IN ('open','closed'))
);
CREATE TABLE sales (
  id uuid PRIMARY KEY, org_id uuid NOT NULL REFERENCES organizations(id), branch_id uuid NOT NULL REFERENCES branches(id),
  device_id uuid NOT NULL REFERENCES devices(id), session_id uuid NOT NULL REFERENCES cash_sessions(id),
  local_sale_number bigint NOT NULL, occurred_at timestamptz NOT NULL,
  subtotal_minor bigint NOT NULL CHECK(subtotal_minor>=0), discount_minor bigint NOT NULL CHECK(discount_minor>=0),
  total_minor bigint NOT NULL CHECK(total_minor>0), cash_minor bigint NOT NULL DEFAULT 0,
  card_minor bigint NOT NULL DEFAULT 0, transfer_minor bigint NOT NULL DEFAULT 0,
  currency char(3) NOT NULL, status text NOT NULL DEFAULT 'completed',
  UNIQUE(device_id,local_sale_number),
  CHECK(total_minor=cash_minor+card_minor+transfer_minor)
);
CREATE TABLE sale_items (
  id uuid PRIMARY KEY, sale_id uuid NOT NULL REFERENCES sales(id), product_id uuid NOT NULL REFERENCES products(id),
  product_name text NOT NULL, quantity bigint NOT NULL CHECK(quantity>0),
  unit_price_minor bigint NOT NULL CHECK(unit_price_minor>=0), line_total_minor bigint NOT NULL CHECK(line_total_minor>=0)
);
CREATE TABLE inventory_events (
  id uuid PRIMARY KEY, org_id uuid NOT NULL REFERENCES organizations(id), branch_id uuid NOT NULL REFERENCES branches(id),
  device_id uuid NOT NULL REFERENCES devices(id), product_id uuid NOT NULL REFERENCES products(id),
  sale_id uuid REFERENCES sales(id), quantity_delta bigint NOT NULL CHECK(quantity_delta<>0),
  reason text NOT NULL, occurred_at timestamptz NOT NULL
);
CREATE TABLE cash_events (
  id uuid PRIMARY KEY, session_id uuid NOT NULL REFERENCES cash_sessions(id),
  delta_minor bigint NOT NULL CHECK(delta_minor<>0),reason text NOT NULL,occurred_at timestamptz NOT NULL
);
-- Una entrada idempotente por evento de cada dispositivo; secuencia central por organización.
CREATE TABLE sync_events (
  seq bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id uuid NOT NULL UNIQUE, org_id uuid NOT NULL REFERENCES organizations(id),
  branch_id uuid NOT NULL REFERENCES branches(id), device_id uuid NOT NULL REFERENCES devices(id),
  entity text NOT NULL,entity_id uuid NOT NULL,event_type text NOT NULL,
  payload jsonb NOT NULL,received_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sync_events_org_seq ON sync_events(org_id,seq);
COMMIT;
-- SEGURIDAD pendiente: backend autenticado, validación org/dispositivo, límites, auditoría;
-- no exponer directamente estas tablas o SQL a aplicaciones cliente.
