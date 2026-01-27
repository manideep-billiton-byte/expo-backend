CREATE TABLE IF NOT EXISTS organizations (
  id BIGSERIAL PRIMARY KEY,
  org_name TEXT NOT NULL,
  trade_name TEXT,
  tenant_type TEXT,
  industry TEXT,
  size TEXT,
  api_access BOOLEAN NOT NULL DEFAULT FALSE,
  business_type TEXT,
  is_registered BOOLEAN,
  primary_email TEXT,
  primary_mobile TEXT,
  state TEXT,
  district TEXT,
  town TEXT,
  address TEXT,
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  alt_phone TEXT,
  website TEXT,
  gst_number TEXT,
  pan_number TEXT,
  reg_number TEXT,
  date_inc DATE,
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  features TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  plan TEXT NOT NULL DEFAULT 'Free',
  status TEXT NOT NULL DEFAULT 'Active',
  password_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS trade_name TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS tenant_type TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS industry TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS size TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS api_access BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS business_type TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS is_registered BOOLEAN;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS primary_email TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS primary_mobile TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS state TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS district TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS town TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS contact_name TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS contact_email TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS contact_phone TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS alt_phone TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS website TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS gst_number TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS pan_number TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS reg_number TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS date_inc DATE;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS features TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'Free';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'Active';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE UNIQUE INDEX IF NOT EXISTS organizations_primary_email_uniq ON organizations (primary_email) WHERE primary_email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS organizations_gst_number_uniq ON organizations (gst_number) WHERE gst_number IS NOT NULL;

CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  organization_id BIGINT REFERENCES organizations(id) ON DELETE SET NULL,
  role TEXT,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  mobile TEXT,
  department TEXT,
  permissions JSONB NOT NULL DEFAULT '{}'::JSONB,
  additional_permissions JSONB NOT NULL DEFAULT '{}'::JSONB,
  login_type TEXT NOT NULL DEFAULT 'manual',
  password_hash TEXT,
  force_reset BOOLEAN NOT NULL DEFAULT TRUE,
  security JSONB NOT NULL DEFAULT '{}'::JSONB,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS organization_id BIGINT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS mobile TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS department TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS permissions JSONB NOT NULL DEFAULT '{}'::JSONB;
ALTER TABLE users ADD COLUMN IF NOT EXISTS additional_permissions JSONB NOT NULL DEFAULT '{}'::JSONB;
ALTER TABLE users ADD COLUMN IF NOT EXISTS login_type TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS force_reset BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS security JSONB NOT NULL DEFAULT '{}'::JSONB;
ALTER TABLE users ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'users_organization_id_fkey'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_organization_id_fkey
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS users_email_uniq ON users (email);

CREATE TABLE IF NOT EXISTS events (
  id BIGSERIAL PRIMARY KEY,
  organization_id BIGINT REFERENCES organizations(id) ON DELETE SET NULL,
  event_name TEXT NOT NULL,
  description TEXT,
  event_type TEXT,
  event_mode TEXT,
  industry TEXT,
  start_date DATE,
  end_date DATE,
  venue TEXT,
  city TEXT,
  state TEXT,
  country TEXT,
  organizer_name TEXT,
  contact_person TEXT,
  organizer_email TEXT,
  organizer_mobile TEXT,
  registration JSONB NOT NULL DEFAULT '{}'::JSONB,
  lead_capture JSONB NOT NULL DEFAULT '{}'::JSONB,
  communication JSONB NOT NULL DEFAULT '{}'::JSONB,
  qr_token TEXT,
  registration_link TEXT,
  status TEXT NOT NULL DEFAULT 'Draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE events ADD COLUMN IF NOT EXISTS qr_token TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS registration_link TEXT;

ALTER TABLE events ADD COLUMN IF NOT EXISTS organization_id BIGINT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS event_name TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS event_type TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS event_mode TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS industry TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS end_date DATE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS venue TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS state TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS country TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS organizer_name TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS contact_person TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS organizer_email TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS organizer_mobile TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS registration JSONB NOT NULL DEFAULT '{}'::JSONB;
ALTER TABLE events ADD COLUMN IF NOT EXISTS lead_capture JSONB NOT NULL DEFAULT '{}'::JSONB;
ALTER TABLE events ADD COLUMN IF NOT EXISTS communication JSONB NOT NULL DEFAULT '{}'::JSONB;
ALTER TABLE events ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'Draft';
ALTER TABLE events ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE events ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'events_organization_id_fkey'
  ) THEN
    ALTER TABLE events
      ADD CONSTRAINT events_organization_id_fkey
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS events_organization_id_idx ON events (organization_id);

CREATE TABLE IF NOT EXISTS exhibitors (
  id BIGSERIAL PRIMARY KEY,
  organization_id BIGINT REFERENCES organizations(id) ON DELETE SET NULL,
  event_id BIGINT REFERENCES events(id) ON DELETE SET NULL,
  company_name TEXT NOT NULL,
  gst_number TEXT,
  address TEXT,
  industry TEXT,
  logo_url TEXT,
  contact_person TEXT,
  email TEXT,
  mobile TEXT,
  password_hash TEXT,
  stall_number TEXT,
  stall_category TEXT,
  access_status TEXT NOT NULL DEFAULT 'Active',
  lead_capture JSONB NOT NULL DEFAULT '{}'::JSONB,
  communication JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE exhibitors ADD COLUMN IF NOT EXISTS organization_id BIGINT;
ALTER TABLE exhibitors ADD COLUMN IF NOT EXISTS event_id BIGINT;
ALTER TABLE exhibitors ADD COLUMN IF NOT EXISTS company_name TEXT;
ALTER TABLE exhibitors ADD COLUMN IF NOT EXISTS gst_number TEXT;
ALTER TABLE exhibitors ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE exhibitors ADD COLUMN IF NOT EXISTS industry TEXT;
ALTER TABLE exhibitors ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE exhibitors ADD COLUMN IF NOT EXISTS contact_person TEXT;
ALTER TABLE exhibitors ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE exhibitors ADD COLUMN IF NOT EXISTS mobile TEXT;
ALTER TABLE exhibitors ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE exhibitors ADD COLUMN IF NOT EXISTS stall_number TEXT;
ALTER TABLE exhibitors ADD COLUMN IF NOT EXISTS stall_category TEXT;
ALTER TABLE exhibitors ADD COLUMN IF NOT EXISTS access_status TEXT NOT NULL DEFAULT 'Active';
ALTER TABLE exhibitors ADD COLUMN IF NOT EXISTS lead_capture JSONB NOT NULL DEFAULT '{}'::JSONB;
ALTER TABLE exhibitors ADD COLUMN IF NOT EXISTS communication JSONB NOT NULL DEFAULT '{}'::JSONB;
ALTER TABLE exhibitors ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE exhibitors ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'exhibitors_organization_id_fkey'
  ) THEN
    ALTER TABLE exhibitors
      ADD CONSTRAINT exhibitors_organization_id_fkey
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'exhibitors_event_id_fkey'
  ) THEN
    ALTER TABLE exhibitors
      ADD CONSTRAINT exhibitors_event_id_fkey
      FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS exhibitors_event_id_idx ON exhibitors (event_id);

