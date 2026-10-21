ALTER TABLE users
  ALTER COLUMN password DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS full_name VARCHAR(150),
  ADD COLUMN IF NOT EXISTS employee_id VARCHAR(50),
  ADD COLUMN IF NOT EXISTS account_status VARCHAR(24),
  ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS password_reset_token_hash VARCHAR(64),
  ADD COLUMN IF NOT EXISTS password_reset_expires_at TIMESTAMPTZ;

UPDATE users
SET account_status = CASE WHEN is_active THEN 'active' ELSE 'suspended' END
WHERE account_status IS NULL;

ALTER TABLE users
  ALTER COLUMN account_status SET DEFAULT 'active',
  ALTER COLUMN account_status SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'users_account_status_check'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_account_status_check
      CHECK (account_status IN ('pending_activation', 'active', 'suspended'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_employee_id_unique
  ON users (LOWER(employee_id))
  WHERE employee_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique
  ON users (LOWER(email))
  WHERE email IS NOT NULL AND email <> '';

CREATE INDEX IF NOT EXISTS idx_users_account_status
  ON users (account_status);
