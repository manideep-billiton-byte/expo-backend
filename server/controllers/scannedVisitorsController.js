/**
 * Scanned Visitors Controller
 * 
 * Handles saving and retrieving visitor scans from exhibitors
 */

const pool = require('../db');

console.log('Loaded scannedVisitorsController');

/**
 * Save a scanned visitor (QR or OCR scan)
 */
const saveScannedVisitor = async (req, res) => {
    const {
        exhibitorId,
        eventId,
        visitorId,
        scanType, // 'QR_SCAN' or 'OCR'
        visitorName,
        visitorEmail,
        visitorPhone,
        visitorCompany,
        visitorDesignation,
        visitorUniqueCode,
        ocrRawText,
        notes,
        interestLevel
    } = req.body;

    // Validate required fields
    if (!scanType || !['QR_SCAN', 'OCR'].includes(scanType)) {
        return res.status(400).json({
            error: 'Invalid scan_type. Must be QR_SCAN or OCR'
        });
    }

    try {
        const insertSQL = `
            INSERT INTO exhibitor_scanned_visitors (
                exhibitor_id,
                event_id,
                visitor_id,
                scan_type,
                visitor_name,
                visitor_email,
                visitor_phone,
                visitor_company,
                visitor_designation,
                visitor_unique_code,
                ocr_raw_text,
                notes,
                interest_level,
                scanned_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
            RETURNING *
        `;

        const values = [
            exhibitorId || null,
            eventId || null,
            visitorId || null,
            scanType,
            visitorName || null,
            visitorEmail || null,
            visitorPhone || null,
            visitorCompany || null,
            visitorDesignation || null,
            visitorUniqueCode || null,
            ocrRawText || null,
            notes || null,
            interestLevel || null
        ];

        const result = await pool.query(insertSQL, values);

        console.log(`✅ Saved ${scanType} scan for exhibitor ${exhibitorId}`);

        return res.status(201).json({
            success: true,
            message: 'Scan saved successfully',
            scan: result.rows[0]
        });

    } catch (error) {
        console.error('Error saving scanned visitor:', error);
        return res.status(500).json({
            error: 'Failed to save scan',
            details: error.message
        });
    }
};

/**
 * Get all scanned visitors for an exhibitor
 */
const getScannedVisitors = async (req, res) => {
    const { exhibitorId, scanType, eventId } = req.query;

    try {
        let query = `
            SELECT 
                esv.*,
                e.company_name as exhibitor_company,
                ev.event_name
            FROM exhibitor_scanned_visitors esv
            LEFT JOIN exhibitors e ON e.id = esv.exhibitor_id
            LEFT JOIN events ev ON ev.id = esv.event_id
            WHERE 1=1
        `;
        const params = [];
        let paramIndex = 1;

        if (exhibitorId) {
            query += ` AND esv.exhibitor_id = $${paramIndex}`;
            params.push(exhibitorId);
            paramIndex++;
        }

        if (scanType) {
            query += ` AND esv.scan_type = $${paramIndex}`;
            params.push(scanType);
            paramIndex++;
        }

        if (eventId) {
            query += ` AND esv.event_id = $${paramIndex}`;
            params.push(eventId);
            paramIndex++;
        }

        query += ` ORDER BY esv.scanned_at DESC`;

        const result = await pool.query(query, params);

        return res.json({
            success: true,
            count: result.rows.length,
            scans: result.rows
        });

    } catch (error) {
        console.error('Error fetching scanned visitors:', error);
        return res.status(500).json({
            error: 'Failed to fetch scans',
            details: error.message
        });
    }
};

/**
 * Get scan statistics for an exhibitor
 */
const getScanStats = async (req, res) => {
    const { exhibitorId } = req.query;

    try {
        let whereClause = '';
        const params = [];

        if (exhibitorId) {
            whereClause = 'WHERE exhibitor_id = $1';
            params.push(exhibitorId);
        }

        const statsQuery = `
            SELECT 
                COUNT(*) as total_scans,
                COUNT(CASE WHEN scan_type = 'QR_SCAN' THEN 1 END) as qr_scans,
                COUNT(CASE WHEN scan_type = 'OCR' THEN 1 END) as ocr_scans,
                COUNT(DISTINCT visitor_email) as unique_visitors,
                COUNT(CASE WHEN DATE(scanned_at) = CURRENT_DATE THEN 1 END) as today_scans
            FROM exhibitor_scanned_visitors
            ${whereClause}
        `;

        const result = await pool.query(statsQuery, params);

        return res.json({
            success: true,
            stats: result.rows[0]
        });

    } catch (error) {
        console.error('Error fetching scan stats:', error);
        return res.status(500).json({
            error: 'Failed to fetch stats',
            details: error.message
        });
    }
};

/**
 * Update a scanned visitor record
 */
const updateScannedVisitor = async (req, res) => {
    const { id } = req.params;
    const {
        visitorName,
        visitorEmail,
        visitorPhone,
        visitorCompany,
        visitorDesignation,
        notes,
        leadStatus,
        interestLevel,
        followUpDate
    } = req.body;

    try {
        const updateSQL = `
            UPDATE exhibitor_scanned_visitors
            SET 
                visitor_name = COALESCE($1, visitor_name),
                visitor_email = COALESCE($2, visitor_email),
                visitor_phone = COALESCE($3, visitor_phone),
                visitor_company = COALESCE($4, visitor_company),
                visitor_designation = COALESCE($5, visitor_designation),
                notes = COALESCE($6, notes),
                lead_status = COALESCE($7, lead_status),
                interest_level = COALESCE($8, interest_level),
                follow_up_date = $9,
                updated_at = NOW()
            WHERE id = $10
            RETURNING *
        `;

        const values = [
            visitorName,
            visitorEmail,
            visitorPhone,
            visitorCompany,
            visitorDesignation,
            notes,
            leadStatus,
            interestLevel,
            followUpDate || null,
            id
        ];

        const result = await pool.query(updateSQL, values);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Scan not found' });
        }

        return res.json({
            success: true,
            message: 'Scan updated successfully',
            scan: result.rows[0]
        });

    } catch (error) {
        console.error('Error updating scanned visitor:', error);
        return res.status(500).json({
            error: 'Failed to update scan',
            details: error.message
        });
    }
};

/**
 * Delete a scanned visitor record
 */
const deleteScannedVisitor = async (req, res) => {
    const { id } = req.params;

    try {
        const result = await pool.query(
            'DELETE FROM exhibitor_scanned_visitors WHERE id = $1 RETURNING id',
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Scan not found' });
        }

        return res.json({
            success: true,
            message: 'Scan deleted successfully'
        });

    } catch (error) {
        console.error('Error deleting scanned visitor:', error);
        return res.status(500).json({
            error: 'Failed to delete scan',
            details: error.message
        });
    }
};

module.exports = {
    saveScannedVisitor,
    getScannedVisitors,
    getScanStats,
    updateScannedVisitor,
    deleteScannedVisitor
};
