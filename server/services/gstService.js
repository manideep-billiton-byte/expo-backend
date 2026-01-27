const https = require('https');

// Dummy GST number for validation when API key is not available
const DUMMY_GST_NUMBER = '36AAACH7409R116';

// Mock data for the dummy GST number
const DUMMY_GST_DATA = {
    gstin: DUMMY_GST_NUMBER,
    legalName: 'Demo Company Pvt Ltd',
    tradeName: 'Demo Company',
    status: 'Active',
    state: 'Telangana',
    district: 'Hyderabad',
    registrationDate: '2020-01-01',
    panNumber: 'AAACH7409R',
    stateCode: '36',
    businessType: 'Private Limited Company',
    address: 'Demo Address, Hyderabad, Telangana - 500001'
};

// In-memory cache for GSTIN verification results
const gstCache = new Map();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

// Rate limiting tracker
const rateLimitTracker = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 10;

/**
 * Validate GSTIN format
 * @param {string} gstin - GSTIN to validate
 * @returns {boolean} - True if valid format
 */
function isValidGSTINFormat(gstin) {
    if (!gstin || typeof gstin !== 'string') {
        return false;
    }

    // GSTIN must be exactly 15 characters
    if (gstin.length !== 15) {
        return false;
    }

    // GSTIN format: 2 digits (state code) + 10 alphanumeric (PAN) + 1 alphabet (entity type) + 1 alphabet (default 'Z') + 1 checksum digit
    const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    return gstinRegex.test(gstin);
}

/**
 * Extract state code from GSTIN
 * @param {string} gstin - GSTIN
 * @returns {string} - State code (first 2 digits)
 */
function extractStateCode(gstin) {
    return gstin.substring(0, 2);
}

/**
 * Extract PAN from GSTIN
 * @param {string} gstin - GSTIN
 * @returns {string} - PAN number (characters 3-12)
 */
function extractPAN(gstin) {
    return gstin.substring(2, 12);
}

/**
 * Check rate limit for API calls
 * @param {string} identifier - Identifier for rate limiting (e.g., IP address or 'global')
 * @returns {boolean} - True if within rate limit
 */
function checkRateLimit(identifier = 'global') {
    const now = Date.now();
    const userRequests = rateLimitTracker.get(identifier) || [];

    // Remove requests outside the current window
    const recentRequests = userRequests.filter(timestamp => now - timestamp < RATE_LIMIT_WINDOW);

    if (recentRequests.length >= MAX_REQUESTS_PER_WINDOW) {
        return false;
    }

    // Add current request
    recentRequests.push(now);
    rateLimitTracker.set(identifier, recentRequests);

    return true;
}

/**
 * Get cached GSTIN data
 * @param {string} gstin - GSTIN
 * @returns {object|null} - Cached data or null
 */
function getCachedData(gstin) {
    const cached = gstCache.get(gstin);

    if (!cached) {
        return null;
    }

    // Check if cache has expired
    if (Date.now() - cached.timestamp > CACHE_TTL) {
        gstCache.delete(gstin);
        return null;
    }

    console.log(`Using cached GSTIN data for: ${gstin}`);
    return cached.data;
}

/**
 * Cache GSTIN data
 * @param {string} gstin - GSTIN
 * @param {object} data - Data to cache
 */
function setCachedData(gstin, data) {
    gstCache.set(gstin, {
        data,
        timestamp: Date.now()
    });
}

/**
 * Call GST API to verify GSTIN
 * @param {string} gstin - GSTIN to verify
 * @returns {Promise<object>} - API response data
 */
function callGSTAPI(gstin) {
    return new Promise((resolve, reject) => {
        const apiKey = process.env.GST_API_KEY;

        if (!apiKey) {
            return reject(new Error('GST_API_KEY not configured in environment variables'));
        }

        const url = `https://sheet.gstincheck.co.in/check/${apiKey}/${gstin}`;

        console.log(`Calling GST API for GSTIN: ${gstin}`);

        const request = https.get(url, { timeout: 10000 }, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                try {
                    const jsonData = JSON.parse(data);
                    resolve(jsonData);
                } catch (err) {
                    reject(new Error('Invalid JSON response from GST API'));
                }
            });
        });

        request.on('error', (err) => {
            reject(new Error(`GST API request failed: ${err.message}`));
        });

        request.on('timeout', () => {
            request.destroy();
            reject(new Error('GST API request timed out'));
        });
    });
}

/**
 * Map state code to state name
 * @param {string} stateCode - State code from GSTIN
 * @returns {object} - State and district information
 */
