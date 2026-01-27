-- Add name column to events table (legacy requirement)
ALTER TABLE events ADD COLUMN IF NOT EXISTS name TEXT NOT NULL DEFAULT 'Untitled Event';
