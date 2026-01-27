-- Create leads table for storing scanned visitor data
CREATE TABLE IF NOT EXISTS leads (
  id BIGSERIAL PRIMARY KEY,
  exhibitor_id BIGINT REFERENCES exhibitors(id) ON DELETE CASCADE,
  event_id BIGINT REFERENCES events(id) ON DELETE SET NULL,
  organization_id BIGINT REFERENCES organizations(id) ON DELETE SET NULL,
  
  -- Visitor Information
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  company TEXT,
  designation TEXT,
  city TEXT,
  state TEXT,
  country TEXT,
  industry TEXT,
  
  -- Lead Metadata
  source TEXT DEFAULT 'QR Scan',
  notes TEXT,
  rating INTEGER,
  status TEXT DEFAULT 'New',
  follow_up_date DATE,
  
  -- Additional Data (flexible JSON field for custom fields)
  additional_data JSONB DEFAULT '{}'::JSONB,
  
  -- Timestamps
  scanned_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS leads_exhibitor_id_idx ON leads (exhibitor_id);
CREATE INDEX IF NOT EXISTS leads_event_id_idx ON leads (event_id);
CREATE INDEX IF NOT EXISTS leads_email_idx ON leads (email);
CREATE INDEX IF NOT EXISTS leads_scanned_at_idx ON leads (scanned_at DESC);
