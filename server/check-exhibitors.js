const pool = require('./db');

async function checkExhibitors() {
    try {
        console.log('Querying exhibitors...\n');

        const result = await pool.query(`
            SELECT id, company_name, email, organization_id
            FROM exhibitors
            ORDER BY created_at DESC
            LIMIT 5
        `);

        console.log(`Found ${result.rows.length} exhibitors:\n`);
        result.rows.forEach(exhibitor => {
            console.log(`ID: ${exhibitor.id}`);
            console.log(`Company: ${exhibitor.company_name}`);
            console.log(`Email: ${exhibitor.email}`);
            console.log(`Organization ID: ${exhibitor.organization_id}`);
            console.log('---');
        });

        process.exit(0);
    } catch (error) {
        console.error('Error querying exhibitors:', error);
        process.exit(1);
    }
}

checkExhibitors();
