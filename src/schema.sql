CREATE TABLE IF NOT EXISTS users (
  id text PRIMARY KEY, name text NOT NULL, role text NOT NULL CHECK (role IN ('agent','coordinator')),
  password_hash text NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token text PRIMARY KEY, user_id text NOT NULL REFERENCES users(id),
  expires_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS clients (
  nit text PRIMARY KEY, name text NOT NULL CHECK (length(trim(name)) > 0)
);
CREATE TABLE IF NOT EXISTS counters (
  key text PRIMARY KEY, value integer NOT NULL CHECK (value >= 0)
);
CREATE TABLE IF NOT EXISTS tickets (
  id text PRIMARY KEY CHECK (id ~ '^AUR-[0-9]{6}-[0-9]{4}$'),
  nit text NOT NULL REFERENCES clients(nit), client_name text NOT NULL,
  channel text NOT NULL CHECK (channel IN ('Teléfono','Correo','Mensajería')),
  type text NOT NULL CHECK (type IN ('Consulta de stock','Estado de pedido','Inconformidad de envío','Facturación o cobro','Devolución')),
  description text NOT NULL CHECK (length(trim(description)) >= 10),
  order_id text, agent_id text NOT NULL REFERENCES users(id),
  state text NOT NULL CHECK (state IN ('Nuevo','En proceso','Pendiente de logística','Pendiente de ventas','Resuelto','Cerrado')),
  received_at timestamptz NOT NULL, resolved_at timestamptz, response text,
  elapsed_hours double precision, within_sla boolean,
  version integer NOT NULL DEFAULT 1,
  CHECK ((state IN ('Resuelto','Cerrado')) = (resolved_at IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS tickets_agent ON tickets(agent_id);
CREATE INDEX IF NOT EXISTS tickets_received ON tickets(received_at DESC);
CREATE TABLE IF NOT EXISTS events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ticket_id text NOT NULL REFERENCES tickets(id), actor_id text NOT NULL REFERENCES users(id),
  at timestamptz NOT NULL, action text NOT NULL,
  old_state text, new_state text, old_agent text REFERENCES users(id), new_agent text REFERENCES users(id), comments text
);
CREATE INDEX IF NOT EXISTS events_ticket ON events(ticket_id,id);
