/**
 * Migration: Add stall configuration columns to events table
 * 
 * Run with: node server/migrations/010_add_stall_config_to_events.js
 */

const pool = require('../db');

const runMigration = async () => {
    const migrationSQL = `
        -- Add stall configuration columns to events table
        ALTER TABLE events ADD COLUMN IF NOT EXISTS enable_stalls BOOLEAN DEFAULT false;
        ALTER TABLE events ADD COLUMN IF NOT EXISTS stall_config JSONB DEFAULT '{}'::JSONB;
        ALTER TABLE events ADD COLUMN IF NOT EXISTS stall_types JSONB DEFAULT '[]'::JSONB;
        ALTER TABLE events ADD COLUMN IF NOT EXISTS ground_layout_url TEXT;
    `;

    try {
        console.log('Running migration: Add stall config columns to events...');
        await pool.query(migrationSQL);
        console.log('✅ Migration completed successfully!');

        // Verify columns exist
        const result = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'events' 
            AND column_name IN ('enable_stalls', 'stall_config', 'stall_types', 'ground_layout_url')
            ORDER BY column_name
        `);

        console.log('\nNew columns added:');
        result.rows.forEach(row => {
            console.log(`  - ${row.column_name}: ${row.data_type}`);
        });

    } catch (error) {
        console.error('❌ Migration error:', error.message);
        throw error;
    } finally {
        await pool.end();
    }
};

runMigration();
