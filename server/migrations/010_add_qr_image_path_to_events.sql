-- Migration: Add qr_image_path column to events table
-- This stores the path to the generated QR code image
-- Local: /uploads/qrs/event-123.png
-- Prod: https://d36p7i1koir3da.cloudfront.net/qrs/event-123.png

ALTER TABLE events
ADD COLUMN IF NOT EXISTS qr_image_path TEXT;

-- Add comment for documentation
COMMENT ON COLUMN events.qr_image_path IS 'Path to the QR code image for event registration';
