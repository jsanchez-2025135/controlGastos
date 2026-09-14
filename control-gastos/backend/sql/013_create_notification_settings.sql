CREATE TABLE IF NOT EXISTS notification_settings (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  notify_recordatorio BOOLEAN NOT NULL DEFAULT true,
  notify_transaccion BOOLEAN NOT NULL DEFAULT true,
  notify_reporte BOOLEAN NOT NULL DEFAULT true,
  notify_sistema BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);