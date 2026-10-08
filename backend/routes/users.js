const express = require("express");
const pool = require("../config/db");
const { verifyToken, requireAdmin } = require("../middleware/auth");

const router = express.Router();

// Admin: list all users
router.get("/", verifyToken, requireAdmin, async (req, res) => {
  const [rows] = await pool.query("SELECT id, name, email, phone, role, created_at FROM users ORDER BY created_at DESC");
  res.json(rows);
});

// Admin: delete a user
router.delete("/:id", verifyToken, requireAdmin, async (req, res) => {
  if (Number(req.params.id) === req.user.id) {
    return res.status(400).json({ error: "You can't delete your own admin account." });
  }
  await pool.query("DELETE FROM users WHERE id = ?", [req.params.id]);
  res.json({ message: "User deleted." });
});

// Admin: promote/demote a user's role
router.put("/:id/role", verifyToken, requireAdmin, async (req, res) => {
  const { role } = req.body;
  if (!["user", "admin"].includes(role)) return res.status(400).json({ error: "role must be 'user' or 'admin'." });
  await pool.query("UPDATE users SET role = ? WHERE id = ?", [role, req.params.id]);
  res.json({ message: "Role updated." });
});

// Admin: dashboard overview stats
router.get("/stats/overview", verifyToken, requireAdmin, async (req, res) => {
  const [[trains]] = await pool.query("SELECT COUNT(*) AS count FROM trains");
  const [[stations]] = await pool.query("SELECT COUNT(*) AS count FROM stations");
  const [[bookings]] = await pool.query("SELECT COUNT(*) AS count FROM bookings WHERE status != 'Cancelled'");
  const [[passengers]] = await pool.query("SELECT COUNT(*) AS count FROM users WHERE role = 'user'");
  const [[revenue]] = await pool.query("SELECT COALESCE(SUM(total_fare),0) AS total FROM bookings WHERE status != 'Cancelled'");
  const [[occupancy]] = await pool.query(
    "SELECT COALESCE(SUM(booked_seats),0) AS booked, COALESCE(SUM(total_seats),0) AS total FROM train_classes"
  );

  res.json({
    totalTrains: trains.count,
    totalStations: stations.count,
    totalBookings: bookings.count,
    totalPassengers: passengers.count,
    revenue: Number(revenue.total),
    occupancyPercent: occupancy.total ? Math.round((occupancy.booked / occupancy.total) * 100) : 0,
  });
});

module.exports = router;
