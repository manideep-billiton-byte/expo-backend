require('dotenv').config();
const { Pool } = require('pg');

const sslConfig = process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: false } : undefined;

const poolConfig = process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: sslConfig
    }
    : {
        host: process.env.PGHOST,
        port: process.env.PGPORT ? Number(process.env.PGPORT) : 5432,
        user: process.env.PGUSER,
        password: process.env.PGPASSWORD ?? '',
        database: process.env.PGDATABASE,
        ssl: sslConfig
    };

(async () => {
    const pool = new Pool(poolConfig);
    try {
        console.log('Ensuring organizations.org_name column exists...');
        await pool.query(`ALTER TABLE organizations ADD COLUMN IF NOT EXISTS org_name TEXT;`);
        console.log('Done: org_name ensured.');
    } catch (err) {
        console.error('Failed to ensure column:', err.message || err);
        process.exit(1);
    } finally {
        await pool.end();
    }
})();
