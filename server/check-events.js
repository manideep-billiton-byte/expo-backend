const pool = require('./db');

async function checkEvents() {
    try {
        console.log('Querying events...\n');

        const result = await pool.query(`
            SELECT id, event_name, start_date, end_date, status, organization_id, created_at
            FROM events
            ORDER BY created_at DESC
            LIMIT 10
        `);

        console.log(`Found ${result.rows.length} events:\n`);
        result.rows.forEach(event => {
            console.log(`ID: ${event.id}`);
            console.log(`Name: ${event.event_name}`);
            console.log(`Start Date: ${event.start_date}`);
            console.log(`End Date: ${event.end_date}`);
            console.log(`Status: ${event.status}`);
            console.log(`Organization ID: ${event.organization_id}`);
            console.log(`Created At: ${event.created_at}`);
            console.log('---');
        });

        process.exit(0);
    } catch (error) {
        console.error('Error querying events:', error);
        process.exit(1);
    }
}

checkEvents();
