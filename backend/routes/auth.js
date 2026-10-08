const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const pool = require("../config/db");
const { verifyToken } = require("../middleware/auth");

const router = express.Router();

function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );
}

function publicUser(user) {
  const { password_hash, reset_token, reset_token_expires, ...safe } = user;
  return safe;
}

// ---------- Register ----------
router.post("/register", async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: "Name, email and password are required." });
    }
    const [existing] = await pool.query("SELECT id FROM users WHERE email = ?", [email]);
    if (existing.length) return res.status(409).json({ error: "An account with this email already exists." });

    const hash = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      "INSERT INTO users (name, email, phone, password_hash, role) VALUES (?, ?, ?, ?, 'user')",
      [name, email, phone || null, hash]
    );
    const [rows] = await pool.query("SELECT * FROM users WHERE id = ?", [result.insertId]);
    const user = rows[0];
    res.status(201).json({ token: signToken(user), user: publicUser(user) });
  } catch (err) {
    res.status(500).json({ error: "Registration failed.", detail: err.message });
  }
});

// ---------- Login (user or admin, same endpoint) ----------
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const [rows] = await pool.query("SELECT * FROM users WHERE email = ?", [email]);
    if (!rows.length) return res.status(401).json({ error: "Invalid email or password." });

    const user = rows[0];
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: "Invalid email or password." });

    res.json({ token: signToken(user), user: publicUser(user) });
  } catch (err) {
    res.status(500).json({ error: "Login failed.", detail: err.message });
  }
});

// ---------- Admin login (rejects non-admin accounts) ----------
router.post("/admin/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const [rows] = await pool.query("SELECT * FROM users WHERE email = ? AND role = 'admin'", [email]);
    if (!rows.length) return res.status(401).json({ error: "Invalid admin credentials." });

    const user = rows[0];
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: "Invalid admin credentials." });

    res.json({ token: signToken(user), user: publicUser(user) });
  } catch (err) {
    res.status(500).json({ error: "Admin login failed.", detail: err.message });
  }
});

// ---------- Admin registration ----------
// Requires ADMIN_SIGNUP_CODE (set in .env) so random visitors can't self-promote
// to admin. Share that code only with people who should have staff access.
router.post("/admin/register", async (req, res) => {
  try {
    const { name, email, password, adminCode } = req.body;
    if (!name || !email || !password || !adminCode) {
      return res.status(400).json({ error: "Name, email, password and admin code are required." });
    }

    console.log("Signup code received:", adminCode);
    console.log("Expected signup code:", process.env.ADMIN_SIGNUP_CODE);
    
    if (adminCode !== process.env.ADMIN_SIGNUP_CODE) {
      return res.status(403).json({ error: "Invalid admin signup code." });
    }
    const [existing] = await pool.query("SELECT id FROM users WHERE email = ?", [email]);
    if (existing.length) return res.status(409).json({ error: "An account with this email already exists." });

    const hash = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      "INSERT INTO users (name, email, phone, password_hash, role) VALUES (?, ?, NULL, ?, 'admin')",
      [name, email, hash]
    );
    const [rows] = await pool.query("SELECT * FROM users WHERE id = ?", [result.insertId]);
    const user = rows[0];
    res.status(201).json({ token: signToken(user), user: publicUser(user) });
  } catch (err) {
    res.status(500).json({ error: "Admin registration failed.", detail: err.message });
  }
});

// ---------- Forgot password ----------
// No email service is wired up, so this returns the reset token directly in
// the response for demo purposes. In production you would email this link
// instead of returning the token to the client.
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    const [rows] = await pool.query("SELECT id FROM users WHERE email = ?", [email]);
    if (!rows.length) return res.status(404).json({ error: "No account with that email." });

    const token = crypto.randomBytes(24).toString("hex");
    const expires = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
    await pool.query("UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?", [
      token, expires, rows[0].id,
    ]);
    res.json({ message: "Reset token generated.", resetToken: token });
  } catch (err) {
    res.status(500).json({ error: "Could not start password reset.", detail: err.message });
  }
});

// ---------- Reset password ----------
router.post("/reset-password", async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    const [rows] = await pool.query(
      "SELECT id FROM users WHERE reset_token = ? AND reset_token_expires > NOW()",
      [token]
    );
    if (!rows.length) return res.status(400).json({ error: "Reset token is invalid or expired." });

    const hash = await bcrypt.hash(newPassword, 10);
    await pool.query(
      "UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?",
      [hash, rows[0].id]
    );
    res.json({ message: "Password updated. You can now log in." });
  } catch (err) {
    res.status(500).json({ error: "Could not reset password.", detail: err.message });
  }
});

// ---------- Current user ----------
router.get("/me", verifyToken, async (req, res) => {
  const [rows] = await pool.query("SELECT * FROM users WHERE id = ?", [req.user.id]);
  if (!rows.length) return res.status(404).json({ error: "User not found." });
  res.json(publicUser(rows[0]));
});

module.exports = router;
