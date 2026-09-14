-- Se aplica automáticamente al correr "pnpm dev" (scripts/init-db.cjs recorre /sql en orden)

CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  description VARCHAR(150) NOT NULL,
  category VARCHAR(50) NOT NULL CHECK (category IN ('Alimentación', 'Transporte', 'Vivienda', 'Servicios', 'Otros')),
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  method VARCHAR(50) NOT NULL,
  date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expenses_user_id ON expenses(user_id);