-- Se aplica automáticamente al correr "pnpm dev" (scripts/init-db.cjs recorre /sql en orden)

CREATE TABLE IF NOT EXISTS expense_goals (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);