-- Migration: create exhibitors table
CREATE TABLE IF NOT EXISTS exhibitors (
    id SERIAL PRIMARY KEY,
    company_name TEXT,
    gst_number TEXT,
    address TEXT,
    industry TEXT,
    contact_person TEXT,
    email TEXT,
    mobile TEXT,
    event_id INTEGER,
    stall_number TEXT,
    stall_category TEXT,
    access_status TEXT,
    lead_capture JSONB,
    communication JSONB,
    created_at TIMESTAMP DEFAULT now()
);

-- Optionally create index on event_id
CREATE INDEX IF NOT EXISTS idx_exhibitors_event ON exhibitors(event_id);
