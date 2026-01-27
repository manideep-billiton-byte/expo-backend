/**
 * Migration: Create exhibitor_scanned_visitors table
 * 
 * This table stores visitor details scanned by exhibitors via QR code or OCR
 * 
 * Run with: node server/migrations/create_exhibitor_scanned_visitors.js
 */

const pool = require('../db');

const createTable = async () => {
    const createTableSQL = `
        CREATE TABLE IF NOT EXISTS exhibitor_scanned_visitors (
            id SERIAL PRIMARY KEY,
            
            -- Exhibitor who performed the scan
            exhibitor_id INTEGER REFERENCES exhibitors(id) ON DELETE SET NULL,
            
            -- Event context
            event_id INTEGER REFERENCES events(id) ON DELETE SET NULL,
            
            -- Original visitor ID (if scanned via QR and visitor exists in system)
            visitor_id INTEGER REFERENCES visitors(id) ON DELETE SET NULL,
            
            -- Scan type: 'QR_SCAN' or 'OCR'
            scan_type VARCHAR(20) NOT NULL CHECK (scan_type IN ('QR_SCAN', 'OCR')),
            
            -- Visitor details (captured at time of scan)
            visitor_name VARCHAR(255),
            visitor_email VARCHAR(255),
            visitor_phone VARCHAR(50),
            visitor_company VARCHAR(255),
            visitor_designation VARCHAR(255),
            visitor_unique_code VARCHAR(100),
            
            -- OCR specific - raw text from business card
            ocr_raw_text TEXT,
            
            -- Additional notes
            notes TEXT,
            
            -- Lead status tracking
            lead_status VARCHAR(50) DEFAULT 'New',
            interest_level VARCHAR(50),
            follow_up_date DATE,
            
            -- Timestamps
            scanned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        
        -- Create indexes for better query performance
        CREATE INDEX IF NOT EXISTS idx_esv_exhibitor_id ON exhibitor_scanned_visitors(exhibitor_id);
        CREATE INDEX IF NOT EXISTS idx_esv_event_id ON exhibitor_scanned_visitors(event_id);
        CREATE INDEX IF NOT EXISTS idx_esv_scan_type ON exhibitor_scanned_visitors(scan_type);
        CREATE INDEX IF NOT EXISTS idx_esv_scanned_at ON exhibitor_scanned_visitors(scanned_at);
        CREATE INDEX IF NOT EXISTS idx_esv_visitor_email ON exhibitor_scanned_visitors(visitor_email);
    `;

    try {
        console.log('Creating exhibitor_scanned_visitors table...');
        await pool.query(createTableSQL);
        console.log('✅ Table exhibitor_scanned_visitors created successfully!');

        // Verify table exists
        const result = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'exhibitor_scanned_visitors'
            ORDER BY ordinal_position
        `);

        console.log('\nTable columns:');
        result.rows.forEach(row => {
            console.log(`  - ${row.column_name}: ${row.data_type}`);
        });

    } catch (error) {
        console.error('❌ Error creating table:', error.message);
        throw error;
    } finally {
        await pool.end();
    }
};

createTable();
