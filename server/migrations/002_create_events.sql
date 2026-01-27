-- Create events table with QR fields
CREATE TABLE IF NOT EXISTS events (
  id SERIAL PRIMARY KEY,
  event_name TEXT,
  description TEXT,
  organizer_name TEXT,
  organizer_email TEXT,
  organizer_mobile TEXT,
  venue TEXT,
  city TEXT,
  state TEXT,
  country TEXT,
  start_date DATE,
  end_date DATE,
  registration JSONB,
  lead_capture JSONB,
  communication JSONB,
  qr_token TEXT,
  registration_link TEXT,
  status TEXT DEFAULT 'Draft',
  created_at TIMESTAMP DEFAULT now()
);
