const pool = require('../db');
const { v4: uuidv4 } = require('uuid');
const { sendEmailWithAttachments } = require('../services/notificationService');
const { generateAndStoreQR, getQRFullUrl } = require('../services/qrStorageService');

const getEvents = async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM events ORDER BY created_at DESC');
        return res.json(result.rows);
    } catch (dbErr) {
        console.error('Database error in getEvents:', dbErr);
        return res.status(500).json({ error: 'Failed to fetch events', details: dbErr.message });
    }
};

const createEvent = async (req, res) => {
    const payload = req.body || {};
    try {
        // Validate required fields
        const organizationId = payload.organizationId || payload.organization_id;

        if (!organizationId) {
            return res.status(400).json({
                error: 'Organization ID is required',
                message: 'Events must be associated with an organization. Please provide organizationId in the request.'
            });
        }

        // generate QR token and registration link
        const token = uuidv4();
        const base = process.env.INVITE_LINK_BASE || 'https://d36p7i1koir3da.cloudfront.net';
        const registration_link = `${base.replace(/\/$/, '')}?action=register&eventId=${payload.eventName || 'event'}&eventName=${encodeURIComponent(payload.eventName || 'Event')}&eventDate=${payload.startDate || ''}&token=${token}`;

        // Note: 'name' column exists for legacy reasons with NOT NULL constraint
        const eventName = payload.eventName || payload.event_name || 'Untitled Event';

        // First insert the event without qr_image_path (we need the ID first)
        const insertSql = `INSERT INTO events(
                organization_id, name, event_name, description, event_type, event_mode, industry,
                organizer_name, contact_person, organizer_email, organizer_mobile,
                venue, city, state, country, start_date, end_date,
                registration, lead_capture, communication, qr_token, registration_link, status,
                enable_stalls, stall_config, stall_types, ground_layout_url
            ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27) RETURNING *`;

        const values = [
            organizationId, // Use validated organizationId
            eventName, // for legacy 'name' column (NOT NULL)
            eventName, // for 'event_name' column
            payload.description || null,
            payload.eventType || payload.event_type || null,
            payload.eventMode || payload.event_mode || null,
            payload.industry || null,
            payload.organizerName || payload.organizer_name || null,
            payload.contactPerson || payload.contact_person || null,
            payload.organizerEmail || payload.organizer_email || null,
            payload.organizerMobile || payload.organizer_mobile || null,
            payload.venue || null,
            payload.city || null,
            payload.state || null,
            payload.country || null,
            payload.startDate || payload.start_date || null,
            payload.endDate || payload.end_date || null,
            // JSONB columns - need JSON.stringify
            JSON.stringify(payload.registration || {}),
            JSON.stringify(payload.leadCapture || payload.lead_capture || {}),
            JSON.stringify(payload.communication || {}),
            token,
            registration_link,
            payload.status || 'Draft',
            // New stall configuration fields
            payload.enableStalls || payload.enable_stalls || false,
            JSON.stringify(payload.stallConfig || payload.stall_config || {}),
            JSON.stringify(payload.stallTypes || payload.stall_types || []),
            payload.groundLayoutUrl || payload.ground_layout_url || null
        ];

        const result = await pool.query(insertSql, values);
        let created = result.rows[0];
        console.log('Event created successfully:', created.id);

        // Generate and store QR code
        let qrImagePath = null;
        let qrImageUrl = null;
        try {
            const qrResult = await generateAndStoreQR(registration_link, created.id);
            qrImagePath = qrResult.path;
            qrImageUrl = qrResult.fullUrl;

            // Update the event with the QR image path
            await pool.query(
                'UPDATE events SET qr_image_path = $1 WHERE id = $2',
                [qrImagePath, created.id]
            );
            created.qr_image_path = qrImagePath;
            console.log(`QR code stored for event ${created.id}: ${qrImagePath}`);
        } catch (qrError) {
            console.error('Failed to generate/store QR code:', qrError);
        }

        // Send email notification to organizer
        let emailStatus = { sent: false, email: null };
        if (payload.organizerEmail || payload.organizer_email) {
            const organizerEmail = payload.organizerEmail || payload.organizer_email;
            const startDate = payload.startDate || payload.start_date || 'TBD';
            const endDate = payload.endDate || payload.end_date || 'TBD';
            const venue = payload.venue || 'TBD';
            const city = payload.city || '';
            const state = payload.state || '';

            // Create professional HTML email template with QR image URL
            const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
        .container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%); color: white; padding: 40px 30px; text-align: center; }
        .header h1 { margin: 0; font-size: 28px; font-weight: 700; }
        .header p { margin: 10px 0 0 0; font-size: 14px; opacity: 0.9; }
        .content { padding: 40px 30px; }
        .event-details { background: #f8fafc; border-left: 4px solid #2563eb; padding: 20px; margin: 20px 0; border-radius: 8px; }
        .event-details h2 { margin: 0 0 15px 0; color: #1e293b; font-size: 20px; }
        .detail-row { margin: 10px 0; display: flex; }
        .detail-label { font-weight: 600; color: #475569; min-width: 100px; }
        .detail-value { color: #64748b; }
        .cta-button { display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; text-decoration: none; padding: 16px 40px; border-radius: 10px; font-weight: 700; margin: 20px 0; text-align: center; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3); font-size: 16px; }
        .cta-button:hover { background: linear-gradient(135deg, #059669 0%, #047857 100%); box-shadow: 0 6px 16px rgba(16, 185, 129, 0.4); }
        .qr-section { background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border: 2px solid #10b981; padding: 30px; border-radius: 12px; margin: 30px 0; text-align: center; }
        .qr-section h3 { color: #065f46; margin: 0 0 10px 0; font-size: 20px; }
        .qr-section p { color: #047857; margin: 10px 0 20px 0; font-size: 14px; }
        .qr-code-img { background: white; padding: 20px; border-radius: 12px; display: inline-block; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .link-box { background: #f1f5f9; padding: 15px; border-radius: 8px; margin: 20px 0; word-break: break-all; }
        .link-box a { color: #2563eb; text-decoration: none; font-size: 14px; }
        .footer { background: #f8fafc; padding: 20px 30px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎉 Event Created Successfully!</h1>
            <p>Your event registration is now live</p>
        </div>
        <div class="content">
            <p>Hello,</p>
            <p>Your event <strong>${eventName}</strong> has been successfully created and is ready to accept registrations.</p>
            
            <div class="event-details">
                <h2>Event Details</h2>
                <div class="detail-row">
                    <span class="detail-label">Event Name:</span>
                    <span class="detail-value">${eventName}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Start Date:</span>
                    <span class="detail-value">${startDate}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">End Date:</span>
                    <span class="detail-value">${endDate}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Venue:</span>
                    <span class="detail-value">${venue}${city ? ', ' + city : ''}${state ? ', ' + state : ''}</span>
                </div>
            </div>

            <p><strong>Share this registration link with your attendees:</strong></p>
            
            <div style="text-align: center;">
                <a href="${registration_link}" class="cta-button">🎯 Open Registration Page</a>
            </div>

            <div class="link-box">
                <strong>📋 Registration Link:</strong><br>
                <a href="${registration_link}" style="word-break: break-all;">${registration_link}</a>
                <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #e2e8f0;">
                    <p style="margin: 5px 0; font-size: 13px; color: #64748b;">
                        <strong>💡 Tip:</strong> Copy this link and share it via:
                    </p>
                    <ul style="margin: 10px 0; padding-left: 20px; font-size: 13px; color: #64748b;">
                        <li>Email campaigns to your attendee list</li>
                        <li>Social media posts (Facebook, LinkedIn, Twitter)</li>
                        <li>WhatsApp groups or direct messages</li>
                        <li>Your event website or landing page</li>
                    </ul>
                </div>
            </div>

            ${qrImageUrl ? `
            <div class="qr-section">
                <h3>📱 Scan to Register</h3>
                <p>Share this QR code with your attendees for quick registration</p>
                <div class="qr-code-img">
                    <img src="${qrImageUrl}" alt="Event Registration QR Code" width="200" style="display: block; margin: 0 auto;">
                </div>
                <p style="margin-top: 15px; font-size: 12px;">Attendees can scan this code with their phone camera to access the registration page instantly.</p>
            </div>
            ` : ''}

            <p>If you have any questions or need assistance, please don't hesitate to contact our support team.</p>
        </div>
        <div class="footer">
            <p>Powered by Billiton Event Management Platform</p>
            <p>This is an automated message. Please do not reply to this email.</p>
        </div>
    </div>
</body>
</html>
            `;

            const textContent = `
Event Created Successfully!

Your event "${eventName}" has been successfully created and is ready to accept registrations.

Event Details:
- Event Name: ${eventName}
- Start Date: ${startDate}
- End Date: ${endDate}
- Venue: ${venue}${city ? ', ' + city : ''}${state ? ', ' + state : ''}

Registration Link:
${registration_link}

Share this link with your attendees via email, social media, WhatsApp, or your website.

${qrImageUrl ? `QR Code Image: ${qrImageUrl}` : ''}

Powered by Billiton Event Management Platform
            `;

            // Send email (no attachments needed - QR is embedded via URL)
            try {
                const { sendEmail } = require('../services/notificationService');
                const emailResult = await sendEmail({
                    to: organizerEmail,
                    subject: `Event Created: ${eventName} - Registration Link`,
                    text: textContent,
                    html: htmlContent
                });

                if (emailResult.success) {
                    console.log(`Event creation email sent successfully to ${organizerEmail}`);
                    emailStatus = { sent: true, email: organizerEmail };
                } else {
                    console.error(`Failed to send event creation email to ${organizerEmail}:`, emailResult.error);
                    emailStatus = { sent: false, email: organizerEmail, error: emailResult.error };
                }
            } catch (emailErr) {
                console.error(`Error sending event creation email to ${organizerEmail}:`, emailErr);
                emailStatus = { sent: false, email: organizerEmail, error: emailErr.message };
            }
        }

        // Include email status and QR URL in response
        return res.status(201).json({
            ...created,
            qrImageUrl: qrImageUrl,
            emailStatus
        });
    } catch (err) {
        console.error('createEvent error:', err);
        res.status(500).json({
            error: 'Failed to create event',
            details: err.message,
            code: err.code
        });
    }
};

const getEventByToken = async (req, res) => {
    const { token } = req.params;
    try {
        const result = await pool.query(
            'SELECT id, event_name, name, start_date, end_date, venue, city, state, qr_image_path FROM events WHERE qr_token = $1',
            [token]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Event not found' });
        }

        const event = result.rows[0];
        // Add full QR URL if path exists
        if (event.qr_image_path) {
            event.qr_image_url = getQRFullUrl(event.qr_image_path);
        }

        return res.json(event);
    } catch (error) {
        console.error('Error fetching event by token:', error);
        return res.status(500).json({ error: 'Failed to fetch event' });
    }
};

// Update event ground layout
const updateEventGroundLayout = async (req, res) => {
    const { id } = req.params;
    const { groundLayoutUrl } = req.body;

    try {
        const result = await pool.query(
            'UPDATE events SET ground_layout_url = $1 WHERE id = $2 RETURNING *',
            [groundLayoutUrl, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Event not found' });
        }

        console.log(`Ground layout updated for event ${id}: ${groundLayoutUrl}`);
        return res.json({
            success: true,
            message: 'Ground layout updated successfully',
            event: result.rows[0]
        });
    } catch (error) {
        console.error('Error updating ground layout:', error);
        return res.status(500).json({ error: 'Failed to update ground layout' });
    }
};

module.exports = { getEvents, createEvent, getEventByToken, updateEventGroundLayout };