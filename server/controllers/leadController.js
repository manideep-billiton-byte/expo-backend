const pool = require('../db');

console.log('Loaded leadController');

// Get all leads for an exhibitor
const getLeads = async (req, res) => {
    try {
        const { exhibitorId } = req.query;

        let query = `
            SELECT
                l.*,
                e.company_name as exhibitor_name,
                ev.event_name
            FROM leads l
            LEFT JOIN exhibitors e ON e.id = l.exhibitor_id
            LEFT JOIN events ev ON ev.id = l.event_id
        `;

        const params = [];
        if (exhibitorId) {
            query += ` WHERE l.exhibitor_id = $1`;
            params.push(exhibitorId);
        }

        query += ` ORDER BY l.scanned_at DESC`;

        const result = await pool.query(query, params);
        return res.json(result.rows);
    } catch (dbErr) {
        console.error('Database error in getLeads:', dbErr);
        return res.status(500).json({ error: 'Failed to fetch leads', details: dbErr.message });
    }
};

// Create a new lead (from QR scan or manual entry)
const createLead = async (req, res) => {
    const p = req.body || {};

    try {
        console.log('Creating lead with data:', p);

        const insertSql = `
            INSERT INTO leads(
                exhibitor_id, event_id, organization_id,
                name, email, phone, company, designation,
                city, state, country, industry,
                source, notes, rating, status, follow_up_date,
                additional_data
            ) VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
            RETURNING *
        `;

        const values = [
            p.exhibitorId || null,
            p.eventId || null,
            p.organizationId || null,
            p.name || null,
            p.email || null,
            p.phone || null,
            p.company || null,
            p.designation || null,
            p.city || null,
            p.state || null,
            p.country || null,
            p.industry || null,
            p.source || 'QR Scan',
            p.notes || null,
            p.rating || null,
            p.status || 'New',
            p.followUpDate || null,
            p.additionalData || {}
        ];

        const result = await pool.query(insertSql, values);
        console.log('Lead created successfully:', result.rows[0].id);

        return res.status(201).json({
            success: true,
            lead: result.rows[0]
        });
    } catch (err) {
        console.error('createLead error:', err);
        res.status(500).json({
            error: 'Failed to create lead',
            details: err.message,
            code: err.code
        });
    }
};

// Update a lead
const updateLead = async (req, res) => {
    const { id } = req.params;
    const p = req.body || {};

    try {
        const updateSql = `
            UPDATE leads
            SET
                name = COALESCE($1, name),
                email = COALESCE($2, email),
                phone = COALESCE($3, phone),
                company = COALESCE($4, company),
                designation = COALESCE($5, designation),
                city = COALESCE($6, city),
                state = COALESCE($7, state),
                country = COALESCE($8, country),
                industry = COALESCE($9, industry),
                notes = COALESCE($10, notes),
                rating = COALESCE($11, rating),
                status = COALESCE($12, status),
                follow_up_date = COALESCE($13, follow_up_date),
                additional_data = COALESCE($14, additional_data),
                updated_at = NOW()
            WHERE id = $15
            RETURNING *
        `;

        const values = [
            p.name,
            p.email,
            p.phone,
            p.company,
            p.designation,
            p.city,
            p.state,
            p.country,
            p.industry,
            p.notes,
            p.rating,
            p.status,
            p.followUpDate,
            p.additionalData,
            id
        ];

        const result = await pool.query(updateSql, values);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Lead not found' });
        }

        return res.json({
            success: true,
            lead: result.rows[0]
        });
    } catch (err) {
        console.error('updateLead error:', err);
        res.status(500).json({
            error: 'Failed to update lead',
            details: err.message
        });
    }
};

// Delete a lead
const deleteLead = async (req, res) => {
    const { id } = req.params;

    try {
        const result = await pool.query('DELETE FROM leads WHERE id = $1 RETURNING id', [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Lead not found' });
        }

        return res.json({ success: true, message: 'Lead deleted successfully' });
    } catch (err) {
        console.error('deleteLead error:', err);
        res.status(500).json({
            error: 'Failed to delete lead',
            details: err.message
        });
    }
};

module.exports = { getLeads, createLead, updateLead, deleteLead };
