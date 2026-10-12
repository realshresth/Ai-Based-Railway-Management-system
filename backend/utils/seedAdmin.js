// Run with: npm run seed:admin
// Creates (or updates) the admin account defined in .env using a proper bcrypt hash.
require("dotenv").config();
const bcrypt = require("bcryptjs");
const pool = require("../config/db");

async function run() {
  const email = process.env.ADMIN_EMAIL || "admin@railsarthi.in";
  const password = process.env.ADMIN_PASSWORD || "admin123";
  const name = process.env.ADMIN_NAME || "Admin";

  const hash = await bcrypt.hash(password, 10);
  const [existing] = await pool.query("SELECT id FROM users WHERE email = ?", [email]);

  if (existing.length) {
    await pool.query("UPDATE users SET password_hash = ?, role = 'admin' WHERE email = ?", [hash, email]);
    console.log(`Updated existing admin account: ${email}`);
  } else {
    await pool.query(
      "INSERT INTO users (name, email, phone, password_hash, role) VALUES (?, ?, ?, ?, 'admin')",
      [name, email, "9999999999", hash]
    );
    console.log(`Created admin account: ${email} / ${password}`);
  }
  process.exit(0);
}

run().catch((err) => {
  console.error("Failed to seed admin:", err);
  process.exit(1);
});
