const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: false } : undefined
});

async function createEventsTable() {
    try {
        console.log('Connecting to database...');

        // Check what tables exist
        const tables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema='public'
      ORDER BY table_name
    `);

        console.log('Existing tables:', tables.rows.map(r => r.table_name));

        // Create events table with ALL columns including 'name'
        console.log('\nCreating events table...');

        await pool.query(`
      CREATE TABLE IF NOT EXISTS events (
        id BIGSERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        event_name TEXT NOT NULL,
        description TEXT,
        event_type TEXT,
        event_mode TEXT,
        industry TEXT,
        organizer_name TEXT,
        contact_person TEXT,
        organizer_email TEXT,
        organizer_mobile TEXT,
        venue TEXT,
        city TEXT,
        state TEXT,
        country TEXT,
        start_date DATE,
        end_date DATE,
        registration JSONB DEFAULT '{}'::JSONB,
        lead_capture JSONB DEFAULT '{}'::JSONB,
        communication JSONB DEFAULT '{}'::JSONB,
        qr_token TEXT UNIQUE NOT NULL,
        registration_link TEXT NOT NULL,
        status TEXT DEFAULT 'Draft',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

        console.log('✓ Events table created successfully!');

        // Create indexes
        await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_events_qr_token ON events(qr_token);
      CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
    `);

        console.log('✓ Indexes created');

        // Verify
        const verify = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name='events'
      ORDER BY ordinal_position
    `);

        console.log('\n✓ Events table columns:');
        verify.rows.forEach(col => {
            console.log(`  - ${col.column_name} (${col.data_type}) ${col.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'}`);
        });

        process.exit(0);
    } catch (error) {
        console.error('\n❌ ERROR:', error.message);
        console.error('Stack:', error.stack);
        process.exit(1);
    }
}

createEventsTable();
