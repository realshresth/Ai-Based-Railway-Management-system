const express = require("express");
const pool = require("../config/db");
const { verifyToken, requireAdmin } = require("../middleware/auth");

const router = express.Router();

// Public: list all stations
router.get("/", async (req, res) => {
  const [rows] = await pool.query("SELECT * FROM stations ORDER BY name");
  res.json(rows);
});

// Public: single station
router.get("/:id", async (req, res) => {
  const [rows] = await pool.query("SELECT * FROM stations WHERE id = ?", [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: "Station not found." });
  res.json(rows[0]);
});

// Admin: create
router.post("/", verifyToken, requireAdmin, async (req, res) => {
  const { code, name, city, state } = req.body;
  if (!code || !name || !city) return res.status(400).json({ error: "code, name and city are required." });
  const [result] = await pool.query(
    "INSERT INTO stations (code, name, city, state) VALUES (?, ?, ?, ?)",
    [code.toUpperCase(), name, city, state || null]
  );
  res.status(201).json({ id: result.insertId, code, name, city, state });
});

// Admin: update
router.put("/:id", verifyToken, requireAdmin, async (req, res) => {
  const { code, name, city, state } = req.body;
  await pool.query("UPDATE stations SET code=?, name=?, city=?, state=? WHERE id=?", [
    code, name, city, state, req.params.id,
  ]);
  res.json({ message: "Station updated." });
});

// Admin: delete
router.delete("/:id", verifyToken, requireAdmin, async (req, res) => {
  await pool.query("DELETE FROM stations WHERE id = ?", [req.params.id]);
  res.json({ message: "Station deleted." });
});

module.exports = router;