CREATE TABLE IF NOT EXISTS visitors (
  id BIGSERIAL PRIMARY KEY,
  event_id BIGINT REFERENCES events(id) ON DELETE SET NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  mobile TEXT,
  password_hash TEXT,
  gender TEXT,
  age_group TEXT,
  organization TEXT,
  designation TEXT,
  visitor_category TEXT,
  valid_dates TEXT,
  communication JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE visitors ADD COLUMN IF NOT EXISTS event_id BIGINT;
ALTER TABLE visitors ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE visitors ADD COLUMN IF NOT EXISTS last_name TEXT;
ALTER TABLE visitors ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE visitors ADD COLUMN IF NOT EXISTS mobile TEXT;
ALTER TABLE visitors ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE visitors ADD COLUMN IF NOT EXISTS gender TEXT;
ALTER TABLE visitors ADD COLUMN IF NOT EXISTS age_group TEXT;
ALTER TABLE visitors ADD COLUMN IF NOT EXISTS organization TEXT;
ALTER TABLE visitors ADD COLUMN IF NOT EXISTS designation TEXT;
ALTER TABLE visitors ADD COLUMN IF NOT EXISTS visitor_category TEXT;
ALTER TABLE visitors ADD COLUMN IF NOT EXISTS valid_dates TEXT;
ALTER TABLE visitors ADD COLUMN IF NOT EXISTS communication JSONB NOT NULL DEFAULT '{}'::JSONB;
ALTER TABLE visitors ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE visitors ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'visitors_event_id_fkey'
  ) THEN
    ALTER TABLE visitors
      ADD CONSTRAINT visitors_event_id_fkey
      FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS visitors_event_id_idx ON visitors (event_id);

CREATE TABLE IF NOT EXISTS invoices (
  id BIGSERIAL PRIMARY KEY,
  invoice_number TEXT NOT NULL,
  organization_id BIGINT REFERENCES organizations(id) ON DELETE SET NULL,
  billing_email TEXT,
  billing_address TEXT,
  tax_id TEXT,
  plan_type TEXT,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'INR',
  due_date DATE,
  payment_method TEXT,
  items JSONB NOT NULL DEFAULT '[]'::JSONB,
  notes TEXT,
  terms_accepted BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'Pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS items JSONB;

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS invoice_number TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS organization_id BIGINT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS billing_email TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS billing_address TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS tax_id TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS plan_type TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS amount NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'INR';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS due_date DATE;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_method TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS terms_accepted BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'Pending';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'invoices_organization_id_fkey'
  ) THEN
    ALTER TABLE invoices
      ADD CONSTRAINT invoices_organization_id_fkey
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS invoices_invoice_number_uniq ON invoices (invoice_number);
CREATE INDEX IF NOT EXISTS invoices_organization_id_idx ON invoices (organization_id);

CREATE TABLE IF NOT EXISTS invoice_items (
  id BIGSERIAL PRIMARY KEY,
  invoice_id BIGINT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description TEXT,
  quantity INT NOT NULL DEFAULT 1,
  price NUMERIC(12,2) NOT NULL DEFAULT 0
);

ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS invoice_id BIGINT;
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS quantity INT NOT NULL DEFAULT 1;
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS price NUMERIC(12,2) NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'invoice_items_invoice_id_fkey'
  ) THEN
    ALTER TABLE invoice_items
      ADD CONSTRAINT invoice_items_invoice_id_fkey
      FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE;
  END IF;
END $$;
