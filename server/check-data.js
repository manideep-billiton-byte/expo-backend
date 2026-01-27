// Quick test script to check events and exhibitors data
const pool = require('./db');

async function checkData() {
    try {
        console.log('\n=== CHECKING EVENTS ===');
        const events = await pool.query(`
            SELECT id, event_name, organization_id, status, start_date, end_date
            FROM events
            ORDER BY created_at DESC
            LIMIT 10
        `);
        console.log('Recent Events:');
        console.table(events.rows);

        console.log('\n=== CHECKING EXHIBITORS ===');
        const exhibitors = await pool.query(`
            SELECT id, company_name, email, organization_id, event_id
            FROM exhibitors
            ORDER BY created_at DESC
            LIMIT 10
        `);
        console.log('Recent Exhibitors:');
        console.table(exhibitors.rows);

        console.log('\n=== CHECKING ORGANIZATIONS ===');
        const orgs = await pool.query(`
            SELECT id, org_name
            FROM organizations
            ORDER BY created_at DESC
            LIMIT 10
        `);
        console.log('Recent Organizations:');
        console.table(orgs.rows);

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

checkData();
