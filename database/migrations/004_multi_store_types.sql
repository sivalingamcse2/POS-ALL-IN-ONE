ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS business_type VARCHAR(30) NOT NULL DEFAULT 'restaurant',
  ADD COLUMN IF NOT EXISTS website VARCHAR(255) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS manager_name VARCHAR(255) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS operating_hours VARCHAR(255) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS seating_capacity INTEGER NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'restaurants_business_type_check'
      AND conrelid = 'restaurants'::regclass
  ) THEN
    ALTER TABLE restaurants
      ADD CONSTRAINT restaurants_business_type_check
      CHECK (business_type IN ('restaurant', 'supermarket'));
  END IF;
END $$;
