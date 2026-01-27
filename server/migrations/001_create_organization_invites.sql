-- Create organization_invites table
CREATE TABLE IF NOT EXISTS organization_invites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL,
    mobile VARCHAR(20) NOT NULL,
    invite_token VARCHAR(255) UNIQUE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS organization_invites_email_idx ON organization_invites (email);
CREATE INDEX IF NOT EXISTS organization_invites_mobile_idx ON organization_invites (mobile);
CREATE INDEX IF NOT EXISTS organization_invites_token_idx ON organization_invites (invite_token);
CREATE INDEX IF NOT EXISTS organization_invites_status_idx ON organization_invites (status);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER update_organization_invites_updated_at
BEFORE UPDATE ON organization_invites
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
