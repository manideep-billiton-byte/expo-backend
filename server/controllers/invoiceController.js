const pool = require('../db');

console.log('Loaded invoiceController');

const getInvoices = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                i.*,
                o.name as organization_name
            FROM invoices i
            LEFT JOIN organizations o ON o.id = i.organization_id
            ORDER BY i.created_at DESC
        `);
        return res.json(result.rows);
    } catch (dbErr) {
        console.error('Database error in getInvoices:', dbErr);
        return res.status(500).json({ error: 'Failed to fetch invoices', details: dbErr.message });
    }
};

const createInvoice = async (req, res) => {
    const p = req.body || {};
    try {
        // generate a simple invoice number
        const invoice_number = `INV-${Date.now()}`;

        // Properly format items for JSONB - must be stringified
        const itemsArray = Array.isArray(p.items) ? p.items : [];
        const itemsJson = JSON.stringify(itemsArray);

        const insertSql = `INSERT INTO invoices(
            invoice_number, organization_id, billing_email, billing_address, tax_id,
            plan_type, amount, currency, due_date, payment_method, items, notes, terms_accepted, status
        ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`;

        const values = [
            invoice_number,
            p.organizationId || p.organization_id || null,
            p.billingEmail || null,
            p.billingAddress || null,
            p.taxId || null,
            p.planType || p.plan_type || null,
            p.amount || 0,
            p.currency || 'INR',
            p.dueDate || null,
            p.paymentMethod || null,
            itemsJson,
            p.notes || null,
            p.terms || p.terms_accepted || false,
            p.status || 'Pending'
        ];

        const result = await pool.query(insertSql, values);
        console.log('Invoice created successfully:', result.rows[0].id);
        return res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('createInvoice error:', err);
        res.status(500).json({
            error: 'Failed to create invoice',
            details: err.message,
            code: err.code
        });
    }
};

module.exports = { getInvoices, createInvoice };
