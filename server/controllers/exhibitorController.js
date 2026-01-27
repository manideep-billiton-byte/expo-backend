const pool = require('../db');
const bcrypt = require('bcryptjs');

console.log('Loaded exhibitorController');

const getExhibitors = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                e.id,
                e.organization_id,
                e.event_id,
                e.company_name,
                e.gst_number,
                e.address,
                e.industry,
                e.logo_url,
                e.contact_person,
                e.email,
                e.mobile,
                e.stall_number,
                e.stall_category,
                e.access_status,
                e.lead_capture,
                e.communication,
                e.created_at,
                e.updated_at,
                ev.event_name,
                org.org_name AS organization_name
            FROM exhibitors e
            LEFT JOIN events ev ON ev.id = e.event_id
            LEFT JOIN organizations org ON org.id = e.organization_id
            ORDER BY e.created_at DESC
        `);
        return res.json(result.rows);
    } catch (dbErr) {
        console.error('Database error in getExhibitors:', dbErr);
        return res.status(500).json({ error: 'Failed to fetch exhibitors', details: dbErr.message });
    }
};

const createExhibitor = async (req, res) => {
    const p = req.body || {};
    try {
        const email = p.email || null;
        const password = p.password || null;

        let defaultPassword = null;
        let passwordHash = null;
        if (password) {
            passwordHash = bcrypt.hashSync(password, 10);
        } else if (email) {
            defaultPassword = `${email.split('@')[0]}@123`;
            passwordHash = bcrypt.hashSync(defaultPassword, 10);
        }

        const insertSql = `INSERT INTO exhibitors(
            organization_id, company_name, gst_number, address, industry, contact_person, email, mobile,
            password_hash,
            event_id, stall_number, stall_category, access_status, lead_capture, communication
        ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`;

        const values = [
            p.organizationId || p.organization_id || null,
            p.companyName || p.company_name || null,
            p.gstNumber || p.gst_number || null,
            p.address || null,
            p.industry || null,
            p.contactPerson || p.contact_person || null,
            email,
            p.mobile || null,
            passwordHash,
            p.eventId || null,
            p.stallNumber || p.stall_number || null,
            p.stallCategory || p.stall_category || null,
            p.accessStatus || p.access_status || 'Active',
            p.leadCapture || {},
            p.communication || {}
        ];

        const result = await pool.query(insertSql, values);
        console.log('Exhibitor created successfully:', result.rows[0].id);

        const response = {
            success: true,
            exhibitor: result.rows[0]
        };
        if (defaultPassword) {
            response.credentials = {
                email,
                password: defaultPassword,
                note: 'Please save these credentials. Password can be changed after first login.'
            };
        }

        return res.status(201).json(response);
    } catch (err) {
        console.error('createExhibitor error:', err);
        res.status(500).json({
            error: 'Failed to create exhibitor',
            details: err.message,
            code: err.code
        });
    }
};

const loginExhibitor = async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    try {
        const result = await pool.query(
            `SELECT e.id, e.company_name, e.email, e.password_hash, e.access_status, e.event_id, e.organization_id, ev.event_name
             FROM exhibitors e
             LEFT JOIN events ev ON ev.id = e.event_id
             WHERE e.email = $1 AND (e.access_status IS NULL OR e.access_status = 'Active')`,
            [email]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const exhibitor = result.rows[0];
        if (!exhibitor.password_hash) {
            return res.status(401).json({ error: 'No password set for this exhibitor. Please contact administrator.' });
        }

        const isValid = bcrypt.compareSync(password, exhibitor.password_hash);
        if (!isValid) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        console.log(`✅ Exhibitor logged in: ${exhibitor.company_name} (org: ${exhibitor.organization_id}, event: ${exhibitor.event_name || 'none'})`);

        return res.json({
            success: true,
            userType: 'exhibitor',
            user: {
                id: exhibitor.id,
                name: exhibitor.company_name,
                email: exhibitor.email,
                eventId: exhibitor.event_id,
                eventName: exhibitor.event_name,
                organizationId: exhibitor.organization_id
            }
        });
    } catch (err) {
        console.error('Error during exhibitor login:', err);
        return res.status(500).json({ error: 'Failed to authenticate exhibitor', details: err.message });
    }
};

// Get upcoming events by organization ID
const getUpcomingEventsByOrganization = async (req, res) => {
    const { organizationId } = req.params;

    if (!organizationId) {
        return res.status(400).json({ error: 'Organization ID is required' });
    }

    try {
        console.log('=== Fetching upcoming events ===');
        console.log('Organization ID:', organizationId);
        console.log('Current Date:', new Date().toISOString());

        // First, let's get ALL events for this organization to debug
        const allEventsResult = await pool.query(`
            SELECT id, event_name, start_date, end_date, status, organization_id
            FROM events
            WHERE organization_id = $1
            ORDER BY start_date ASC
        `, [organizationId]);

        console.log(`Total events for organization ${organizationId}:`, allEventsResult.rows.length);
        if (allEventsResult.rows.length > 0) {
            console.log('All events:', allEventsResult.rows.map(e => ({
                id: e.id,
                name: e.event_name,
                start_date: e.start_date,
                status: e.status,
                org_id: e.organization_id
            })));
        }

        // Now get upcoming events (start_date >= today, excluding Cancelled and Completed)
        const result = await pool.query(`
            SELECT
                e.id,
                e.event_name,
                e.description,
                e.event_type,
                e.event_mode,
                e.industry,
                e.start_date,
                e.end_date,
                e.venue,
                e.city,
                e.state,
                e.country,
                e.organizer_name,
                e.contact_person,
                e.organizer_email,
                e.organizer_mobile,
                e.status,
                e.created_at
            FROM events e
            WHERE e.organization_id = $1
            AND e.start_date >= CURRENT_DATE
            AND e.status NOT IN ('Cancelled', 'Completed')
            ORDER BY e.start_date ASC
        `, [organizationId]);

        console.log(`Found ${result.rows.length} upcoming events for organization ${organizationId}`);
        if (result.rows.length > 0) {
            console.log('Upcoming events:', result.rows.map(e => ({
                id: e.id,
                name: e.event_name,
                status: e.status,
                start_date: e.start_date
            })));
        } else {
            console.log('No upcoming events found - check if start_date values are in the future');
        }

        return res.json(result.rows);
    } catch (err) {
        console.error('Error fetching upcoming events:', err);
        return res.status(500).json({ error: 'Failed to fetch upcoming events', details: err.message });
    }
};

// Register exhibitor for an event (one-click registration with auto-fill)
const registerExhibitorForEvent = async (req, res) => {
    const { exhibitorId, eventId } = req.body;

    if (!exhibitorId || !eventId) {
        return res.status(400).json({ error: 'Exhibitor ID and Event ID are required' });
    }

    try {
        // First, get the exhibitor's existing data
        const exhibitorResult = await pool.query(
            'SELECT * FROM exhibitors WHERE id = $1',
            [exhibitorId]
        );

        if (exhibitorResult.rows.length === 0) {
            return res.status(404).json({ error: 'Exhibitor not found' });
        }

        const exhibitor = exhibitorResult.rows[0];

        // Check if exhibitor is already registered for this event
        const existingRegistration = await pool.query(
            'SELECT id FROM exhibitors WHERE organization_id = $1 AND event_id = $2 AND email = $3',
            [exhibitor.organization_id, eventId, exhibitor.email]
        );

        if (existingRegistration.rows.length > 0) {
            return res.status(400).json({ error: 'You are already registered for this event' });
        }

        // Get event details
        const eventResult = await pool.query(
            'SELECT event_name, organization_id FROM events WHERE id = $1',
            [eventId]
        );

        if (eventResult.rows.length === 0) {
            return res.status(404).json({ error: 'Event not found' });
        }

        const event = eventResult.rows[0];

        // Verify event belongs to same organization
        if (event.organization_id !== exhibitor.organization_id) {
            return res.status(403).json({ error: 'Cannot register for events from different organizations' });
        }

        // Create new exhibitor registration with auto-filled data
        const insertSql = `INSERT INTO exhibitors(
            organization_id, company_name, gst_number, address, industry, 
            contact_person, email, mobile, password_hash,
            event_id, access_status, lead_capture, communication
        ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`;

        const values = [
            exhibitor.organization_id,
            exhibitor.company_name,
            exhibitor.gst_number,
            exhibitor.address,
            exhibitor.industry,
            exhibitor.contact_person,
            exhibitor.email,
            exhibitor.mobile,
            exhibitor.password_hash, // Reuse existing password
            eventId,
            'Active',
            exhibitor.lead_capture || {},
            exhibitor.communication || {}
        ];

        const result = await pool.query(insertSql, values);
        console.log('Exhibitor registered for event successfully:', result.rows[0].id);

        return res.status(201).json({
            success: true,
            message: 'Successfully registered for the event!',
            registration: result.rows[0],
            eventName: event.event_name
        });
    } catch (err) {
        console.error('Error registering exhibitor for event:', err);
        return res.status(500).json({
            error: 'Failed to register for event',
            details: err.message
        });
    }
};

module.exports = {
    getExhibitors,
    createExhibitor,
    loginExhibitor,
    getUpcomingEventsByOrganization,
    registerExhibitorForEvent
};
