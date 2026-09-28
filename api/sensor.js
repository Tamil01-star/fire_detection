const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

export default async function handler(req, res) {
  // Setup CORS to allow the GitHub Pages dashboard to fetch data
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // ==========================================
  // POST ROUTE: Receive data from ESP32
  // ==========================================
  if (req.method === 'POST') {
    const { flame, gas } = req.body;

    if (flame === undefined || gas === undefined) {
      return res.status(400).json({ error: 'Missing flame or gas value' });
    }

    try {
      // Create table if it doesn't exist
      await pool.query(`
        CREATE TABLE IF NOT EXISTS sensor_data (
          id SERIAL PRIMARY KEY,
          flame INT NOT NULL,
          gas INT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Insert the new data
      const result = await pool.query(
        'INSERT INTO sensor_data (flame, gas) VALUES ($1, $2) RETURNING *',
        [flame, gas]
      );
      return res.status(200).json({ success: true, data: result.rows[0] });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Database error' });
    }
  }

  // ==========================================
  // GET ROUTE: Send data to Dashboard
  // ==========================================
  if (req.method === 'GET') {
    try {
      // Get the latest reading for the dashboard
      const result = await pool.query(
        'SELECT * FROM sensor_data ORDER BY created_at DESC LIMIT 1'
      );
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'No data found' });
      }
      return res.status(200).json(result.rows[0]);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Database error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
