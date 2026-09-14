-- Amplía la categoría permitida en "expenses" para aceptar los egresos
-- reflejo que genera automáticamente el módulo de Pequeños Consumos.
ALTER TABLE expenses DROP CONSTRAINT IF EXISTS expenses_category_check;
ALTER TABLE expenses ADD CONSTRAINT expenses_category_check
  CHECK (category IN ('Alimentación', 'Transporte', 'Vivienda', 'Servicios', 'Otros', 'Pequeños consumos'));