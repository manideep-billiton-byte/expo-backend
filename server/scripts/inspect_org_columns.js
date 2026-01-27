require('dotenv').config();
const pool = require('../db');
(async () => {
  try {
    const res = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name='organizations' ORDER BY ordinal_position");
    console.log('columns:', res.rows.map(r => r.column_name));
  } catch (err) {
    console.error('inspect error:', err.message || err);
  } finally {
    await pool.end();
  }
})();
