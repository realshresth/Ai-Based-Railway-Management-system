// Runs on every server start. Makes the project work with zero manual DB setup:
//  1. creates the database if it doesn't exist
//  2. creates tables + sample trains/stations the first time (when `stations` is empty)
//  3. adds newer profile columns to an existing `users` table
//  4. creates a default admin if no admin exists yet
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");

const DB_NAME = process.env.DB_NAME || "railway_reservation";

async function ensureColumn(conn, table, column, ddl) {
  const [rows] = await conn.query(
    "SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?",
    [DB_NAME, table, column]
  );
  if (!rows.length) await conn.query(`ALTER TABLE \`${table}\` ADD COLUMN ${ddl}`);
}

async function initDb() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    multipleStatements: true,
  });

  try {
    await conn.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\``);
    await conn.query(`USE \`${DB_NAME}\``);

    const [tables] = await conn.query(
      "SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'stations'",
      [DB_NAME]
    );
    if (!tables.length) {
      console.log("First run: creating tables and sample data...");
      const sql = fs.readFileSync(path.join(__dirname, "../../database/schema.sql"), "utf8");
      await conn.query(sql);
    }

    // Repair an older/partial users table so login never crashes on a missing column
    await ensureColumn(conn, "users", "password_hash", "password_hash VARCHAR(255) NOT NULL DEFAULT ''");
    await ensureColumn(conn, "users", "role", "role ENUM('user','admin') DEFAULT 'user'");
    await ensureColumn(conn, "users", "reset_token", "reset_token VARCHAR(255) DEFAULT NULL");
    await ensureColumn(conn, "users", "reset_token_expires", "reset_token_expires DATETIME DEFAULT NULL");
    await ensureColumn(conn, "users", "gender", "gender ENUM('M','F','O') DEFAULT NULL");
    await ensureColumn(conn, "users", "dob", "dob DATE DEFAULT NULL");
    await ensureColumn(conn, "users", "address", "address VARCHAR(255) DEFAULT NULL");

    // Payment columns (older databases get them added automatically)
    await ensureColumn(conn, "bookings", "payment_method", "payment_method VARCHAR(10) NOT NULL DEFAULT 'offline'");
    await ensureColumn(conn, "bookings", "payment_status", "payment_status VARCHAR(30) NOT NULL DEFAULT 'Pay at counter'");
    await ensureColumn(conn, "bookings", "transaction_id", "transaction_id VARCHAR(40) DEFAULT NULL");
    await ensureColumn(conn, "bookings", "payment_group", "payment_group VARCHAR(40) DEFAULT NULL");
    // Auto-upgrade + berth columns
    await ensureColumn(conn, "bookings", "auto_upgrade", "auto_upgrade TINYINT(1) NOT NULL DEFAULT 0");
    await ensureColumn(conn, "bookings", "upgraded_from", "upgraded_from VARCHAR(5) DEFAULT NULL");
    await ensureColumn(conn, "booking_passengers", "berth_type", "berth_type VARCHAR(20) DEFAULT NULL");
    await conn.query(`CREATE TABLE IF NOT EXISTS sms_log (
      id INT AUTO_INCREMENT PRIMARY KEY, booking_id INT NOT NULL, kind VARCHAR(20) NOT NULL, phone VARCHAR(20),
      message TEXT, provider_status VARCHAR(30), delay_min INT DEFAULT NULL, train_state VARCHAR(20) DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, INDEX (booking_id, kind))`);
    await conn.query(`CREATE TABLE IF NOT EXISTS train_coaches (
      id INT AUTO_INCREMENT PRIMARY KEY, train_id INT NOT NULL, class_code VARCHAR(5) NOT NULL,
      coach_number VARCHAR(8) NOT NULL, seats INT NOT NULL,
      UNIQUE KEY uq_train_coach (train_id, coach_number),
      FOREIGN KEY (train_id) REFERENCES trains(id) ON DELETE CASCADE)`);
    await ensureColumn(conn, "booking_passengers", "coach", "coach VARCHAR(8) DEFAULT NULL");
    await ensureColumn(conn, "booking_passengers", "coach_seat", "coach_seat INT DEFAULT NULL");
    await ensureColumn(conn, "booking_passengers", "berth_pref", "berth_pref VARCHAR(20) DEFAULT NULL");

    try {
      const n = await require("./seedExtra").seedExtraTrains(conn);
      if (n) console.log(`Added ${n} sample trains around Gorakhpur, Lucknow and Varanasi.`);
    } catch (e) { console.warn("Could not add the extra sample trains:", e.message); }

    // An admin with a missing/empty password hash can never log in - fix it from .env
    const adminEmail = process.env.ADMIN_EMAIL || "admin@railsarthi.in";
    const [broken] = await conn.query(
      "SELECT id FROM users WHERE role = 'admin' AND (password_hash IS NULL OR password_hash = '')"
    );
    for (const b of broken) {
      await conn.query("UPDATE users SET password_hash = ? WHERE id = ?", [
        await bcrypt.hash(process.env.ADMIN_PASSWORD || "admin123", 10), b.id,
      ]);
    }

    const [admins] = await conn.query("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
    if (!admins.length) {
      const email = process.env.ADMIN_EMAIL || "admin@railsarthi.in";
      const password = process.env.ADMIN_PASSWORD || "admin123";
      const hash = await bcrypt.hash(password, 10);
      const [existing] = await conn.query("SELECT id FROM users WHERE email = ?", [email]);
      if (existing.length) {
        await conn.query("UPDATE users SET password_hash = ?, role = 'admin' WHERE id = ?", [hash, existing[0].id]);
      } else {
        await conn.query(
          "INSERT INTO users (name, email, phone, password_hash, role) VALUES (?, ?, '9999999999', ?, 'admin')",
          [process.env.ADMIN_NAME || "Rail Sarthi Admin", email, hash]
        );
      }
      console.log(`Default admin ready -> ${email} / ${password}`);
    }
  } finally {
    await conn.end();
  }
}

module.exports = initDb;
