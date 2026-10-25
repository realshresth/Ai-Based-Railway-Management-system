const express = require("express");
const pool = require("../config/db");
const { verifyToken, requireAdmin } = require("../middleware/auth");
const { generatePNR } = require("../utils/pnr");
const { fetchLivePnr } = require("../utils/indianRail");
const { CLASS_ORDER, berthOptions, freeSeats, allot, loadLayout } = require("../utils/berths");
const { sendBookingSms } = require("../utils/notify");
const { normalizePhone, maskPhone } = require("../utils/sms");

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

// ---------- Payment helpers ----------
const PAYMENT_STATUSES = ["Pending verification", "Verified", "Rejected", "Pay at counter", "Paid at counter"];
const TXN_RE = /^[A-Za-z0-9]{8,30}$/; // UPI reference / UTR numbers are 12 digits; other apps use alphanumeric IDs

// ---------- Is this transaction ID already used? (public; reveals nothing else) ----------
router.get("/payment/check/:txn", async (req, res) => {
  const txn = String(req.params.txn).trim();
  if (!TXN_RE.test(txn)) return res.json({ valid: false, used: false });
  const [rows] = await pool.query("SELECT payment_group FROM bookings WHERE transaction_id = ? LIMIT 1", [txn]);
  const group = String(req.query.group || "");
  const used = rows.length > 0 && !(group && rows[0].payment_group === group);
  res.json({ valid: true, used });
});

