/**
 * QR Code Storage Service
 * Handles QR code generation and storage for events
 * - Local: Saves to /uploads/qrs/ directory
 * - Production: Uploads to S3 and serves via CloudFront
 */

const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

// S3 client for production uploads
let s3Client = null;

const getS3Client = () => {
    if (!s3Client && process.env.NODE_ENV === 'production') {
        const config = {
            region: process.env.AWS_REGION || 'ap-south-1'
        };

        if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
            config.credentials = {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
            };
        }

        s3Client = new S3Client(config);
    }
    return s3Client;
};

/**
 * Generate QR code buffer from a URL
 * @param {string} url - The URL to encode in the QR code
 * @returns {Promise<Buffer>} - PNG buffer of the QR code
 */
const generateQRBuffer = async (url) => {
    const qrBuffer = await QRCode.toBuffer(url, {
        type: 'png',
        width: 300,
        margin: 2,
        color: {
            dark: '#000000',
            light: '#FFFFFF'
        },
        errorCorrectionLevel: 'H' // High error correction for better scanning
    });
    return qrBuffer;
};

/**
 * Save QR code locally (for development)
 * @param {Buffer} qrBuffer - The QR code PNG buffer
 * @param {number} eventId - The event ID
 * @returns {string} - The relative path to the saved QR code
 */
const saveQRLocally = (qrBuffer, eventId) => {
    const uploadDir = path.join(process.cwd(), 'uploads', 'qrs');

    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
    }

    const fileName = `event-${eventId}.png`;
    const filePath = path.join(uploadDir, fileName);

    // Write the file
    fs.writeFileSync(filePath, qrBuffer);

    console.log(`QR code saved locally: ${filePath}`);

    // Return the relative path for database storage
    return `/uploads/qrs/${fileName}`;
};

/**
 * Upload QR code to S3 (for production)
 * @param {Buffer} qrBuffer - The QR code PNG buffer
 * @param {number} eventId - The event ID
 * @returns {Promise<string>} - The full CloudFront URL to the QR code
 */
const uploadQRToS3 = async (qrBuffer, eventId) => {
    const client = getS3Client();

    if (!client) {
        console.error('S3 client not available, falling back to local storage');
        return saveQRLocally(qrBuffer, eventId);
    }

    const bucketName = process.env.S3_QR_BUCKET || 'expo-project-prod-frontend';
    const fileName = `qrs/event-${eventId}.png`;

    const params = {
        Bucket: bucketName,
        Key: fileName,
        Body: qrBuffer,
        ContentType: 'image/png',
        CacheControl: 'max-age=31536000' // Cache for 1 year (QR codes don't change)
    };

    try {
        const command = new PutObjectCommand(params);
        await client.send(command);

        // Return CloudFront URL
        const cloudFrontDomain = process.env.CLOUDFRONT_DOMAIN || 'd36p7i1koir3da.cloudfront.net';
        const qrUrl = `https://${cloudFrontDomain}/${fileName}`;

        console.log(`QR code uploaded to S3: ${qrUrl}`);
        return qrUrl;
    } catch (error) {
        console.error('Error uploading QR to S3:', error.message);
        // Fall back to local storage
        return saveQRLocally(qrBuffer, eventId);
    }
};

/**
 * Generate and store QR code for an event
 * Automatically chooses local or S3 storage based on environment
 * @param {string} registrationUrl - The URL to encode in the QR code
 * @param {number} eventId - The event ID
 * @returns {Promise<{path: string, fullUrl: string}>} - The stored path and full URL
 */
const generateAndStoreQR = async (registrationUrl, eventId) => {
    try {
        // Generate QR code buffer
        const qrBuffer = await generateQRBuffer(registrationUrl);

        let qrPath;
        let fullUrl;

        if (process.env.NODE_ENV === 'production') {
            // Production: Upload to S3 and get CloudFront URL
            qrPath = await uploadQRToS3(qrBuffer, eventId);
            fullUrl = qrPath; // In production, the path IS the full URL
        } else {
            // Development: Save locally
            qrPath = saveQRLocally(qrBuffer, eventId);
            // Construct full URL for local development
            const baseUrl = process.env.API_BASE_URL || 'http://localhost:5000';
            fullUrl = `${baseUrl}${qrPath}`;
        }

        console.log(`QR code generated for event ${eventId}:`);
        console.log(`  Path: ${qrPath}`);
        console.log(`  Full URL: ${fullUrl}`);

        return { path: qrPath, fullUrl };
    } catch (error) {
        console.error('Error generating/storing QR code:', error);
        throw error;
    }
};

/**
 * Get the full URL for a stored QR code path
 * @param {string} qrPath - The stored QR path from database
 * @returns {string} - The full URL to access the QR code
 */
const getQRFullUrl = (qrPath) => {
    if (!qrPath) return null;

    // If the path is already a full URL (production), return as-is
    if (qrPath.startsWith('http://') || qrPath.startsWith('https://')) {
        return qrPath;
    }

    // Otherwise, construct the full URL (development)
    const baseUrl = process.env.API_BASE_URL || 'http://localhost:5000';
    return `${baseUrl}${qrPath}`;
};

/**
 * Delete a QR code (when event is deleted)
 * @param {string} qrPath - The stored QR path from database
 */
const deleteQR = async (qrPath) => {
    if (!qrPath) return;

    try {
        if (qrPath.startsWith('http')) {
            // Production: Delete from S3
            // TODO: Implement S3 delete if needed
            console.log('S3 delete not implemented, would delete:', qrPath);
        } else {
            // Local: Delete file
            const fullPath = path.join(process.cwd(), qrPath);
            if (fs.existsSync(fullPath)) {
                fs.unlinkSync(fullPath);
                console.log('Deleted local QR code:', fullPath);
            }
        }
    } catch (error) {
        console.error('Error deleting QR code:', error.message);
    }
};

module.exports = {
    generateQRBuffer,
    saveQRLocally,
    uploadQRToS3,
    generateAndStoreQR,
    getQRFullUrl,
    deleteQR
};
