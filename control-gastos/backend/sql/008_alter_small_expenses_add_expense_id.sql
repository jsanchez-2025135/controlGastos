-- Enlaza cada pequeño consumo con su Egreso reflejo. ON DELETE CASCADE:
-- si el Egreso se borra (desde la pantalla de Egresos), el consumo
-- pequeño enlazado se borra automáticamente también.
ALTER TABLE small_expenses ADD COLUMN IF NOT EXISTS expense_id UUID REFERENCES expenses(id) ON DELETE CASCADE;
CREATE UNIQUE INDEX IF NOT EXISTS idx_small_expenses_expense_id ON small_expenses(expense_id);