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

    await ensureColumn(conn, "users", "gender", "gender ENUM('M','F','O') DEFAULT NULL");
    await ensureColumn(conn, "users", "dob", "dob DATE DEFAULT NULL");
    await ensureColumn(conn, "users", "address", "address VARCHAR(255) DEFAULT NULL");

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
