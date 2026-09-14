CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  category VARCHAR(20) NOT NULL CHECK (category IN ('recordatorio', 'transaccion', 'reporte', 'sistema')),
  title VARCHAR(150) NOT NULL,
  message VARCHAR(300) NOT NULL,
  -- Campo flexible para evitar avisos duplicados: guarda la categoría de
  -- egreso (para presupuestos) o el umbral (para ahorro), según el tipo.
  meta VARCHAR(50),
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC);