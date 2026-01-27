-- Create invoices table
CREATE TABLE IF NOT EXISTS invoices (
    id SERIAL PRIMARY KEY,
    invoice_number TEXT,
    organization_id INTEGER,
    organization_name TEXT,
    billing_email TEXT,
    billing_address TEXT,
    tax_id TEXT,
    plan_type TEXT,
    amount NUMERIC,
    currency TEXT,
    due_date DATE,
    payment_method TEXT,
    items JSONB,
    notes TEXT,
    status TEXT DEFAULT 'Pending',
    created_at TIMESTAMP DEFAULT now()
);
