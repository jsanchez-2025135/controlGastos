-- Ejecutar con: psql -U postgres -d control_gastos -f sql/011_alter_users_add_google_auth.sql
-- (o dejar que "pnpm dev" la aplique automáticamente, como las demás migraciones)

-- Los usuarios que se registran con Google no tienen contraseña propia.
ALTER TABLE users ALTER COLUMN password DROP NOT NULL;

-- Identificador único que Google nos da para cada cuenta (campo "sub" del token).
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR(255) UNIQUE;