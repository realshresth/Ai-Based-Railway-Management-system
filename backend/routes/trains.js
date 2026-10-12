const express = require("express");
const pool = require("../config/db");
const { verifyToken, requireAdmin } = require("../middleware/auth");

const router = express.Router();

const TRAIN_LIST_SQL = `
  SELECT t.*, s1.name AS source_name, s1.code AS source_code,
         s2.name AS destination_name, s2.code AS destination_code
  FROM trains t
  JOIN stations s1 ON s1.id = t.source_station_id
  JOIN stations s2 ON s2.id = t.destination_station_id
`;

async function attachClasses(trains) {
  if (!trains.length) return trains;
  const ids = trains.map((t) => t.id);
  const [classes] = await pool.query(
    `SELECT * FROM train_classes WHERE train_id IN (${ids.map(() => "?").join(",")})`,
    ids
  );
  return trains.map((t) => ({
    ...t,
    classes: classes.filter((c) => c.train_id === t.id),
  }));
}

// Public: search trains by from/to (station codes or ids) — falls back to full list
router.get("/", async (req, res) => {
  const { from, to } = req.query;
  let sql = TRAIN_LIST_SQL;
  const params = [];
  if (from && to) {
    sql += " WHERE (s1.code = ? OR s1.name = ?) AND (s2.code = ? OR s2.name = ?)";
    params.push(from, from, to, to);
  }
  sql += " ORDER BY t.departure_time";
  const [trains] = await pool.query(sql, params);
  res.json(await attachClasses(trains));
});

// Public: single train with route stops + classes
router.get("/:id", async (req, res) => {
  const [trains] = await pool.query(TRAIN_LIST_SQL + " WHERE t.id = ?", [req.params.id]);
  if (!trains.length) return res.status(404).json({ error: "Train not found." });

  const [stops] = await pool.query(
    `SELECT tr.*, s.name AS station_name, s.code AS station_code
     FROM train_routes tr JOIN stations s ON s.id = tr.station_id
     WHERE tr.train_id = ? ORDER BY tr.stop_number`,
    [req.params.id]
  );
  const [withClasses] = [await attachClasses(trains)];
  res.json({ ...withClasses[0], stops });
});

// Admin: create a train (+ default classes)
router.post("/", verifyToken, requireAdmin, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const {
      train_number, name, source_station_id, destination_station_id,
      departure_time, arrival_time, duration, days_of_operation, baseFare, totalSeats,
    } = req.body;

    await conn.beginTransaction();
    const [result] = await conn.query(
      `INSERT INTO trains (train_number, name, source_station_id, destination_station_id, departure_time, arrival_time, duration, days_of_operation)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [train_number, name, source_station_id, destination_station_id, departure_time, arrival_time, duration, days_of_operation || "Daily"]
    );
    const trainId = result.insertId;

    const fare = Number(baseFare) || 500;
    const seats = Number(totalSeats) || 400;
    const classDefs = [
      ["SL", "Sleeper", Math.round(fare * 1.0), Math.round(seats * 0.55)],
      ["3A", "AC 3-Tier", Math.round(fare * 2.5), Math.round(seats * 0.25)],
      ["2A", "AC 2-Tier", Math.round(fare * 3.7), Math.round(seats * 0.14)],
      ["1A", "AC First", Math.round(fare * 6.3), Math.round(seats * 0.06)],
    ];
    for (const [code, cname, f, tot] of classDefs) {
      await conn.query(
        "INSERT INTO train_classes (train_id, class_code, class_name, fare, total_seats, booked_seats) VALUES (?,?,?,?,?,0)",
        [trainId, code, cname, f, tot]
      );
    }
    await conn.commit();
    res.status(201).json({ id: trainId, message: "Train created." });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: "Could not create train.", detail: err.message });
  } finally {
    conn.release();
  }
});

// Admin: update train core details
router.put("/:id", verifyToken, requireAdmin, async (req, res) => {
  const {
    train_number, name, source_station_id, destination_station_id,
    departure_time, arrival_time, duration, days_of_operation,
  } = req.body;
  await pool.query(
    `UPDATE trains SET train_number=?, name=?, source_station_id=?, destination_station_id=?,
     departure_time=?, arrival_time=?, duration=?, days_of_operation=? WHERE id=?`,
    [train_number, name, source_station_id, destination_station_id, departure_time, arrival_time, duration, days_of_operation, req.params.id]
  );
  res.json({ message: "Train updated." });
});

// Admin: delete train
router.delete("/:id", verifyToken, requireAdmin, async (req, res) => {
  await pool.query("DELETE FROM trains WHERE id = ?", [req.params.id]);
  res.json({ message: "Train deleted." });
});

// Admin: update a fare/class row (used by Manage Fares)
router.put("/:id/classes/:classId", verifyToken, requireAdmin, async (req, res) => {
  const { fare, total_seats } = req.body;
  await pool.query("UPDATE train_classes SET fare=?, total_seats=? WHERE id=? AND train_id=?", [
    fare, total_seats, req.params.classId, req.params.id,
  ]);
  res.json({ message: "Fare updated." });
});

module.exports = router;
