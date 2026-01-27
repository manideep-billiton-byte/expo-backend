-- Create custom subscription plans table
CREATE TABLE IF NOT EXISTS custom_plans (
  id BIGSERIAL PRIMARY KEY,
  plan_name TEXT NOT NULL,
  plan_type TEXT,
  description TEXT,
  validity_days INTEGER DEFAULT 30,
  status TEXT NOT NULL DEFAULT 'Active',
  
  -- Pricing
  monthly_price NUMERIC(10,2),
  annual_price NUMERIC(10,2),
  
  -- Trial Settings
  enable_trial BOOLEAN DEFAULT FALSE,
  trial_days INTEGER DEFAULT 0,
  grace_period_days INTEGER DEFAULT 0,
  
  -- Feature Limits
  max_events INTEGER,
  max_leads INTEGER,
  max_users INTEGER,
  max_exhibitors_per_event INTEGER,
  whatsapp_messages INTEGER,
  ocr_scans INTEGER,
  
  -- Feature Access
  advanced_analytics BOOLEAN DEFAULT FALSE,
  crm_integration BOOLEAN DEFAULT FALSE,
  api_access BOOLEAN DEFAULT FALSE,
  white_label BOOLEAN DEFAULT FALSE,
  
  -- Overage Pricing
  per_lead_price NUMERIC(10,4),
  per_message_price NUMERIC(10,4),
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create coupons table
CREATE TABLE IF NOT EXISTS coupons (
  id BIGSERIAL PRIMARY KEY,
  coupon_code TEXT NOT NULL UNIQUE,
  custom_plan_id BIGINT REFERENCES custom_plans(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT TRUE,
  usage_count INTEGER DEFAULT 0,
  max_usage INTEGER DEFAULT 1,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for faster coupon lookups
CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(coupon_code);
CREATE INDEX IF NOT EXISTS idx_coupons_active ON coupons(is_active);
