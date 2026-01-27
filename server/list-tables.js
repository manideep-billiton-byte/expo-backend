const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: false } : undefined
});

async function listTables() {
    try {
        console.log('Connecting to database...');
        const client = await pool.connect();

        try {
            const res = await client.query(`
        SELECT 
          table_name, 
          (SELECT count(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
        FROM information_schema.tables t
        WHERE table_schema = 'public' 
        ORDER BY table_name;
      `);

            if (res.rows.length === 0) {
                console.log('No tables found in public schema.');
            } else {
                console.log('\nBackend Database Tables:');
                console.log('------------------------');
                console.table(res.rows);
            }
        } finally {
            client.release();
        }

        process.exit(0);
    } catch (err) {
        console.error('Error listing tables:', err.message);
        process.exit(1);
    }
}

listTables();
