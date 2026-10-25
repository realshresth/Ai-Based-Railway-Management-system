const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const pool = require("../config/db");
const { verifyToken } = require("../middleware/auth");

const router = express.Router();

function signToken(user) {
  // No expiresIn: tokens never expire. The only config needed is JWT_SECRET in .env.
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name, role: user.role },
    process.env.JWT_SECRET
  );
}

function publicUser(user) {
  const { password_hash, reset_token, reset_token_expires, ...safe } = user;
  return safe;
}

// Turn a crash into a clear message (shown on the login page) and log the real error.
function fail(res, label, err) {
  console.error(`[${label}]`, err);
  let detail = err.message;
  if (err.code === "ECONNREFUSED") detail = "Cannot connect to MySQL - is MySQL running? (check DB_HOST/DB_PORT in backend/.env)";
  else if (err.code === "ER_ACCESS_DENIED_ERROR") detail = "MySQL rejected the login - DB_USER/DB_PASSWORD in backend/.env is wrong";
  else if (err.code === "ER_BAD_DB_ERROR") detail = "Database not found - restart the backend so it can create it";
  else if (err.code === "ER_NO_SUCH_TABLE" || err.code === "ER_BAD_FIELD_ERROR") detail = "Database tables are out of date - restart the backend (it repairs them on start). " + err.message;
  return res.status(500).json({ error: `${label}.`, detail });
}

// bcrypt.compare throws if the stored hash is missing; treat that as "wrong password".
const passwordMatches = async (plain, hash) => (typeof hash === "string" && hash ? bcrypt.compare(plain, hash) : false);

const clean = (v) => (typeof v === "string" ? v.trim() : v);
const { normalizePhone } = require("../utils/sms");
const cleanEmail = (v) => (typeof v === "string" ? v.trim().toLowerCase() : v);

// ---------- Register ----------
router.post("/register", async (req, res) => {
  try {
    const name = clean(req.body.name), email = cleanEmail(req.body.email);
    const phone = clean(req.body.phone), password = req.body.password;
    if (!name || !email || !password) {
      return res.status(400).json({ error: "Name, email and password are required." });
    }
    const mobile = normalizePhone(phone);
    if (!mobile) return res.status(400).json({ error: "Enter a valid 10-digit mobile number - booking and train-status SMS are sent to it." });
    const [existing] = await pool.query("SELECT id FROM users WHERE email = ?", [email]);
    if (existing.length) return res.status(409).json({ error: "An account with this email already exists." });

    const hash = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      "INSERT INTO users (name, email, phone, password_hash, role) VALUES (?, ?, ?, ?, 'user')",
      [name, email, mobile, hash]
    );
    const [rows] = await pool.query("SELECT * FROM users WHERE id = ?", [result.insertId]);
    const user = rows[0];
    res.status(201).json({ token: signToken(user), user: publicUser(user) });
  } catch (err) {
    fail(res, "Registration failed", err);
  }
});

// ---------- Login (user or admin, same endpoint) ----------
router.post("/login", async (req, res) => {
  try {
    const email = cleanEmail(req.body.email), password = req.body.password;
    if (!email || !password) return res.status(400).json({ error: "Email and password are required." });
    const [rows] = await pool.query("SELECT * FROM users WHERE email = ?", [email]);
    if (!rows.length) return res.status(401).json({ error: "Invalid email or password." });

    const user = rows[0];
    const ok = await passwordMatches(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: "Invalid email or password." });

    res.json({ token: signToken(user), user: publicUser(user) });
  } catch (err) {
    fail(res, "Login failed", err);
  }
});

// ---------- Admin login (rejects non-admin accounts) ----------
router.post("/admin/login", async (req, res) => {
  try {
    const email = cleanEmail(req.body.email), password = req.body.password;
    if (!email || !password) return res.status(400).json({ error: "Email and password are required." });
    const [rows] = await pool.query("SELECT * FROM users WHERE email = ? AND role = 'admin'", [email]);
    if (!rows.length) return res.status(401).json({ error: "Invalid admin credentials (or this account is not an admin)." });

    const user = rows[0];
    const ok = await passwordMatches(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: "Invalid admin credentials." });

    res.json({ token: signToken(user), user: publicUser(user) });
  } catch (err) {
    fail(res, "Admin login failed", err);
  }
});

// ---------- Admin registration ----------
// Requires ADMIN_SIGNUP_CODE (set in .env) so random visitors can't self-promote
// to admin. Share that code only with people who should have staff access.
router.post("/admin/register", async (req, res) => {
  try {
    const name = clean(req.body.name), email = cleanEmail(req.body.email);
    const password = req.body.password, adminCode = clean(req.body.adminCode);
    if (!name || !email || !password || !adminCode) {
      return res.status(400).json({ error: "Name, email, password and admin code are required." });
    }
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
    fail(res, "Admin registration failed", err);
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

// ---------- Update my profile (client or admin) ----------
router.put("/profile", verifyToken, async (req, res) => {
  const name = clean(req.body.name);
  const phone = clean(req.body.phone) || null;
  const gender = ["M", "F", "O"].includes(req.body.gender) ? req.body.gender : null;
  const dob = req.body.dob || null;
  const address = clean(req.body.address) || null;
  if (!name) return res.status(400).json({ error: "Name is required." });
  const mobile = phone ? normalizePhone(phone) : null;
  if (phone && !mobile) return res.status(400).json({ error: "Enter a valid 10-digit mobile number." });

  await pool.query("UPDATE users SET name=?, phone=?, gender=?, dob=?, address=? WHERE id=?", [
    name, mobile, gender, dob, address, req.user.id,
  ]);
  const [rows] = await pool.query("SELECT * FROM users WHERE id = ?", [req.user.id]);
  res.json({ token: signToken(rows[0]), user: publicUser(rows[0]) });
});

// ---------- Change my password ----------
router.put("/change-password", verifyToken, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: "Enter your current password and a new one (min 6 characters)." });
  }
  const [rows] = await pool.query("SELECT * FROM users WHERE id = ?", [req.user.id]);
  if (!rows.length) return res.status(404).json({ error: "User not found." });
  if (!(await bcrypt.compare(currentPassword, rows[0].password_hash))) {
    return res.status(400).json({ error: "Current password is incorrect." });
  }
  await pool.query("UPDATE users SET password_hash = ? WHERE id = ?", [await bcrypt.hash(newPassword, 10), req.user.id]);
  res.json({ message: "Password changed." });
});

module.exports = router;