// ---------- Create a booking ----------
router.post("/", verifyToken, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { train_id, class_code, journey_date, passengers } = req.body;
    if (!train_id || !class_code || !journey_date || !Array.isArray(passengers) || !passengers.length) {
      return res.status(400).json({ error: "train_id, class_code, journey_date and at least one passenger are required." });
    }

    // Payment: "online" (UPI + transaction ID, verified by staff) or "offline" (pay at the counter)
    const pay = req.body.payment || {};
    if (pay.method !== "online") {
      return res.status(400).json({ error: "Pay online on UPI and enter the transaction ID to book." });
    }
    const paymentMethod = "online";
    let transactionId = null, paymentStatus = "Pending verification";
    const paymentGroup = pay.group ? String(pay.group).slice(0, 40) : null;
    {
      transactionId = String(pay.transaction_id || "").trim();
      if (!TXN_RE.test(transactionId)) {
        return res.status(400).json({ error: "Enter a valid transaction ID (8-30 letters or digits) for online payment." });
      }
      const [dupe] = await pool.query("SELECT payment_group FROM bookings WHERE transaction_id = ? LIMIT 1", [transactionId]);
      if (dupe.length && !(paymentGroup && dupe[0].payment_group === paymentGroup)) {
        return res.status(400).json({ error: "This transaction ID has already been used for another booking." });
      }
      paymentStatus = "Pending verification";
    }

    await conn.beginTransaction();

    const [classRows] = await conn.query(
      "SELECT * FROM train_classes WHERE train_id = ? AND class_code = ? FOR UPDATE",
      [train_id, class_code]
    );
    if (!classRows.length) throw new Error("Selected class is not available on this train.");
    const requested = classRows[0];
    const seatsNeeded = passengers.length;
    const autoUpgrade = req.body.auto_upgrade ? 1 : 0;

    // Seats still free in the class that was asked for
    let cls = requested;
    let free = await freeSeats(conn, train_id, requested);
    let upgradedFrom = null;

    // Auto-upgrade: if the chosen class can't seat everyone, try the next classes up on this train.
    // The passenger pays the fare of the class they chose.
    if (autoUpgrade && free.length < seatsNeeded) {
      for (const higher of CLASS_ORDER.slice(CLASS_ORDER.indexOf(class_code) + 1)) {
        const [hr] = await conn.query(
          "SELECT * FROM train_classes WHERE train_id = ? AND class_code = ? FOR UPDATE", [train_id, higher]
        );
        if (!hr.length) continue;
        const hFree = await freeSeats(conn, train_id, hr[0]);
        if (hFree.length >= seatsNeeded) { cls = hr[0]; free = hFree; upgradedFrom = class_code; break; }
      }
    }

    const status = free.length >= seatsNeeded ? "Confirmed" : "Waiting";
    const bookedClass = cls.class_code;
    const totalFare = Number(requested.fare) * seatsNeeded;
    const pnr = await generatePNR();

    const [bookingResult] = await conn.query(
      `INSERT INTO bookings (pnr, user_id, train_id, class_code, journey_date, total_fare, status,
                             payment_method, payment_status, transaction_id, payment_group, auto_upgrade, upgraded_from)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [pnr, req.user.id, train_id, bookedClass, journey_date, totalFare, status,
       paymentMethod, paymentStatus, transactionId, paymentGroup, autoUpgrade, upgradedFrom]
    );
    const bookingId = bookingResult.insertId;

    // Berth preferences (only accepted if valid for the class that is actually booked)
    const valid = berthOptions(bookedClass);
    const prefs = passengers.map((p) => (valid.includes(p.berth_pref) ? p.berth_pref : ""));
    const layout = await loadLayout(conn, train_id, cls);
    const seats = status === "Confirmed" ? allot(bookedClass, free, prefs, layout) : null;

    const allotted = [];
    for (let i = 0; i < passengers.length; i++) {
      const p = passengers[i];
      const seatNumber = seats ? `${bookedClass}-${seats[i].seat}` : null;
      const berth = seats ? seats[i].berth : null;
      await conn.query(
        "INSERT INTO booking_passengers (booking_id, name, age, gender, seat_number, berth_type, berth_pref, coach, coach_seat) VALUES (?,?,?,?,?,?,?,?,?)",
        [bookingId, p.name, p.age, p.gender, seatNumber, berth, prefs[i] || null, seats ? seats[i].coach : null, seats ? seats[i].coachSeat : null]
      );
      allotted.push({ name: p.name, age: p.age, gender: p.gender, seat_number: seatNumber, berth_type: berth,
                      coach: seats ? seats[i].coach : null, coach_seat: seats ? seats[i].coachSeat : null,
                      berth_pref: prefs[i] || null, preference_met: seats ? seats[i].preferenceMet : null });
    }

    if (status === "Confirmed") {
      await conn.query("UPDATE train_classes SET booked_seats = booked_seats + ? WHERE id = ?", [seatsNeeded, cls.id]);
    }

    await conn.commit();

    // SMS confirmation (does not block or fail the booking)
    const [urows] = await pool.query("SELECT phone FROM users WHERE id = ?", [req.user.id]);
    const smsPhone = normalizePhone(urows[0] && urows[0].phone);
    if (smsPhone) sendBookingSms(bookingId).catch((e) => console.error("Booking SMS failed:", e.message));

    res.status(201).json({ pnr, bookingId, status, totalFare, sms_to: maskPhone(smsPhone), class_code: bookedClass, requested_class: class_code,
      upgraded_from: upgradedFrom, auto_upgrade: autoUpgrade, passengers: allotted,
      payment_method: paymentMethod, payment_status: paymentStatus });
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
// 1) PNRs booked on this site are answered from our own database.
// 2) Any other 10-digit PNR is looked up live through IndianRailAPI.
router.get("/pnr/:pnr", async (req, res) => {
  const pnr = String(req.params.pnr).trim();
  if (!/^\d{10}$/.test(pnr)) return res.status(400).json({ error: "PNR must be a 10-digit number." });

  const [rows] = await pool.query(BOOKING_JOIN_SQL + " WHERE b.pnr = ?", [pnr]);
  if (rows.length) {
    const [withPax] = [await attachPassengers(rows)];
    const { transaction_id, payment_group, ...publicBooking } = withPax[0]; // keep payment details private
    return res.json({ ...publicBooking, source: "local" });
  }

  try {
    res.json(await fetchLivePnr(pnr));
  } catch (err) {
    res.status(err.status || 502).json({ error: err.message || "PNR lookup failed." });
  }
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

// ---------- Admin: verify / reject a payment ----------
router.put("/:id/payment", verifyToken, requireAdmin, async (req, res) => {
  const { status } = req.body;
  if (!PAYMENT_STATUSES.includes(status)) return res.status(400).json({ error: "Invalid payment status." });
  const [result] = await pool.query("UPDATE bookings SET payment_status = ? WHERE id = ?", [status, req.params.id]);
  if (!result.affectedRows) return res.status(404).json({ error: "Booking not found." });
  res.json({ message: "Payment status updated.", payment_status: status });
});

// ---------- Admin: all bookings ----------
router.get("/", verifyToken, requireAdmin, async (req, res) => {
  const [rows] = await pool.query(BOOKING_JOIN_SQL + " ORDER BY b.created_at DESC");
  res.json(await attachPassengers(rows));
});

module.exports = router;