function getStateInfo(stateCode) {
    const stateMapping = {
        '01': { state: 'Jammu & Kashmir', district: 'Srinagar' },
        '02': { state: 'Himachal Pradesh', district: 'Shimla' },
        '03': { state: 'Punjab', district: 'Chandigarh' },
        '04': { state: 'Chandigarh', district: 'Chandigarh' },
        '05': { state: 'Uttarakhand', district: 'Dehradun' },
        '06': { state: 'Haryana', district: 'Gurugram' },
        '07': { state: 'Delhi', district: 'New Delhi' },
        '08': { state: 'Rajasthan', district: 'Jaipur' },
        '09': { state: 'Uttar Pradesh', district: 'Noida' },
        '10': { state: 'Bihar', district: 'Patna' },
        '11': { state: 'Sikkim', district: 'Gangtok' },
        '12': { state: 'Arunachal Pradesh', district: 'Itanagar' },
        '13': { state: 'Nagaland', district: 'Kohima' },
        '14': { state: 'Manipur', district: 'Imphal' },
        '15': { state: 'Mizoram', district: 'Aizawl' },
        '16': { state: 'Tripura', district: 'Agartala' },
        '17': { state: 'Meghalaya', district: 'Shillong' },
        '18': { state: 'Assam', district: 'Guwahati' },
        '19': { state: 'West Bengal', district: 'Kolkata' },
        '20': { state: 'Jharkhand', district: 'Ranchi' },
        '21': { state: 'Odisha', district: 'Bhubaneswar' },
        '22': { state: 'Chhattisgarh', district: 'Raipur' },
        '23': { state: 'Madhya Pradesh', district: 'Indore' },
        '24': { state: 'Gujarat', district: 'Ahmedabad' },
        '27': { state: 'Maharashtra', district: 'Mumbai' },
        '29': { state: 'Karnataka', district: 'Bengaluru Urban' },
        '30': { state: 'Goa', district: 'Panaji' },
        '32': { state: 'Kerala', district: 'Thiruvananthapuram' },
        '33': { state: 'Tamil Nadu', district: 'Chennai' },
        '34': { state: 'Puducherry', district: 'Puducherry' },
        '35': { state: 'Andaman and Nicobar Islands', district: 'Port Blair' },
        '36': { state: 'Telangana', district: 'Hyderabad' },
        '37': { state: 'Andhra Pradesh', district: 'Visakhapatnam' }
    };

    return stateMapping[stateCode] || { state: '', district: '' };
}

/**
 * Verify GSTIN and return company details
 * @param {string} gstin - GSTIN to verify
 * @param {string} identifier - Identifier for rate limiting (optional)
 * @returns {Promise<object>} - Verification result
 */
async function verifyGSTIN(gstin, identifier = 'global') {
    try {
        // Normalize GSTIN
        const normalizedGSTIN = gstin.toUpperCase().trim();

        // Check if this is the dummy GST number first (before format validation)
        // This allows the demo GST number to work even if it doesn't match standard format
        if (normalizedGSTIN === DUMMY_GST_NUMBER) {
            console.log(`Using dummy GST validation for: ${normalizedGSTIN}`);
            return {
                success: true,
                data: DUMMY_GST_DATA
            };
        }

        // Validate format
        if (!isValidGSTINFormat(normalizedGSTIN)) {
            return {
                success: false,
                error: 'Invalid GSTIN format. Please enter a valid 15-digit GSTIN.',
                errorCode: 'INVALID_FORMAT'
            };
        }

        // If no API key is configured, only accept the dummy GST number
        if (!process.env.GST_API_KEY) {
            console.log('GST_API_KEY not configured. Only dummy GST number is accepted.');
            return {
                success: false,
                error: `GST verification is currently in demo mode. Please use the demo GST number: ${DUMMY_GST_NUMBER}`,
                errorCode: 'DEMO_MODE'
            };
        }

        // Check rate limit
        if (!checkRateLimit(identifier)) {
            return {
                success: false,
                error: 'Too many requests. Please try again later.',
                errorCode: 'RATE_LIMIT_EXCEEDED'
            };
        }

        // Check cache
        const cachedData = getCachedData(normalizedGSTIN);
        if (cachedData) {
            return cachedData;
        }

        // Call API
        const apiResponse = await callGSTAPI(normalizedGSTIN);

        // Parse API response
        // Note: The actual response structure may vary based on the API
        // Adjust this based on the actual API response format
        let result;

        if (apiResponse.flag === false || apiResponse.error) {
            // GSTIN not found or API error
            result = {
                success: false,
                error: apiResponse.message || 'GSTIN not found or verification failed.',
                errorCode: 'GSTIN_NOT_FOUND'
            };
        } else if (apiResponse.data && apiResponse.data.sts === 'Inactive') {
            // GSTIN is inactive
            result = {
                success: false,
                error: 'This GSTIN is inactive or cancelled. Please verify your GSTIN.',
                errorCode: 'GSTIN_INACTIVE'
            };
        } else if (apiResponse.data) {
            // Successful verification
            const data = apiResponse.data;
            const stateCode = extractStateCode(normalizedGSTIN);
            const stateInfo = getStateInfo(stateCode);

            result = {
                success: true,
                data: {
                    gstin: normalizedGSTIN,
                    legalName: data.lgnm || data.tradeNam || '',
                    tradeName: data.tradeNam || data.lgnm || '',
                    status: data.sts || 'Active',
                    state: stateInfo.state || data.pradr?.addr?.stcd || '',
                    district: stateInfo.district || '',
                    registrationDate: data.rgdt || '',
                    panNumber: extractPAN(normalizedGSTIN),
                    stateCode: stateCode,
                    businessType: data.ctb || '',
                    address: data.pradr?.addr ?
                        `${data.pradr.addr.bno || ''} ${data.pradr.addr.bnm || ''} ${data.pradr.addr.st || ''} ${data.pradr.addr.loc || ''} ${data.pradr.addr.dst || ''} ${data.pradr.addr.pncd || ''}`.trim()
                        : ''
                }
            };
        } else {
            // Unexpected response format
            result = {
                success: false,
                error: 'Unable to verify GSTIN. Please try again later.',
                errorCode: 'API_ERROR'
            };
        }

        // Cache the result (both success and failure to prevent repeated API calls for invalid GSTINs)
        setCachedData(normalizedGSTIN, result);

        return result;

    } catch (error) {
        console.error('GSTIN verification error:', error);

        return {
            success: false,
            error: 'Unable to verify GSTIN. Please try again later.',
            errorCode: 'SYSTEM_ERROR',
            details: error.message
        };
    }
}

module.exports = {
    verifyGSTIN,
    isValidGSTINFormat,
    extractStateCode,
    extractPAN,
    DUMMY_GST_NUMBER
};
