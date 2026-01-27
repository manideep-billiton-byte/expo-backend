const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: false } : undefined
});

async function runMigration() {
  try {
    console.log('Connecting to database...');
    
    // Check if events table exists
    const tableCheck = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema='public' AND table_name='events'
    `);
    
    if (tableCheck.rows.length === 0) {
      console.log('ERROR: events table does not exist!');
      process.exit(1);
    }
    
    console.log('✓ Events table exists');
    
    // Check if 'name' column exists
    const columnCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='events' AND column_name='name'
    `);
    
    if (columnCheck.rows.length > 0) {
      console.log('✓ Column "name" already exists, skipping migration');
      process.exit(0);
    }
    
    console.log('Adding "name" column to events table...');
    
    // Add the column
    await pool.query(`
      ALTER TABLE events 
      ADD COLUMN name TEXT NOT NULL DEFAULT 'Untitled Event'
    `);
    
    console.log('✓ Migration successful!');
    
    // Verify
    const verify = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name='events' AND column_name='name'
    `);
    
    console.log('✓ Verification:', verify.rows[0]);
    
    process.exit(0);
  } catch (error) {
    console.error('ERROR:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

runMigration();
