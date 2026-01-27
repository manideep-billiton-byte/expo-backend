/**
 * Upload Controller
 * 
 * Handles file uploads for ground layout and other assets
 */

const path = require('path');
const fs = require('fs');

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

/**
 * Upload ground layout image
 * POST /api/upload/ground-layout
 */
const uploadGroundLayout = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        // File is saved by multer middleware
        const fileUrl = `/uploads/${req.file.filename}`;

        console.log('Ground layout uploaded:', req.file.filename);

        return res.json({
            success: true,
            filename: req.file.filename,
            originalName: req.file.originalname,
            url: fileUrl,
            size: req.file.size
        });

    } catch (error) {
        console.error('Upload error:', error);
        return res.status(500).json({
            error: 'Failed to upload file',
            details: error.message
        });
    }
};

module.exports = {
    uploadGroundLayout
};
