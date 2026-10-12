const express = require("express");
const pool = require("../config/db");
const { verifyToken, requireAdmin } = require("../middleware/auth");

const router = express.Router();

// Public: stops for one train
router.get("/train/:trainId", async (req, res) => {
  const [rows] = await pool.query(
    `SELECT tr.*, s.name AS station_name, s.code AS station_code
     FROM train_routes tr JOIN stations s ON s.id = tr.station_id
     WHERE tr.train_id = ? ORDER BY tr.stop_number`,
    [req.params.trainId]
  );
  res.json(rows);
});

// Admin: add a stop to a train's route
router.post("/", verifyToken, requireAdmin, async (req, res) => {
  const { train_id, station_id, stop_number, arrival_offset_min, departure_offset_min } = req.body;
  const [result] = await pool.query(
    "INSERT INTO train_routes (train_id, station_id, stop_number, arrival_offset_min, departure_offset_min) VALUES (?,?,?,?,?)",
    [train_id, station_id, stop_number, arrival_offset_min || 0, departure_offset_min || 0]
  );
  res.status(201).json({ id: result.insertId, message: "Stop added." });
});

// Admin: update a stop
router.put("/:id", verifyToken, requireAdmin, async (req, res) => {
  const { station_id, stop_number, arrival_offset_min, departure_offset_min } = req.body;
  await pool.query(
    "UPDATE train_routes SET station_id=?, stop_number=?, arrival_offset_min=?, departure_offset_min=? WHERE id=?",
    [station_id, stop_number, arrival_offset_min, departure_offset_min, req.params.id]
  );
  res.json({ message: "Stop updated." });
});

// Admin: remove a stop
router.delete("/:id", verifyToken, requireAdmin, async (req, res) => {
  await pool.query("DELETE FROM train_routes WHERE id = ?", [req.params.id]);
  res.json({ message: "Stop removed." });
});

module.exports = router;
