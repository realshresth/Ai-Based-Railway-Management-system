const express = require("express");
const pool = require("../config/db");
const { verifyToken, requireAdmin } = require("../middleware/auth");
const { generatePNR } = require("../utils/pnr");

const router = express.Router();

const BOOKING_JOIN_SQL = `
  SELECT b.*, t.train_number, t.name AS train_name, t.departure_time, t.arrival_time,
         s1.name AS source_name, s2.name AS destination_name
  FROM bookings b
  JOIN trains t ON t.id = b.train_id
  JOIN stations s1 ON s1.id = t.source_station_id
  JOIN stations s2 ON s2.id = t.destination_station_id
`;

async function attachPassengers(bookings) {
  if (!bookings.length) return bookings;
  const ids = bookings.map((b) => b.id);
  const [pax] = await pool.query(
    `SELECT * FROM booking_passengers WHERE booking_id IN (${ids.map(() => "?").join(",")})`,
    ids
  );
  return bookings.map((b) => ({ ...b, passengers: pax.filter((p) => p.booking_id === b.id) }));
}

// ---------- Create a booking ----------
router.post("/", verifyToken, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { train_id, class_code, journey_date, passengers } = req.body;
    if (!train_id || !class_code || !journey_date || !Array.isArray(passengers) || !passengers.length) {
      return res.status(400).json({ error: "train_id, class_code, journey_date and at least one passenger are required." });
    }

    await conn.beginTransaction();

    const [classRows] = await conn.query(
      "SELECT * FROM train_classes WHERE train_id = ? AND class_code = ? FOR UPDATE",
      [train_id, class_code]
    );
    if (!classRows.length) throw new Error("Selected class is not available on this train.");
    const cls = classRows[0];

    const seatsNeeded = passengers.length;
    const seatsLeft = cls.total_seats - cls.booked_seats;
    const status = seatsLeft >= seatsNeeded ? "Confirmed" : "Waiting";

    const totalFare = Number(cls.fare) * seatsNeeded;
    const pnr = await generatePNR();

    const [bookingResult] = await conn.query(
      `INSERT INTO bookings (pnr, user_id, train_id, class_code, journey_date, total_fare, status)
       VALUES (?,?,?,?,?,?,?)`,
      [pnr, req.user.id, train_id, class_code, journey_date, totalFare, status]
    );
    const bookingId = bookingResult.insertId;

    let seatCounter = cls.booked_seats + 1;
    for (const p of passengers) {
      const seatNumber = status === "Confirmed" ? `${class_code}-${seatCounter++}` : null;
      await conn.query(
        "INSERT INTO booking_passengers (booking_id, name, age, gender, seat_number) VALUES (?,?,?,?,?)",
        [bookingId, p.name, p.age, p.gender, seatNumber]
      );
    }

    if (status === "Confirmed") {
      await conn.query("UPDATE train_classes SET booked_seats = booked_seats + ? WHERE id = ?", [
        seatsNeeded, cls.id,
      ]);
    }

    await conn.commit();
    res.status(201).json({ pnr, bookingId, status, totalFare });
  } catch (err) {
    await conn.rollback();
    res.status(400).json({ error: err.message || "Booking failed." });
  } finally {
    conn.release();
  }
});

// ---------- My bookings ----------
router.get("/my", verifyToken, async (req, res) => {
  const [rows] = await pool.query(BOOKING_JOIN_SQL + " WHERE b.user_id = ? ORDER BY b.created_at DESC", [req.user.id]);
  res.json(await attachPassengers(rows));
});

// ---------- PNR status (public — no login required, matches real IRCTC behaviour) ----------
router.get("/pnr/:pnr", async (req, res) => {
  const [rows] = await pool.query(BOOKING_JOIN_SQL + " WHERE b.pnr = ?", [req.params.pnr]);
  if (!rows.length) return res.status(404).json({ error: "No booking found for this PNR." });
  const [withPax] = [await attachPassengers(rows)];
  res.json(withPax[0]);
});

// ---------- Cancel a booking (owner or admin) ----------
router.put("/:id/cancel", verifyToken, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.query("SELECT * FROM bookings WHERE id = ?", [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: "Booking not found." });
    const booking = rows[0];

    if (req.user.role !== "admin" && booking.user_id !== req.user.id) {
      return res.status(403).json({ error: "You can only cancel your own bookings." });
    }
    if (booking.status === "Cancelled") {
      return res.status(400).json({ error: "Booking is already cancelled." });
    }

    await conn.beginTransaction();
    await conn.query("UPDATE bookings SET status = 'Cancelled' WHERE id = ?", [booking.id]);
    if (booking.status === "Confirmed") {
      const [pax] = await conn.query("SELECT COUNT(*) AS cnt FROM booking_passengers WHERE booking_id = ?", [booking.id]);
      await conn.query(
        "UPDATE train_classes SET booked_seats = GREATEST(booked_seats - ?, 0) WHERE train_id = ? AND class_code = ?",
        [pax[0].cnt, booking.train_id, booking.class_code]
      );
    }
    await conn.commit();
    res.json({ message: "Booking cancelled." });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: "Could not cancel booking.", detail: err.message });
  } finally {
    conn.release();
  }
});

// ---------- Admin: all bookings ----------
router.get("/", verifyToken, requireAdmin, async (req, res) => {
  const [rows] = await pool.query(BOOKING_JOIN_SQL + " ORDER BY b.created_at DESC");
  res.json(await attachPassengers(rows));
});

module.exports = router;
