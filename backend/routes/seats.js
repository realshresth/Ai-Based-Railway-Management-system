const express = require("express");
const pool = require("../config/db");
const { freeFromTaken, countByBerth, parseSeat, berthType, buildLayout } = require("../utils/berths");

const router = express.Router();

// Public: vacant seats per train and class, with a berth-type breakdown.
//   GET /api/seats/vacant               -> every train
//   GET /api/seats/vacant?train_id=3    -> one train
router.get("/vacant", async (req, res) => {
  const trainId = req.query.train_id ? Number(req.query.train_id) : null;

  const [trains] = await pool.query(
    `SELECT t.id, t.train_number, t.name, t.departure_time, t.arrival_time, t.duration,
            s1.name AS source_name, s1.code AS source_code, s2.name AS destination_name, s2.code AS destination_code
       FROM trains t
       JOIN stations s1 ON s1.id = t.source_station_id
       JOIN stations s2 ON s2.id = t.destination_station_id
      ${trainId ? "WHERE t.id = ?" : ""} ORDER BY t.departure_time`,
    trainId ? [trainId] : []
  );
  if (!trains.length) return res.json([]);

  const [classes] = await pool.query(
    `SELECT * FROM train_classes ${trainId ? "WHERE train_id = ?" : ""} ORDER BY train_id, fare`,
    trainId ? [trainId] : []
  );
  const [seatRows] = await pool.query(
    `SELECT b.train_id, b.class_code, bp.seat_number
       FROM booking_passengers bp JOIN bookings b ON b.id = bp.booking_id
      WHERE b.status <> 'Cancelled' AND bp.seat_number IS NOT NULL ${trainId ? "AND b.train_id = ?" : ""}`,
    trainId ? [trainId] : []
  );
  const taken = {};
  seatRows.forEach((r) => {
    const n = parseSeat(r.seat_number, r.class_code);
    if (n !== null) (taken[`${r.train_id}:${r.class_code}`] ||= []).push(n);
  });

  const [coachRows] = await pool.query(
    `SELECT train_id, class_code, coach_number, seats FROM train_coaches ${trainId ? "WHERE train_id = ?" : ""} ORDER BY id`, trainId ? [trainId] : []);
  const layoutFor = (c) => buildLayout(c.class_code, c.total_seats, coachRows.filter((r) => r.train_id === c.train_id && r.class_code === c.class_code));

  res.json(trains.map((t) => ({
    ...t,
    classes: classes.filter((c) => c.train_id === t.id).map((c) => {
      const layout = layoutFor(c);
      const free = freeFromTaken(c, taken[`${t.id}:${c.class_code}`] || []);
      return {
        class_code: c.class_code, class_name: c.class_name, fare: Number(c.fare),
        total: c.total_seats, booked: c.booked_seats, vacant: free.length,
        berths: countByBerth(c.class_code, free, layout), coach_count: layout.coaches.length,
      };
    }),
  })));
});

// Public: seat-by-seat map for one train.
//   GET /api/seats/map?train_id=3
// For every seat: number, berth type, free/booked, and - for booked seats - where that
// passenger boards and gets off plus the journey date. Passenger names are NOT exposed.
router.get("/map", async (req, res) => {
  const trainId = Number(req.query.train_id);
  if (!trainId) return res.status(400).json({ error: "train_id is required." });

  const [trains] = await pool.query(
    `SELECT t.id, t.train_number, t.name, t.departure_time, t.arrival_time, t.duration,
            s1.name AS source_name, s2.name AS destination_name
       FROM trains t JOIN stations s1 ON s1.id = t.source_station_id JOIN stations s2 ON s2.id = t.destination_station_id
      WHERE t.id = ?`, [trainId]);
  if (!trains.length) return res.status(404).json({ error: "Train not found." });
  const train = trains[0];

  const [stops] = await pool.query(
    `SELECT tr.stop_number, s.name AS station_name, s.code AS station_code
       FROM train_routes tr JOIN stations s ON s.id = tr.station_id WHERE tr.train_id = ? ORDER BY tr.stop_number`, [trainId]);
  const [classes] = await pool.query("SELECT * FROM train_classes WHERE train_id = ? ORDER BY fare", [trainId]);
  const [coachRows] = await pool.query("SELECT class_code, coach_number, seats FROM train_coaches WHERE train_id = ? ORDER BY id", [trainId]);
  const [rows] = await pool.query(
    `SELECT b.class_code, b.journey_date, b.status, bp.seat_number, bp.gender
       FROM booking_passengers bp JOIN bookings b ON b.id = bp.booking_id
      WHERE b.train_id = ? AND b.status <> 'Cancelled' AND bp.seat_number IS NOT NULL`, [trainId]);

  const held = {}; // class -> seatNo -> info
  rows.forEach((r) => {
    const n = parseSeat(r.seat_number, r.class_code);
    if (n === null) return;
    (held[r.class_code] ||= {})[n] = {
      boards_at: train.source_name, gets_off_at: train.destination_name,
      journey_date: r.journey_date, gender: r.gender,
    };
  });

  res.json({
    train, stops,
    classes: classes.map((c) => {
      const mine = held[c.class_code] || {};
      const free = new Set(freeFromTaken(c, Object.keys(mine).map(Number)));
      const layout = buildLayout(c.class_code, c.total_seats, coachRows.filter((r) => r.class_code === c.class_code));
      const seats = [];
      for (let n = 1; n <= Number(c.total_seats); n++) {
        const at = layout.info[n];
        const base = { no: n, label: `${c.class_code}-${n}`, berth: berthType(c.class_code, n, layout), coach: at.coach, pos: at.pos };
        if (free.has(n)) seats.push({ ...base, status: "free" });
        else if (mine[n]) seats.push({ ...base, status: "booked", ...mine[n] });
        else seats.push({ ...base, status: "booked", boards_at: train.source_name, gets_off_at: train.destination_name, journey_date: null });
      }
      const coaches = layout.coaches.map((k) => ({ coach_number: k.coach_number, seats: k.seats, vacant: seats.filter((x) => x.coach === k.coach_number && x.status === "free").length }));
      return { class_code: c.class_code, class_name: c.class_name, fare: Number(c.fare), total: c.total_seats, vacant: free.size, coaches, seats };
    }),
  });
});

module.exports = router;
