// Script to update existing events and exhibitors with organization_id = 2 (org998)
const pool = require('./db');

async function updateData() {
    try {
        console.log('\n=== UPDATING EVENTS AND EXHIBITORS TO LINK TO ORG998 (ID=2) ===\n');

        const orgId = 2; // org998

        // Update events
        const eventsResult = await pool.query(
            'UPDATE events SET organization_id = $1 WHERE organization_id IS NULL RETURNING id, event_name',
            [orgId]
        );
        console.log(`✅ Updated ${eventsResult.rows.length} events:`);
        if (eventsResult.rows.length > 0) {
            console.table(eventsResult.rows);
        }

        // Update exhibitors
        const exhibitorsResult = await pool.query(
            'UPDATE exhibitors SET organization_id = $1 WHERE organization_id IS NULL RETURNING id, company_name, email',
            [orgId]
        );
        console.log(`\n✅ Updated ${exhibitorsResult.rows.length} exhibitors:`);
        if (exhibitorsResult.rows.length > 0) {
            console.table(exhibitorsResult.rows);
        }

        console.log('\n✅ Update complete!');
        console.log('\n📋 Next steps:');
        console.log('1. Log out from the exhibitor account');
        console.log('2. Log back in to get the updated organizationId in localStorage');
        console.log('3. Click "Register New Event" to see upcoming events\n');

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

updateData();
