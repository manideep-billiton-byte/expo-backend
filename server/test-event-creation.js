const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: false } : undefined
});

async function testEventCreation() {
    try {
        console.log('Testing event creation...');

        const token = uuidv4();
        const registration_link = `https://d2ux36xl31uki3.cloudfront.net/register/event/${token}`;
        const eventName = 'Test Event ' + new Date().toISOString();

        const insertSql = `INSERT INTO events(
      name, event_name, description, event_type, event_mode, industry,
      organizer_name, contact_person, organizer_email, organizer_mobile,
      venue, city, state, country, start_date, end_date,
      registration, lead_capture, communication, qr_token, registration_link, status
    ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22) RETURNING *`;

        const values = [
            eventName, eventName, 'Test description', 'conference', 'in_person', 'tech',
            'Test Organizer', 'John Doe', 'test@example.com', '+911234567890',
            'Test Venue', 'Mumbai', 'Maharashtra', 'India', '2026-02-15', '2026-02-17',
            '{}', '{}', '{}', token, registration_link, 'Draft'
        ];

        console.log('Executing INSERT query...');
        const result = await pool.query(insertSql, values);
        const created = result.rows[0];

        console.log('✅ EVENT CREATED SUCCESSFULLY!');
        console.log('Event ID:', created.id);
        console.log('Event Name:', created.event_name);
        console.log('QR Token:', created.qr_token);
        console.log('Registration Link:', created.registration_link);

        process.exit(0);
    } catch (error) {
        console.error('❌ ERROR:', error.message);
        console.error('Code:', error.code);
        console.error('Stack:', error.stack);
        process.exit(1);
    }
}

testEventCreation();
