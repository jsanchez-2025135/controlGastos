CREATE TABLE IF NOT EXISTS budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category VARCHAR(50) NOT NULL CHECK (category IN ('Alimentación', 'Transporte', 'Vivienda', 'Servicios', 'Otros', 'Pequeños consumos')),
  monthly_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (monthly_amount >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, category)
);