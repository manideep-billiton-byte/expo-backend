const { Pool } = require('pg');

/*
 * ============================================================================
 * DATABASE CONFIGURATION
 * ============================================================================
 * 
 * Choose ONE of the following configurations by uncommenting it.
 * Make sure to comment out the other configuration.
 * 
 * OPTION 1: LOCAL - For local development with local PostgreSQL
 * OPTION 2: SERVER - For production/server with AWS RDS PostgreSQL
 * 
 * ============================================================================
 */

// ============================================================================
// OPTION 1: LOCAL DATABASE (Comment this section when deploying to server)
// ============================================================================
// const dbConfig = {
//     host: 'localhost',
//     port: 5432,
//     user: 'postgres',
//     password: 'password@123',  // <-- Change this to your local PostgreSQL password
//     database: 'event_platform',
//     ssl: false
// };
// console.log('DB: Connected to LOCAL database');

// ============================================================================
// OPTION 2: SERVER DATABASE - AWS RDS (Uncomment this for production)
// ============================================================================
const dbConfig = {
    connectionString: 'postgresql://postgres:EventPass123!@expo-project-prod-db.cvmk8awyksm7.ap-south-1.rds.amazonaws.com:5432/expo_db',
    ssl: { rejectUnauthorized: false }
};
console.log('DB: Connected to SERVER (AWS RDS) database');

const pool = new Pool(dbConfig);

module.exports = pool;

