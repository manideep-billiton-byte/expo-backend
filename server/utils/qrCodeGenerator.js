const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');

/**
 * Generate a high-contrast, print-ready QR code
 * @param {string} url - The URL to encode in the QR code
 * @param {string} outputPath - Path where to save the QR code PNG
 * @returns {Promise<string>} - Path to the generated QR code
 */
async function generateCleanQRCode(url, outputPath) {
    try {
        // QR Code options for high-contrast, print-ready output
        const options = {
            errorCorrectionLevel: 'H', // High error correction
            type: 'png',
            quality: 1, // Maximum quality
            margin: 2, // Small quiet zone (2 modules)
            width: 500, // 500x500 pixels for crisp output
            color: {
                dark: '#000000',  // Pure black modules
                light: '#FFFFFF'  // Pure white background
            },
            // Disable anti-aliasing for sharp edges
            rendererOpts: {
                quality: 1
            }
        };

        // Generate QR code and save to file
        await QRCode.toFile(outputPath, url, options);

        console.log(`✅ QR code generated successfully: ${outputPath}`);
        return outputPath;
    } catch (error) {
        console.error('❌ Error generating QR code:', error);
        throw error;
    }
}

/**
 * Generate QR code as base64 data URL (for embedding in HTML/emails)
 * Note: Some email clients block data URLs, use with caution
 * @param {string} url - The URL to encode
 * @returns {Promise<string>} - Base64 data URL
 */
async function generateQRCodeDataURL(url) {
    try {
        const options = {
            errorCorrectionLevel: 'H',
            type: 'image/png',
            quality: 1,
            margin: 2,
            width: 500,
            color: {
                dark: '#000000',
                light: '#FFFFFF'
            }
        };

        const dataUrl = await QRCode.toDataURL(url, options);
        return dataUrl;
    } catch (error) {
        console.error('❌ Error generating QR code data URL:', error);
        throw error;
    }
}

// Example usage
if (require.main === module) {
    const testUrl = 'https://d2ux36xl31uki3.cloudfront.net?action=register&token=example-token-123';
    const outputDir = path.join(__dirname, 'qr-codes');

    // Create output directory if it doesn't exist
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    const outputPath = path.join(outputDir, 'registration-qr-code.png');

    generateCleanQRCode(testUrl, outputPath)
        .then(() => {
            console.log('QR code generation complete!');
            console.log(`File saved to: ${outputPath}`);
        })
        .catch(err => {
            console.error('Failed to generate QR code:', err);
        });
}

module.exports = {
    generateCleanQRCode,
    generateQRCodeDataURL
};
