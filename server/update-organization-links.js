// Script to update existing events and exhibitors with organization_id
const pool = require('./db');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function question(query) {
    return new Promise(resolve => rl.question(query, resolve));
}

async function updateData() {
    try {
        console.log('\n=== UPDATE EVENTS AND EXHIBITORS WITH ORGANIZATION ID ===\n');

        // Show organizations
        const orgs = await pool.query('SELECT id, org_name FROM organizations ORDER BY id');
        console.log('Available Organizations:');
        console.table(orgs.rows);

        const orgId = await question('\nEnter the Organization ID to link events and exhibitors to: ');

        if (!orgId || isNaN(orgId)) {
            console.log('Invalid organization ID');
            process.exit(1);
        }

        // Verify organization exists
        const orgCheck = await pool.query('SELECT org_name FROM organizations WHERE id = $1', [orgId]);
        if (orgCheck.rows.length === 0) {
            console.log(`Organization with ID ${orgId} not found`);
            process.exit(1);
        }

        console.log(`\nWill update events and exhibitors to link to: ${orgCheck.rows[0].org_name} (ID: ${orgId})`);

        const confirm = await question('Continue? (yes/no): ');
        if (confirm.toLowerCase() !== 'yes') {
            console.log('Cancelled');
            process.exit(0);
        }

        // Update events
        const eventsResult = await pool.query(
            'UPDATE events SET organization_id = $1 WHERE organization_id IS NULL RETURNING id, event_name',
            [orgId]
        );
        console.log(`\n✅ Updated ${eventsResult.rows.length} events:`);
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
        console.log('\nNext steps:');
        console.log('1. Log out from the exhibitor account');
        console.log('2. Log back in to get the updated organizationId in localStorage');
        console.log('3. Click "Register New Event" to see upcoming events');

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

updateData();
