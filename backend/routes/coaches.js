const express = require("express");
const pool = require("../config/db");
const { verifyToken, requireAdmin } = require("../middleware/auth");
const { buildLayout, defaultCoaches, takenSeats, freeFromTaken } = require("../utils/berths");

const router = express.Router();
router.use(verifyToken, requireAdmin);

async function classView(conn, train, cls) {
  const [rows] = await conn.query("SELECT id, coach_number, seats FROM train_coaches WHERE train_id = ? AND class_code = ? ORDER BY id", [train, cls.class_code]);
  const layout = buildLayout(cls.class_code, cls.total_seats, rows);
  const free = new Set(freeFromTaken(cls, await takenSeats(conn, train, cls.class_code)));
  const idByNo = Object.fromEntries(rows.map((r) => [r.coach_number, r.id]));
  return {
    class_code: cls.class_code, class_name: cls.class_name, total_seats: cls.total_seats, booked_seats: cls.booked_seats,
    saved: layout.custom,                     // false = coaches are only the automatic default
    out_of_sync: rows.length > 0 && !layout.custom, // saved coaches don't add up to total seats (total was edited in Fares)
    coaches: layout.coaches.map((c) => {
      let vacant = 0; for (let n = c.from; n <= c.to; n++) if (free.has(n)) vacant++;
      return { id: idByNo[c.coach_number] || null, coach_number: c.coach_number, seats: c.seats, from: c.from, to: c.to, vacant };
    }),
  };
}

// GET /api/coaches?train_id=1
router.get("/", async (req, res) => {
  const train = Number(req.query.train_id);
  if (!train) return res.status(400).json({ error: "train_id is required." });
  const [classes] = await pool.query("SELECT * FROM train_classes WHERE train_id = ? ORDER BY fare", [train]);
  const out = [];
  for (const c of classes) out.push(await classView(pool, train, c));
  res.json(out);
});

// POST /api/coaches/generate {train_id, class_code}  -> save the default coach layout for the class
router.post("/generate", async (req, res) => {
  const { train_id, class_code } = req.body;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [cl] = await conn.query("SELECT * FROM train_classes WHERE train_id = ? AND class_code = ? FOR UPDATE", [train_id, class_code]);
    if (!cl.length) throw new Error("Class not found for this train.");
    const cls = cl[0];
    const [have] = await conn.query("SELECT 1 FROM train_coaches WHERE train_id = ? AND class_code = ? LIMIT 1", [train_id, class_code]);
    if (have.length) throw new Error("This class already has coaches saved.");
    for (const c of defaultCoaches(class_code, cls.total_seats)) {
      await conn.query("INSERT INTO train_coaches (train_id, class_code, coach_number, seats) VALUES (?,?,?,?)", [train_id, class_code, c.coach_number, c.seats]);
    }
    await conn.commit();
    res.status(201).json({ message: "Coaches created." });
  } catch (e) { await conn.rollback(); res.status(400).json({ error: e.message }); } finally { conn.release(); }
});

// POST /api/coaches {train_id, class_code, coach_number, seats} -> add a coach at the end; total seats grow by `seats`
router.post("/", async (req, res) => {
  const { train_id, class_code } = req.body;
  const coachNo = String(req.body.coach_number || "").trim().toUpperCase();
  const seats = Number(req.body.seats);
  if (!/^[A-Z0-9]{1,6}$/.test(coachNo)) return res.status(400).json({ error: "Coach number must be 1-6 letters/digits, e.g. S1 or B2." });
  if (!Number.isInteger(seats) || seats < 1 || seats > 120) return res.status(400).json({ error: "Seats must be a whole number from 1 to 120." });
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [cl] = await conn.query("SELECT * FROM train_classes WHERE train_id = ? AND class_code = ? FOR UPDATE", [train_id, class_code]);
    if (!cl.length) throw new Error("Class not found for this train.");
    const cls = cl[0];
    const [dupe] = await conn.query("SELECT 1 FROM train_coaches WHERE train_id = ? AND coach_number = ?", [train_id, coachNo]);
    if (dupe.length) throw new Error(`Coach ${coachNo} already exists on this train.`);
    const [have] = await conn.query("SELECT 1 FROM train_coaches WHERE train_id = ? AND class_code = ? LIMIT 1", [train_id, class_code]);
    const layoutNow = buildLayout(class_code, cls.total_seats, []);
    if (!have.length) { // first saved coach: keep the automatic ones so existing seat numbers don't move
      if (layoutNow.coaches.some((c) => c.coach_number === coachNo)) throw new Error(`Coach ${coachNo} is already in the automatic layout. Pick another number.`);
      for (const c of layoutNow.coaches) await conn.query("INSERT INTO train_coaches (train_id, class_code, coach_number, seats) VALUES (?,?,?,?)", [train_id, class_code, c.coach_number, c.seats]);
    }
    await conn.query("INSERT INTO train_coaches (train_id, class_code, coach_number, seats) VALUES (?,?,?,?)", [train_id, class_code, coachNo, seats]);
    await conn.query("UPDATE train_classes SET total_seats = total_seats + ? WHERE id = ?", [seats, cls.id]);
    await conn.commit();
    res.status(201).json({ message: `Coach ${coachNo} added with ${seats} seats.` });
  } catch (e) { await conn.rollback(); res.status(400).json({ error: e.message }); } finally { conn.release(); }
});

// DELETE /api/coaches/:id  -> only the LAST coach of a class, and only if none of its seats is booked
router.delete("/:id", async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [r] = await conn.query("SELECT * FROM train_coaches WHERE id = ?", [req.params.id]);
    if (!r.length) throw new Error("Coach not found.");
    const coach = r[0];
    const [cl] = await conn.query("SELECT * FROM train_classes WHERE train_id = ? AND class_code = ? FOR UPDATE", [coach.train_id, coach.class_code]);
    const view = await classView(conn, coach.train_id, cl[0]);
    const last = view.coaches[view.coaches.length - 1];
    if (!view.saved || last.id !== coach.id) throw new Error("Only the last coach of a class can be removed (so existing seat numbers don't change).");
    if (last.vacant !== last.seats) throw new Error(`Coach ${coach.coach_number} has booked seats and can't be removed.`);
    await conn.query("DELETE FROM train_coaches WHERE id = ?", [coach.id]);
    await conn.query("UPDATE train_classes SET total_seats = GREATEST(total_seats - ?, 0) WHERE id = ?", [coach.seats, cl[0].id]);
    await conn.commit();
    res.json({ message: `Coach ${coach.coach_number} removed.` });
  } catch (e) { await conn.rollback(); res.status(400).json({ error: e.message }); } finally { conn.release(); }
});

module.exports = router;
