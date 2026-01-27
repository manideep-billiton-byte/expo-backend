-- Add unique_code column to existing visitors table
ALTER TABLE visitors ADD COLUMN IF NOT EXISTS unique_code TEXT UNIQUE;
ALTER TABLE visitors ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT now();

-- Update existing visitors with unique codes (if any exist)
-- This generates a unique code for any existing visitors without one
UPDATE visitors 
SET unique_code = 'VIS-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT || id::TEXT) FROM 1 FOR 8))
WHERE unique_code IS NULL;
