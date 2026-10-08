const express = require("express");
const pool = require("../config/db");
const { verifyToken } = require("../middleware/auth");

const router = express.Router();

// List my saved passengers
router.get("/", verifyToken, async (req, res) => {
  const [rows] = await pool.query("SELECT * FROM passengers WHERE user_id = ? ORDER BY created_at DESC", [req.user.id]);
  res.json(rows);
});

// Add a passenger
router.post("/", verifyToken, async (req, res) => {
  const { name, age, gender } = req.body;
  if (!name || !age || !gender) return res.status(400).json({ error: "name, age and gender are required." });
  const [result] = await pool.query(
    "INSERT INTO passengers (user_id, name, age, gender) VALUES (?,?,?,?)",
    [req.user.id, name, age, gender]
  );
  res.status(201).json({ id: result.insertId, name, age, gender });
});

// Edit a passenger (must belong to me)
router.put("/:id", verifyToken, async (req, res) => {
  const { name, age, gender } = req.body;
  const [rows] = await pool.query("SELECT id FROM passengers WHERE id = ? AND user_id = ?", [req.params.id, req.user.id]);
  if (!rows.length) return res.status(404).json({ error: "Passenger not found." });
  await pool.query("UPDATE passengers SET name=?, age=?, gender=? WHERE id=?", [name, age, gender, req.params.id]);
  res.json({ message: "Passenger updated." });
});

// Delete a passenger
router.delete("/:id", verifyToken, async (req, res) => {
  const [rows] = await pool.query("SELECT id FROM passengers WHERE id = ? AND user_id = ?", [req.params.id, req.user.id]);
  if (!rows.length) return res.status(404).json({ error: "Passenger not found." });
  await pool.query("DELETE FROM passengers WHERE id = ?", [req.params.id]);
  res.json({ message: "Passenger removed." });
});

module.exports = router;
