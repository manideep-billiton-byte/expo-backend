const { SESClient, SendEmailCommand, SendRawEmailCommand } = require('@aws-sdk/client-ses');
const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');
const fs = require('fs');
const path = require('path');

// Create AWS SES client lazily
// Uses default credential chain (IAM role on EC2/Elastic Beanstalk, or explicit credentials if provided)
let sesClient = null;

const getSESClient = () => {
    if (!sesClient) {
        // Check if we're in production or have AWS region configured
        const isProduction = process.env.NODE_ENV === 'production';
        const hasRegion = process.env.AWS_REGION;

        if (isProduction || hasRegion || process.env.AWS_ACCESS_KEY_ID) {
            const config = {
                region: process.env.AWS_REGION || 'ap-south-1'
            };

            // Only add explicit credentials if provided (otherwise use IAM role)
            if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
                config.credentials = {
                    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
                };
            }

            sesClient = new SESClient(config);
        }
    }
    return sesClient;
};

// Create AWS SNS client lazily
// Uses default credential chain (IAM role on EC2/Elastic Beanstalk, or explicit credentials if provided)
let snsClient = null;

const getSNSClient = () => {
    if (!snsClient) {
        // Check if we're in production or have AWS region configured
        const isProduction = process.env.NODE_ENV === 'production';
        const hasRegion = process.env.AWS_REGION;

        if (isProduction || hasRegion || process.env.AWS_ACCESS_KEY_ID) {
            const config = {
                region: process.env.AWS_REGION || 'ap-south-1'
            };

            // Only add explicit credentials if provided (otherwise use IAM role)
            if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
                config.credentials = {
                    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
                };
            }

            snsClient = new SNSClient(config);
        }
    }
    return snsClient;
};

// Send email using AWS SES
const sendEmail = async ({ to, subject, text, html }) => {
    const client = getSESClient();

    if (!client) {
        // Mock sending in development / when AWS not configured
        console.log('Mock sending email to:', to);
        console.log('Subject:', subject);
        console.log('Text:', text);
        if (html) console.log('HTML content available');
        return { success: true, message: 'Email would be sent in production (AWS SES not configured)' };
    }

    try {
        const fromEmail = process.env.SES_FROM_EMAIL || 'no-reply@example.com';

        const params = {
            Source: fromEmail,
            Destination: {
                ToAddresses: [to]
            },
            Message: {
                Subject: {
                    Data: subject,
                    Charset: 'UTF-8'
                },
                Body: {}
            }
        };

        // Add text body if provided
        if (text) {
            params.Message.Body.Text = {
                Data: text,
                Charset: 'UTF-8'
            };
        }

        // Add HTML body if provided
        if (html) {
            params.Message.Body.Html = {
                Data: html,
                Charset: 'UTF-8'
            };
        }

        const command = new SendEmailCommand(params);
        const response = await client.send(command);

        console.log('Email sent via AWS SES:', response.MessageId);
        return { success: true, messageId: response.MessageId };
    } catch (error) {
        console.error('Error sending email via AWS SES:', error.message);
        // Return error instead of throwing - prevents server crash
        return { success: false, error: error.message };
    }
};

// Send SMS using AWS SNS
const sendSMS = async ({ to, body }) => {
    const client = getSNSClient();

    if (!client) {
        // Mock sending in development / when AWS not configured
        console.log('Mock sending SMS to:', to);
        console.log('Message:', body);
        return { success: true, message: 'SMS would be sent in production (AWS SNS not configured)' };
    }

    try {
        // Format phone number for SNS (must include country code with +)
        let phoneNumber = to;
        if (!phoneNumber.startsWith('+')) {
            // Assume India (+91) if no country code provided
            phoneNumber = '+91' + phoneNumber.replace(/^0+/, '');
        }

        const params = {
            Message: body,
            PhoneNumber: phoneNumber,
            MessageAttributes: {
                'AWS.SNS.SMS.SenderID': {
                    DataType: 'String',
                    StringValue: process.env.SNS_SENDER_ID || 'EXPO'
                },
                'AWS.SNS.SMS.SMSType': {
                    DataType: 'String',
                    StringValue: 'Transactional'
                }
            }
        };

        const command = new PublishCommand(params);
        const response = await client.send(command);

        console.log('SMS sent via AWS SNS:', response.MessageId);
        return { success: true, messageId: response.MessageId };
    } catch (error) {
        console.error('Error sending SMS via AWS SNS:', error.message);
        // Return error instead of throwing - prevents server crash
        return { success: false, error: error.message };
    }
};

// Send email with attachments using AWS SES (raw email with MIME)
const sendEmailWithAttachments = async ({ to, subject, text, html, attachments = [] }) => {
    const client = getSESClient();

    if (!client) {
        // Mock sending in development
        console.log('Mock sending email with attachments to:', to);
        console.log('Subject:', subject);
        console.log('Attachments:', attachments.length);
        return { success: true, message: 'Email would be sent in production (AWS SES not configured)' };
    }

    try {
        const fromEmail = process.env.SES_FROM_EMAIL || 'no-reply@example.com';

        // Create MIME email with attachments
        const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        let rawEmail = [
            `From: ${fromEmail}`,
            `To: ${to}`,
            `Subject: ${subject}`,
            `MIME-Version: 1.0`,
            `Content-Type: multipart/mixed; boundary="${boundary}"`,
            ``,
            `--${boundary}`,
            `Content-Type: multipart/alternative; boundary="${boundary}_alt"`,
            ``,
            `--${boundary}_alt`,
            `Content-Type: text/plain; charset=UTF-8`,
            `Content-Transfer-Encoding: 7bit`,
            ``,
            text || 'Please view this email in HTML format.',
            ``,
            `--${boundary}_alt`,
            `Content-Type: text/html; charset=UTF-8`,
            `Content-Transfer-Encoding: 7bit`,
            ``,
            html || '',
            ``,
            `--${boundary}_alt--`
        ].join('\r\n');

        // Add attachments
        for (const attachment of attachments) {
            const fileContent = fs.readFileSync(attachment.path);
            const base64Content = fileContent.toString('base64');
            const filename = attachment.filename || path.basename(attachment.path);

            rawEmail += [
                ``,
                `--${boundary}`,
                `Content-Type: image/png; name="${filename}"`,
                `Content-Description: ${filename}`,
                `Content-Disposition: attachment; filename="${filename}"`,
                `Content-Transfer-Encoding: base64`,
                ``,
                base64Content,
                ``
            ].join('\r\n');
        }

        // Close boundary
        rawEmail += `--${boundary}--`;

        const params = {
            RawMessage: {
                Data: Buffer.from(rawEmail)
            }
        };

        const command = new SendRawEmailCommand(params);
        const response = await client.send(command);

        console.log('Email with attachments sent via AWS SES:', response.MessageId);
        return { success: true, messageId: response.MessageId };
    } catch (error) {
        console.error('Error sending email with attachments via AWS SES:', error.message);

        // Detect common SES errors and provide helpful messages
        let errorMessage = error.message;
        if (error.message.includes('not verified') || error.message.includes('Email address is not verified')) {
            errorMessage = `Email address ${to} is not verified. AWS SES is in sandbox mode and can only send to verified emails. Verified emails: deepak@btsind.com, projects@btsind.com, info@btsind.com, manideep.a@btsind.com, sharath.k@btsind.com`;
            console.error('⚠️  SES SANDBOX MODE: Recipient email not verified:', to);
        }

        return { success: false, error: errorMessage };
    }
};

module.exports = {
    sendEmail,
    sendSMS,
    sendEmailWithAttachments
};
