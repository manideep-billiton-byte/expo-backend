const express = require('express');
const cors = require('cors');
const multer = require('multer');
const organizationController = require('./controllers/organizationController');
const eventController = require('./controllers/eventController');
const exhibitorController = require('./controllers/exhibitorController');
const visitorController = require('./controllers/visitorController');
const invoiceController = require('./controllers/invoiceController');
const leadController = require('./controllers/leadController');
const scannedVisitorsController = require('./controllers/scannedVisitorsController');
const uploadController = require('./controllers/uploadController');
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('./db');

// Configure multer for file uploads
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, 'ground-layout-' + uniqueSuffix + ext);
    }
});
const uploadMulter = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
    fileFilter: (req, file, cb) => {
        const allowed = ['.jpg', '.jpeg', '.png', '.pdf'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowed.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only JPG, PNG, PDF allowed.'));
        }
    }
});

// Global error handlers to prevent server crash
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err.message, err.stack);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

const app = express();
const port = process.env.PORT || 5000;

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
    credentials: false
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Mock Data (will be replaced by DB queries)
const dashboardData = {
    stats: [
        { label: "Active Tenants", value: "248", change: "+12 this month", icon: "Building2", colorClass: "text-blue-500" },
        { label: "Active Events", value: "42", change: "8 ongoing", icon: "Calendar", colorClass: "text-emerald-500" },
        { label: "Total Exhibitors", value: "1,847", change: "+150 this week", icon: "ImageIcon", colorClass: "text-purple-500" },
        { label: "Registered Visitors", value: "24,582", change: "+2,340 today", icon: "Users", colorClass: "text-blue-400" },
        { label: "Leads Captured", value: "18,429", change: "+842 today", icon: "MousePointer2", colorClass: "text-orange-500" },
        { label: "Messages Sent", value: "45,621", change: "+1,234 today", icon: "MessageSquare", colorClass: "text-cyan-500" },
        { label: "Revenue (MTD)", value: "₹12.4L", change: "+15% vs last month", icon: "IndianRupee", colorClass: "text-emerald-600" },
        { label: "Active Users", value: "892", change: "Online now", icon: "UserCheck", colorClass: "text-teal-500" }
    ],
    liveEvents: [
        { name: 'Tech Summit 2025', org: 'ABC - ORG', leads: '2,847', exhibitors: '156', visitors: '12,450', status: 'Done' },
        { name: 'Digital Marketing Expo', org: 'XYZ - ORG', leads: '1,532', exhibitors: '89', visitors: '8,780', status: 'Live' },
        { name: 'Healthcare Innovation Summit', org: '123 - ORG', leads: '945', exhibitors: '67', visitors: '4,230', status: 'Upcoming' }
    ],
    leadStats: {
        sources: [
            { type: 'Visitor Qr', count: '2,134', status: 'Good', color: '#10b981' },
            { type: 'Stall Qr', count: '1,456', status: 'Good', color: '#10b981' },
            { type: 'Ocr', count: '822', status: 'Warning', color: '#f59e0b' },
            { type: 'Manual', count: '2,134', status: 'Good', color: '#10b981' }
        ],
        totals: [
            { label: 'QR Scan', value: '1,00,000' },
            { label: 'OCR / Card', value: '5,00,000' },
            { label: 'Manual', value: '10,000' }
        ],
        conversionRate: "88.5%"
    }
};

// API Routes
app.get('/api/dashboard', (req, res) => {
    res.json(dashboardData);
});

// Invite endpoint
app.post('/api/send-invite', organizationController.inviteOrganization);
// Create organization directly
app.post('/api/create-organization', organizationController.createOrganization);
// List organizations
app.get('/api/organizations', organizationController.getOrganizations);
// Organization login
app.post('/api/organization-login', organizationController.loginOrganization);
// Create plan
app.post('/api/create-plan', organizationController.createPlan);
// Verify coupon
app.post('/api/verify-coupon', organizationController.verifyCoupon);
// List plans
app.get('/api/plans', organizationController.getPlans);
// List coupons
app.get('/api/coupons', organizationController.getCoupons);
// Exhibitor login
app.post('/api/exhibitor-login', exhibitorController.loginExhibitor);
// Visitor login
app.post('/api/visitor-login', visitorController.loginVisitor);

// Unified login endpoint (organization/exhibitor/visitor)
app.post('/api/login', async (req, res) => {
    const { email, password, type } = req.body || {};

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    const tryOrder = Array.isArray(type) ? type : (type ? [type] : ['organization', 'exhibitor', 'visitor']);

    const handlers = {
        organization: organizationController.loginOrganization,
        exhibitor: exhibitorController.loginExhibitor,
        visitor: visitorController.loginVisitor
    };

    // Try each handler in order. If handler rejects with invalid credentials, continue.
    for (const t of tryOrder) {
        const handler = handlers[t];
        if (!handler) continue;

        let handled = false;

        const wrappedRes = {
            status: (code) => {
                return {
                    json: (payload) => {
                        // only treat invalid-credentials as "try next"
                        if (code === 401 && payload && (payload.error || '').toLowerCase().includes('invalid')) {
                            return;
                        }
                        handled = true;
                        return res.status(code).json(payload);
                    }
                };
            },
            json: (payload) => {
                handled = true;
                // normalize org login response to unified shape
                if (payload && payload.success && payload.organization) {
                    return res.json({
                        success: true,
                        userType: 'organization',
                        user: {
                            id: payload.organization.id,
                            name: payload.organization.orgName,
                            email: payload.organization.email
                        }
                    });
                }
                return res.json(payload);
            }
        };

        await handler(req, wrappedRes);

        // If handler produced a non-401 response it already returned via res.
        if (handled) return;
    }

    return res.status(401).json({ error: 'Invalid email or password' });
});
// Create user
app.post('/api/users', organizationController.createUser);

