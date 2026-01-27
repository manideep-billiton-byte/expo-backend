const { v4: uuidv4 } = require('uuid');
const pool = require('../db');
const { sendEmail, sendSMS } = require('../services/notificationService');

// Generate a secure token for invites
const generateInviteToken = () => {
    return uuidv4();
};

// Send organization invite
const inviteOrganization = async (req, res) => {
    console.log('>>> inviteOrganization called with body:', JSON.stringify(req.body));
    const { email, mobile } = req.body;

    if (!email && !mobile) {
        return res.status(400).json({ error: 'Email or mobile is required' });
    }

    // Test credentials that bypass duplicate validation
    // Detect test credentials by pattern (not hardcoded values)
    // Test emails contain 'test@', test mobile numbers start with '0000'
    const isTestCredentials = (email && email.includes('test@')) || (mobile && mobile.startsWith('0000'));

    // Bypass validation for specific email/phone (for admin testing)
    const BYPASS_EMAILS = ['alupulamanideep@gmail.com', 'projects@btsind.com'];
    const BYPASS_MOBILE = '+917893911194';
    const isBypassCredentials = (email && BYPASS_EMAILS.includes(email)) || (mobile === BYPASS_MOBILE);

    console.log('>>> Getting database client...');
    const client = await pool.connect();
    console.log('>>> Got database client, starting transaction...');
    try {
        await client.query('BEGIN');
        console.log('>>> Transaction started');

        // Skip duplicate check for test credentials OR bypass credentials
        if (!isTestCredentials && !isBypassCredentials) {
            // Check for existing pending invite
            const existingInvite = await client.query(
                `SELECT * FROM organization_invites 
                 WHERE (email = $1 OR mobile = $2) 
                 AND status = 'PENDING' 
                 AND expires_at > NOW()`,
                [email, mobile]
            );

            if (existingInvite.rows.length > 0) {
                return res.status(400).json({
                    error: 'An active invite already exists for this email or mobile',
                    invite: existingInvite.rows[0]
                });
            }
        } else if (isTestCredentials) {
            console.log('>>> Using test credentials - skipping duplicate check');
            // Delete any existing pending invites for test credentials to allow re-testing
            await client.query(
                `DELETE FROM organization_invites 
                 WHERE (email = $1 OR mobile = $2) 
                 AND status = 'PENDING'`,
                [email, mobile]
            );
        } else if (isBypassCredentials) {
            console.log('>>> Using bypass credentials - skipping duplicate check');
            // Delete any existing pending invites for bypass credentials to allow re-testing
            await client.query(
                `DELETE FROM organization_invites 
                 WHERE (email = $1 OR mobile = $2) 
                 AND status = 'PENDING'`,
                [email, mobile]
            );
        }

        // Generate token and set expiry (48 hours from now)
        const inviteToken = generateInviteToken();
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 48);

        // Create invite in database
        const newInvite = await client.query(
            `INSERT INTO organization_invites 
             (email, mobile, invite_token, status, expires_at)
             VALUES ($1, $2, $3, 'PENDING', $4)
             RETURNING *`,
            [email, mobile, inviteToken, expiresAt]
        );

        // Send invite via email and/or SMS
        const inviteLink = `${process.env.INVITE_LINK_BASE || 'https://app.example.com/organization/register'}?token=${inviteToken}`;

        let emailSent = false;
        let smsSent = false;

        // For test credentials, skip actual email/SMS sending (use mock mode)
        if (isTestCredentials) {
            console.log('>>> Test credentials detected - using mock email/SMS');
            console.log('>>> Mock email would be sent to:', email);
            console.log('>>> Mock SMS would be sent to:', mobile);
            console.log('>>> Invite link:', inviteLink);
            emailSent = true;  // Mark as sent for response
            smsSent = true;    // Mark as sent for response
        } else {
            // Normal email/SMS sending for non-test credentials
            if (email) {
                try {
                    const emailResult = await sendEmail({
                        to: email,
                        subject: 'You\'re Invited to Create an Organization',
                        text: `You have been invited to create an organization. Click the link to get started: ${inviteLink}`,
                        html: `
                            <h2>Organization Invitation</h2>
                            <p>You have been invited to create an organization on our platform.</p>
                            <p><a href="${inviteLink}">Click here to accept the invitation</a></p>
                            <p>This link will expire in 48 hours.</p>
                        `
                    });

                    if (emailResult && emailResult.success) {
                        emailSent = true;
                        console.log('Organization invite email sent to:', email);
                    } else {
                        console.error('Failed to send invite email:', emailResult ? emailResult.error : 'Unknown error');
                    }
                } catch (emailErr) {
                    console.error('Failed to send invite email:', emailErr.message);
                    // Don't crash - continue with the process
                }
            }

            if (mobile) {
                try {
                    const smsResult = await sendSMS({
                        to: mobile,
                        body: `You're invited to create an organization: ${inviteLink} (Expires in 48h)`
                    });

                    if (smsResult && smsResult.success) {
                        smsSent = true;
                        console.log('Organization invite SMS sent to:', mobile);
                    } else {
                        console.error('Failed to send invite SMS:', smsResult ? smsResult.error : 'Unknown error');
                    }
                } catch (smsErr) {
                    console.error('Failed to send invite SMS:', smsErr.message);
                    // Don't crash - continue with the process
                }
            }
        }

        await client.query('COMMIT');

        res.status(201).json({
            success: true,
            message: 'Invite sent successfully',
            invite: newInvite.rows[0],
            inviteLink: isTestCredentials ? inviteLink : undefined,  // Include link for test mode
            emailSent,
            smsSent
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error sending organization invite:', error.message, error.stack);
        res.status(500).json({
            error: 'Failed to send organization invite',
            details: error.message
        });
    } finally {
        client.release();
    }
};

// List organizations (exclude sensitive columns)
const getOrganizations = async (req, res) => {
    const client = await pool.connect();
    try {
        const colRes = await client.query(
            "SELECT column_name FROM information_schema.columns WHERE table_name='organizations'"
        );
        const cols = colRes.rows.map(r => r.column_name).filter(c => c !== 'password_hash');

        if (cols.length === 0) {
            return res.json([]);
        }

        const selectCols = cols.map(c => `"${c}"`).join(', ');
        const hasCreatedAt = cols.includes('created_at');
        const hasId = cols.includes('id');
        const orderBy = hasCreatedAt ? '"created_at" DESC' : (hasId ? '"id" DESC' : `"${cols[0]}"`);

        const result = await client.query(`SELECT ${selectCols} FROM organizations ORDER BY ${orderBy}`);
        return res.json(result.rows);
    } catch (err) {
        console.error('Database error in getOrganizations:', err);
        return res.status(500).json({ error: 'Failed to fetch organizations', details: err.message });
    } finally {
        client.release();
    }
};

// Validate invite token
const validateInvite = async (req, res) => {
    const { token } = req.query;

    if (!token) {
        return res.status(400).json({ error: 'Invite token is required' });
    }

    try {
        const result = await pool.query(
            `SELECT * FROM organization_invites 
             WHERE invite_token = $1 
             AND status = 'PENDING'
             AND expires_at > NOW()`,
            [token]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                valid: false,
                error: 'Invalid or expired invite token'
            });
        }

        res.json({
            valid: true,
            invite: result.rows[0]
        });

    } catch (error) {
        console.error('Error validating invite token:', error);
        res.status(500).json({
            error: 'Failed to validate invite token',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Create organization from invite
const createOrganizationFromInvite = async (req, res) => {
    const { token } = req.query;
    const { name, email, mobile } = req.body;

    if (!token) {
        return res.status(400).json({ error: 'Invite token is required' });
    }

    if (!name) {
        return res.status(400).json({ error: 'Organization name is required' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Get and validate invite
        const inviteResult = await client.query(
            `SELECT * FROM organization_invites 
             WHERE invite_token = $1 
             AND status = 'PENDING'
             AND expires_at > NOW()
             FOR UPDATE`,
            [token]
        );

        if (inviteResult.rows.length === 0) {
            return res.status(400).json({
                error: 'Invalid, expired, or already used invite token'
            });
        }

        const invite = inviteResult.rows[0];

        // Check if organization with this email already exists
        const orgExists = await client.query(
            'SELECT id FROM organizations WHERE primary_email = $1',
            [invite.email]
        );

        if (orgExists.rows.length > 0) {
            return res.status(409).json({
                error: 'An organization with this email already exists'
            });
        }

        // Create organization
        const orgResult = await client.query(
            `INSERT INTO organizations 
             (org_name, primary_email, primary_mobile, status, created_at, updated_at)
             VALUES ($1, $2, $3, 'ACTIVE', NOW(), NOW())
             RETURNING *`,
            [name, invite.email, invite.mobile]
        );

        // Mark invite as accepted
        await client.query(
            `UPDATE organization_invites 
             SET status = 'ACCEPTED', updated_at = NOW()
             WHERE id = $1`,
            [invite.id]
        );

        await client.query('COMMIT');

        // Send welcome email
        try {
            await sendEmail({
                to: invite.email,
                subject: 'Your Organization Has Been Created',
                text: `Your organization "${name}" has been successfully created.`,
                html: `
                    <h2>Welcome to Our Platform</h2>
                    <p>Your organization <strong>${name}</strong> has been successfully created.</p>
                    <p>You can now log in and start using our services.</p>
                `
            });
        } catch (emailError) {
            console.error('Failed to send welcome email:', emailError);
            // Don't fail the request if email sending fails
        }

        res.status(201).json({
            success: true,
            message: 'Organization created successfully',
            organization: orgResult.rows[0]
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error creating organization from invite:', error);
        res.status(500).json({
            error: 'Failed to create organization',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    } finally {
        client.release();
    }
};

module.exports = {
    inviteOrganization,
    validateInvite,
    createOrganizationFromInvite,
    getOrganizations,
    // Create organization without invite (direct creation from admin UI)
    createOrganization: async (req, res) => {
        const data = req.body || {};
        const {
            orgName,
            tradeName,
            tenantType,
            industry,
            size,
            apiAccess,
            businessType,
            isRegistered,
            email,
            mobile,
            password,
            state,
            district,
            town,
            address,
            contactName,
            contactEmail,
            contactPhone,
            altPhone,
            website,
            gstNumber,
            panNumber,
            regNumber,
            dateInc,
            isVerified,
            features,
            plan
        } = data;

        if (!orgName) return res.status(400).json({ error: 'Organization name is required' });

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            console.log('Creating organization with data:', JSON.stringify(data));

            // get existing columns for organizations table so we can adapt to schema
            const colRes = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name='organizations'");
            const cols = new Set(colRes.rows.map(r => r.column_name));

            const fieldMap = {
                orgName: ['org_name', 'name'],
                tradeName: ['trade_name'],
                tenantType: ['tenant_type'],
                industry: ['industry'],
                size: ['size'],
                apiAccess: ['api_access'],
                businessType: ['business_type'],
                isRegistered: ['is_registered'],
                email: ['primary_email', 'email'],
                mobile: ['primary_mobile', 'phone'],
                state: ['state'],
                district: ['district'],
                town: ['town'],
                address: ['address'],
                contactName: ['contact_name'],
                contactEmail: ['contact_email', 'email'],
                contactPhone: ['contact_phone', 'phone'],
                altPhone: ['alt_phone'],
                website: ['website'],
                gstNumber: ['gst_number'],
                panNumber: ['pan_number'],
                regNumber: ['reg_number'],
                dateInc: ['date_inc'],
                isVerified: ['is_verified'],
                features: ['features'],
                plan: ['plan']
            };

            const columns = [];
            const placeholders = [];
            const values = [];
            const seenCols = new Set();
            let idx = 1;

            for (const [key, candidates] of Object.entries(fieldMap)) {
                for (const col of candidates) {
                    if (cols.has(col) && !seenCols.has(col)) {
                        const val = (function () {
                            switch (key) {
                                case 'isRegistered': return isRegistered === 'yes' || isRegistered === true || isRegistered === 'true';
                                case 'apiAccess': return apiAccess === true || apiAccess === 'true';
                                case 'isVerified': return isVerified === true || isVerified === 'true';
                                case 'features': return Array.isArray(features) ? features : (features ? features : []);
                                case 'dateInc': return dateInc ? new Date(dateInc) : null;
                                case 'orgName': return orgName;
                                case 'tradeName': return tradeName;
                                case 'tenantType': return tenantType;
                                case 'industry': return industry;
                                case 'size': return size;
                                case 'businessType': return businessType;
                                case 'email': return email;
                                case 'mobile': return mobile;
                                case 'state': return state;
                                case 'district': return district;
                                case 'town': return town;
                                case 'address': return address;
                                case 'contactName': return contactName;
                                case 'contactEmail': return contactEmail;
                                case 'contactPhone': return contactPhone;
                                case 'altPhone': return altPhone;
                                case 'website': return website;
                                case 'gstNumber': return gstNumber;
                                case 'panNumber': return panNumber;
                                case 'regNumber': return regNumber;
                                case 'plan': return plan;
                                default: return data[key];
                            }
                        })();

                        columns.push(col);
                        placeholders.push(`$${idx++}`);
                        values.push(val);
                        seenCols.add(col);
                        break; // use first matching candidate column
                    }
                }
            }

            // Generate and hash default password for organization login
            let pwHash = null;
            let defaultPassword = null;
            if (cols.has('password_hash')) {
                const bcrypt = require('bcryptjs');
                if (password) {
                    pwHash = bcrypt.hashSync(password, 10);
                } else {
                    // Generate default password: emailPrefix@123 (or orgName@123)
                    defaultPassword = email ? `${email.split('@')[0]}@123` : `${orgName.replace(/\s+/g, '').toLowerCase()}@123`;
                    pwHash = bcrypt.hashSync(defaultPassword, 10);
                }
                columns.push('password_hash');
                placeholders.push(`$${idx++}`);
                values.push(pwHash);
            }

            // ensure status/created_at/updated_at if present
            if (cols.has('status') && !seenCols.has('status')) {
                columns.push('status');
                placeholders.push(`$${idx++}`);
                values.push('Active');
            }
            if (cols.has('created_at')) {
                columns.push('created_at');
                placeholders.push('NOW()');
            }
            if (cols.has('updated_at')) {
                columns.push('updated_at');
                placeholders.push('NOW()');
            }

            if (columns.length === 0) {
                throw new Error('No matching columns found in organizations table');
            }

            const sql = `INSERT INTO organizations (${columns.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`;
            console.log('Executing SQL:', sql, 'Values:', values);

            const result = await client.query(sql, values);
            await client.query('COMMIT');

            // Send welcome email and SMS notifications
            let emailSent = false;
            let smsSent = false;

            // Check if using test credentials (for development/testing)
            const isTestCredentials = (email && email.includes('test@')) ||
                (mobile && mobile.startsWith('0000'));

            if (isTestCredentials) {
                console.log('Test credentials detected - skipping actual email/SMS sending');
                emailSent = true;  // Mark as sent for response
                smsSent = true;    // Mark as sent for response
            } else {
                // Send welcome email with credentials
                if (email || contactEmail) {
                    try {
                        const recipientEmail = email || contactEmail;
                        const loginPassword = password || defaultPassword;

                        // Generate login link
                        const baseUrl = process.env.INVITE_LINK_BASE || 'http://localhost:5173';
                        const loginLink = `${baseUrl.replace('/invite', '')}?type=organization`;

                        const emailResult = await sendEmail({
                            to: recipientEmail,
                            subject: 'Welcome to Expo Event Management Platform',
                            text: `Your organization "${orgName}" has been successfully created.\n\nLogin Credentials:\nEmail: ${recipientEmail}\nPassword: ${loginPassword}\n\nLogin Link: ${loginLink}\n\nPlease login and change your password after first login for security.`,
                            html: `
                                <h2>Welcome to Expo Event Management Platform</h2>
                                <p>Your organization <strong>${orgName}</strong> has been successfully created.</p>
                                <h3>Login Credentials:</h3>
                                <p><strong>Email:</strong> ${recipientEmail}</p>
                                <p><strong>Password:</strong> ${loginPassword}</p>
                                <p style="margin: 20px 0;">
                                    <a href="${loginLink}" style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                                        Login to Your Dashboard
                                    </a>
                                </p>
                                <p style="color: #64748b; font-size: 14px;">Or copy this link: <a href="${loginLink}">${loginLink}</a></p>
                                <p style="color: #d9534f;"><strong>Important:</strong> Please login and change your password after first login for security.</p>
                                <p>You can now access your dashboard and start managing your events.</p>
                            `
                        });

                        if (emailResult && emailResult.success) {
                            emailSent = true;
                            console.log('Organization welcome email sent to:', recipientEmail);
                        } else {
                            console.error('Failed to send welcome email:', emailResult ? emailResult.error : 'Unknown error');
                        }
                    } catch (emailErr) {
                        console.error('Failed to send welcome email:', emailErr.message);
                        // Don't crash - continue with the process
                    }
                }

                // Send welcome SMS with credentials
                if (mobile || contactPhone) {
                    try {
                        const recipientMobile = mobile || contactPhone;
                        const loginPassword = password || defaultPassword;
                        const loginEmail = email || contactEmail;

                        // Generate login link
                        const baseUrl = process.env.INVITE_LINK_BASE || 'http://localhost:5173';
                        const loginLink = `${baseUrl.replace('/invite', '')}?type=organization`;

                        const smsResult = await sendSMS({
                            to: recipientMobile,
                            body: `Welcome to Expo! Your organization "${orgName}" is created. Login: ${loginEmail} | Password: ${loginPassword}\nAccess: ${loginLink}\nChange password after first login.`
                        });

                        if (smsResult && smsResult.success) {
                            smsSent = true;
                            console.log('Organization welcome SMS sent to:', recipientMobile);
                        } else {
                            console.error('Failed to send welcome SMS:', smsResult ? smsResult.error : 'Unknown error');
                        }
                    } catch (smsErr) {
                        console.error('Failed to send welcome SMS:', smsErr.message);
                        // Don't crash - continue with the process
                    }
                }
            }

            // Return organization with generated password for first login
            const responseData = {
                success: true,
                organization: result.rows[0],
                emailSent,
                smsSent
            };

            // Include the default password in response (only shown once during creation)
            if (defaultPassword) {
                responseData.credentials = {
                    email: email || contactEmail,
                    password: defaultPassword,
                    note: 'Please save these credentials. Password can be changed after first login.'
                };
            }

            res.status(201).json(responseData);
        } catch (err) {
            await client.query('ROLLBACK');
            console.error('Error creating organization:', err);
            res.status(500).json({ error: 'Failed to create organization', details: err.message });
        } finally {
            client.release();
        }
    },

    // Organization login
    loginOrganization: async (req, res) => {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        const client = await pool.connect();
        try {
            const colRes = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name='organizations'");
            const cols = new Set(colRes.rows.map(r => r.column_name));

            const nameCol = cols.has('org_name') ? 'org_name' : (cols.has('name') ? 'name' : null);
            const primaryEmailCol = cols.has('primary_email') ? 'primary_email' : (cols.has('email') ? 'email' : null);
            const contactEmailCol = cols.has('contact_email') ? 'contact_email' : null;
            const pwCol = cols.has('password_hash') ? 'password_hash' : (cols.has('password') ? 'password' : null);
            const statusCol = cols.has('status') ? 'status' : null;

            // Only allow login with primary_email (organisation email) - not contact_email
            if (!primaryEmailCol) {
                return res.status(500).json({ error: 'Organizations table has no primary email column configured' });
            }
            if (!pwCol) {
                return res.status(500).json({ error: 'Organizations table has no password hash column configured' });
            }
            if (!nameCol) {
                return res.status(500).json({ error: 'Organizations table has no organization name column configured' });
            }

            // Only use primary_email for login authentication
            const statusFilter = statusCol ? ` AND ${statusCol} = 'Active'` : '';

            const sql = `
                SELECT
                    id,
                    ${nameCol} AS org_name,
                    ${primaryEmailCol} AS primary_email,
                    ${contactEmailCol ? `${contactEmailCol} AS contact_email,` : `NULL::text AS contact_email,`}
                    ${pwCol} AS password_hash,
                    ${statusCol ? `${statusCol} AS status` : `'Active'::text AS status`}
                FROM organizations
                WHERE ${primaryEmailCol} = $1${statusFilter}
            `;

            const result = await client.query(sql, [email]);

            if (result.rows.length === 0) {
                return res.status(401).json({ error: 'Invalid email or password' });
            }

            const org = result.rows[0];

            if (!org.password_hash) {
                return res.status(401).json({ error: 'No password set for this organization. Please contact administrator.' });
            }

            // Verify password
            const bcrypt = require('bcryptjs');
            const isValid = bcrypt.compareSync(password, org.password_hash);

            if (!isValid) {
                return res.status(401).json({ error: 'Invalid email or password' });
            }

            // Return organization data (without password_hash)
            res.json({
                success: true,
                organization: {
                    id: org.id,
                    orgName: org.org_name,
                    email: org.primary_email || org.contact_email,
                    type: 'organization'
                }
            });
        } catch (err) {
            console.error('Error during organization login:', err);
            res.status(500).json({ error: 'Failed to authenticate organization', details: err.message });
        } finally {
            client.release();
        }
    },

    // Create user (from admin UI)
    createUser: async (req, res) => {
        const data = req.body || {};
        const {
            role,
            firstName,
            lastName,
            email,
            mobile,
            organizationId,
            department,
            permissions,
            additionalPermissions,
            loginType,
            password,
            forceReset,
            security
        } = data;

        if (!email) return res.status(400).json({ error: 'Email is required' });

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // check duplicate email
            const dup = await client.query('SELECT id FROM users WHERE email = $1', [email]);
            if (dup.rows.length > 0) {
                await client.query('ROLLBACK');
                return res.status(409).json({ error: 'User with this email already exists' });
            }

            // hash password if provided
            let pwHash = null;
            if (password) {
                const bcrypt = require('bcryptjs');
                pwHash = bcrypt.hashSync(password, 10);
            }

            // ensure defaults for optional fields
            data.permissions = data.permissions ?? {};
            data.additionalPermissions = data.additionalPermissions ?? {};
            data.forceReset = data.forceReset ?? true;
            data.security = data.security ?? {};
            data.loginType = data.loginType ?? 'manual';

            // adapt to existing users columns
            const colRes = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name='users'");
            const cols = new Set(colRes.rows.map(r => r.column_name));

            const fieldMap = {
                organization_id: ['organizationId'],
                role: ['role'],
                first_name: ['firstName'],
                last_name: ['lastName'],
                email: ['email'],
                mobile: ['mobile'],
                department: ['department'],
                permissions: ['permissions'],
                additional_permissions: ['additionalPermissions'],
                login_type: ['loginType'],
                password_hash: ['pwHash'],
                force_reset: ['forceReset'],
                security: ['security']
            };

            const columns = [];
            const placeholders = [];
            const values = [];
            let idx = 1;

            for (const [col, keys] of Object.entries(fieldMap)) {
                if (!cols.has(col)) continue;
                // pick first available key value
                let val = null;
                for (const k of keys) {
                    if (k === 'pwHash') { val = pwHash; break; }
                    if (k === 'organizationId') { val = organizationId ?? null; break; }
                    val = data[k] !== undefined ? data[k] : null;
                    if (val !== null) break;
                }
                // apply sensible defaults for JSON/boolean fields
                if (col === 'permissions' && (val === null || val === undefined)) val = {};
                if (col === 'additional_permissions' && (val === null || val === undefined)) val = {};
                if (col === 'force_reset' && (val === null || val === undefined)) val = true;
                if (col === 'login_type' && (val === null || val === undefined)) val = 'manual';
                if (col === 'security' && (val === null || val === undefined)) val = {};

                columns.push(col);
                placeholders.push(`$${idx}`);
                values.push(val);
                idx++;
            }

            if (cols.has('status')) { columns.push('status'); placeholders.push(`$${idx}`); values.push('active'); idx++; }
            if (cols.has('created_at')) { columns.push('created_at'); placeholders.push('NOW()'); }
            if (cols.has('updated_at')) { columns.push('updated_at'); placeholders.push('NOW()'); }

            const colsSql = columns.join(', ');
            const paramSql = placeholders.join(', ');
            const sql = `INSERT INTO users (${colsSql}) VALUES (${paramSql}) RETURNING *`;

            const insert = await client.query(sql, values);
            await client.query('COMMIT');
            res.status(201).json({ success: true, user: insert.rows[0] });
        } catch (err) {
            await client.query('ROLLBACK');
            console.error('Error creating user:', err);
            res.status(500).json({ error: 'Failed to create user', details: err.message });
        } finally {
            client.release();
        }
    },

    // Create Plan
    createPlan: async (req, res) => {
        const { planName, planType, description, validity, status, limits, pricing } = req.body;

        if (!planName) {
            return res.status(400).json({ error: 'Plan name is required' });
        }

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Ensure plans table exists (and required columns exist)
            await client.query(`
                CREATE TABLE IF NOT EXISTS plans (
                    id BIGSERIAL PRIMARY KEY,
                    name TEXT NOT NULL
                )
            `);
            await client.query('ALTER TABLE plans ADD COLUMN IF NOT EXISTS type TEXT');
            await client.query('ALTER TABLE plans ADD COLUMN IF NOT EXISTS description TEXT');
            await client.query('ALTER TABLE plans ADD COLUMN IF NOT EXISTS validity_days INTEGER');
            await client.query('ALTER TABLE plans ADD COLUMN IF NOT EXISTS status TEXT');
            await client.query('ALTER TABLE plans ADD COLUMN IF NOT EXISTS limits JSONB');
            await client.query('ALTER TABLE plans ADD COLUMN IF NOT EXISTS pricing JSONB');
            await client.query('ALTER TABLE plans ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()');

            // Ensure coupons table exists (and required columns exist)
            await client.query(`
                CREATE TABLE IF NOT EXISTS coupons (
                    id BIGSERIAL PRIMARY KEY,
                    code TEXT UNIQUE NOT NULL
                )
            `);
            await client.query('ALTER TABLE coupons ADD COLUMN IF NOT EXISTS plan_id BIGINT');
            await client.query("ALTER TABLE coupons ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'ACTIVE'");
            await client.query('ALTER TABLE coupons ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()');
            await client.query('ALTER TABLE coupons ADD COLUMN IF NOT EXISTS used_count INTEGER NOT NULL DEFAULT 0');

            // Add FK if missing
            await client.query(`
                DO $$
                BEGIN
                  IF NOT EXISTS (
                    SELECT 1 FROM information_schema.table_constraints
                    WHERE constraint_name = 'coupons_plan_id_fkey'
                  ) THEN
                    ALTER TABLE coupons
                      ADD CONSTRAINT coupons_plan_id_fkey
                      FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE SET NULL;
                  END IF;
                END $$;
            `);

            // Convert validity to integer, default to 30 if not provided
            const validityDays = validity ? parseInt(validity, 10) : 30;
            const planStatus = status || 'Active';

            // Ensure limits and pricing are objects
            const limitsObj = limits && typeof limits === 'object' ? limits : {};
            const pricingObj = pricing && typeof pricing === 'object' ? pricing : {};

            const insertPlan = await client.query(
                `INSERT INTO plans (name, type, description, validity_days, status, limits, pricing) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
                [planName, planType || 'Custom', description || '', validityDays, planStatus, JSON.stringify(limitsObj), JSON.stringify(pricingObj)]
            );

            const plan = insertPlan.rows[0];
            let coupon = null;

            // Only generate a coupon for Custom plans
            if (planType === 'Custom') {
                const prefix = String(planType || 'CUSTOM').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8) || 'CUSTOM';
                for (let attempt = 0; attempt < 5; attempt++) {
                    const code = `${prefix}-` + Math.random().toString(36).substring(2, 8).toUpperCase();
                    try {
                        const insertCoupon = await client.query(
                            `INSERT INTO coupons (coupon_code, plan_id) VALUES ($1, $2) RETURNING *`,
                            [code, plan.id]
                        );
                        coupon = insertCoupon.rows[0];
                        break;
                    } catch (e) {
                        // Retry on unique constraint violations
                        if (e && String(e.code) === '23505') continue;
                        throw e;
                    }
                }
            }

            await client.query('COMMIT');
            res.status(201).json({ success: true, plan, coupon });

        } catch (err) {
            await client.query('ROLLBACK');
            console.error('Error creating plan:', err);
            res.status(500).json({ error: 'Failed to create plan', details: err.message });
        } finally {
            client.release();
        }
    },

    // Get all plans
    getPlans: async (req, res) => {
        try {
            const result = await pool.query('SELECT * FROM plans ORDER BY created_at DESC');
            res.json(result.rows);
        } catch (err) {
            console.error('Error fetching plans:', err);
            res.status(500).json({ error: 'Failed to fetch plans', details: err.message });
        }
    },

    // Verify Coupon
    verifyCoupon: async (req, res) => {
        const { code } = req.body;
        if (!code) return res.status(400).json({ error: 'Code is required' });

        try {
            // Ensure tables exist before querying (in case this is first call)
            const checkTables = await pool.query(`
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_name = 'coupons'
                );
             `);
            if (!checkTables.rows[0].exists) {
                return res.status(404).json({ error: 'Invalid coupon code' });
            }

            const result = await pool.query(
                `SELECT c.*, p.name as plan_name, p.limits, p.pricing, p.description 
                  FROM coupons c 
                  JOIN plans p ON c.plan_id = p.id 
                  WHERE c.coupon_code = $1 AND c.status = 'ACTIVE'`,
                [code]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Invalid or inactive coupon code' });
            }

            res.json({ success: true, coupon: result.rows[0] });
        } catch (err) {
            console.error('Error verifying coupon:', err);
            res.status(500).json({ error: 'Verification failed', details: err.message });
        }
    },

    // Get all coupons
    getCoupons: async (req, res) => {
        try {
            // Ensure coupons table exists before querying
            const checkTables = await pool.query(`
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_name = 'coupons'
                );
             `);
            if (!checkTables.rows[0].exists) {
                return res.json([]);
            }

            const result = await pool.query(`
                SELECT 
                    c.id,
                    c.coupon_code as code,
                    c.plan_id,
                    c.status,
                    c.used_count,
                    c.created_at,
                    p.name as plan_name,
                    p.type as plan_type,
                    p.pricing
                FROM coupons c
                LEFT JOIN plans p ON c.plan_id = p.id
                ORDER BY c.created_at DESC
            `);
            res.json(result.rows);
        } catch (err) {
            console.error('Error fetching coupons:', err);
            res.status(500).json({ error: 'Failed to fetch coupons', details: err.message });
        }
    }
};
