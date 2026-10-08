const pool = require("../config/db");

/**
 * Generates a unique 10-digit PNR, checking the bookings table
 * to guarantee no collision (extremely unlikely, but checked anyway).
 */
async function generatePNR() {
  for (let attempt = 0; attempt < 5; attempt++) {
    const pnr = String(Math.floor(1000000000 + Math.random() * 8999999999));
    const [rows] = await pool.query("SELECT id FROM bookings WHERE pnr = ?", [pnr]);
    if (rows.length === 0) return pnr;
  }
  throw new Error("Could not generate a unique PNR, please retry.");
}

module.exports = { generatePNR };