// Plans & Coupons
app.post('/api/create-plan', organizationController.createPlan);
app.post('/api/verify-coupon', organizationController.verifyCoupon);

// Events
app.get('/api/events', eventController.getEvents);
app.post('/api/events', eventController.createEvent);
app.get('/api/events/by-token/:token', eventController.getEventByToken);
app.put('/api/events/:id/ground-layout', eventController.updateEventGroundLayout);

// Exhibitors
app.get('/api/exhibitors', exhibitorController.getExhibitors);
app.post('/api/exhibitors', exhibitorController.createExhibitor);
app.get('/api/exhibitors/upcoming-events/:organizationId', exhibitorController.getUpcomingEventsByOrganization);
app.post('/api/exhibitors/register-event', exhibitorController.registerExhibitorForEvent);


// Visitors
app.get('/api/visitors', visitorController.getVisitors);
app.post('/api/visitors', visitorController.createVisitor);
app.get('/api/visitors/code/:uniqueCode', visitorController.getVisitorByCode);

// Invoices
app.get('/api/invoices', invoiceController.getInvoices);
app.post('/api/invoices', invoiceController.createInvoice);

// Leads
app.get('/api/leads', leadController.getLeads);
app.post('/api/leads', leadController.createLead);
app.put('/api/leads/:id', leadController.updateLead);
app.delete('/api/leads/:id', leadController.deleteLead);

// Scanned Visitors (QR and OCR scans)
app.post('/api/scanned-visitors', scannedVisitorsController.saveScannedVisitor);
app.get('/api/scanned-visitors', scannedVisitorsController.getScannedVisitors);
app.get('/api/scanned-visitors/stats', scannedVisitorsController.getScanStats);
app.put('/api/scanned-visitors/:id', scannedVisitorsController.updateScannedVisitor);
app.delete('/api/scanned-visitors/:id', scannedVisitorsController.deleteScannedVisitor);

// File Uploads
app.post('/api/upload/ground-layout', uploadMulter.single('file'), uploadController.uploadGroundLayout);

// GSTIN Verification
const gstService = require('./services/gstService');
app.post('/api/verify-gstin', async (req, res) => {
    try {
        const { gstin } = req.body;

        if (!gstin) {
            return res.status(400).json({
                success: false,
                error: 'GSTIN is required'
            });
        }

        // Get client IP for rate limiting (or use 'global' for simplicity)
        const identifier = req.ip || req.connection.remoteAddress || 'global';

        const result = await gstService.verifyGSTIN(gstin, identifier);

        if (result.success) {
            return res.json(result);
        } else {
            // Return error with appropriate status code
            const statusCode = result.errorCode === 'RATE_LIMIT_EXCEEDED' ? 429 : 400;
            return res.status(statusCode).json(result);
        }
    } catch (error) {
        console.error('GSTIN verification endpoint error:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: error.message
        });
    }
});


// Debug: list registered routes
app.get('/__routes', (req, res) => {
    try {
        const stack = app._router ? app._router.stack : [];
        const routes = stack
            .filter(r => r && r.route && r.route.path)
            .map(r => ({ path: r.route.path, methods: r.route.methods }));
        res.json({ routes, hasRouter: !!app._router });
    } catch (e) {
        res.status(500).json({ error: String(e) });
    }
});

// Debug: check table columns
app.get('/__table/:tableName', async (req, res) => {
    try {
        const { tableName } = req.params;
        const result = await pool.query(`
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns
            WHERE table_name = $1
            ORDER BY ordinal_position
        `, [tableName]);
        res.json({ table: tableName, columns: result.rows });
    } catch (e) {
        res.status(500).json({ error: String(e) });
    }
});

const server = app.listen(port, async () => {
    console.log(`Server running on port ${port}`);

    // Heartbeat to keep event loop active
    setInterval(() => {
        // Just keeping the process alive
    }, 60000);

    // Run schema.sql and migrations on startup
    try {
        const schemaPath = path.join(__dirname, 'schema.sql');
        if (fs.existsSync(schemaPath)) {
            const schemaSql = fs.readFileSync(schemaPath, 'utf8');
            await pool.query(schemaSql);
            console.log('Database schema synchronized from schema.sql');
        }

        const migrationsDir = path.join(__dirname, 'migrations');
        if (fs.existsSync(migrationsDir)) {
            const files = fs.readdirSync(migrationsDir).sort();
            for (const file of files) {
                if (file.endsWith('.sql')) {
                    const migPath = path.join(migrationsDir, file);
                    const sql = fs.readFileSync(migPath, 'utf8');
                    // Special handling for 001_create_organization_invites.sql which has functions/triggers
                    if (file === '001_create_organization_invites.sql') {
                        const splitIdx = sql.search(/CREATE OR REPLACE FUNCTION/i);
                        const safeSql = splitIdx >= 0 ? sql.slice(0, splitIdx) : sql;
                        await pool.query(safeSql);
                    } else {
                        await pool.query(sql);
                    }
                    console.log(`Ran migration: ${file}`);
                }
            }
        }
    } catch (err) {
        console.error('Database initialization error:', err.message || err);
    }
});

server.on('error', (err) => {
    console.error('Server error:', err);
    if (err.code === 'EADDRINUSE') {
        console.error(`Port ${port} is already in use. Please kill the process using it.`);
        process.exit(1);
    }
});
