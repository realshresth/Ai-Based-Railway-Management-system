/**
 * Berth layout + free-seat helpers.
 *
 * Seats are numbered 1..total_seats inside each class. The berth type of a seat
 * follows the real coach layout (a repeating "bay"):
 *   SL / 3A : Lower, Middle, Upper, Lower, Middle, Upper, Side Lower, Side Upper
 *   2A      : Lower, Upper, Lower, Upper, Side Lower, Side Upper
 *   1A      : Lower, Upper
 *
 * Existing databases only store a per-class counter (booked_seats), so seats that are
 * counted as booked but have no passenger row yet are treated as occupying the lowest
 * free seat numbers. That keeps "vacant = total - booked" exactly true.
 */
const BAYS = {
  SL: ["Lower", "Middle", "Upper", "Lower", "Middle", "Upper", "Side Lower", "Side Upper"],
  "3A": ["Lower", "Middle", "Upper", "Lower", "Middle", "Upper", "Side Lower", "Side Upper"],
  "2A": ["Lower", "Upper", "Lower", "Upper", "Side Lower", "Side Upper"],
  "1A": ["Lower", "Upper"],
};
const CLASS_ORDER = ["SL", "3A", "2A", "1A"]; // lowest -> highest (used for auto-upgrade)

const bayFor = (classCode) => BAYS[classCode] || ["Lower", "Upper"];
const berthOptions = (classCode) => [...new Set(bayFor(classCode))];
// ---- Coaches ----
// Seats are numbered 1..total across the whole class. Coaches (S1, S2, B1 ...) are consecutive blocks
// of those numbers, in the order the admin added them. The berth pattern restarts in every coach.
// If a class has no coaches yet (or they don't add up to total_seats) default coaches are used.
const COACH_DEFAULTS = { SL: { prefix: "S", size: 72 }, "3A": { prefix: "B", size: 64 }, "2A": { prefix: "A", size: 48 }, "1A": { prefix: "H", size: 24 } };

function defaultCoaches(classCode, total) {
  const d = COACH_DEFAULTS[classCode] || { prefix: "C", size: 48 };
  const out = [];
  for (let left = Number(total), i = 1; left > 0; i++) { const n = Math.min(d.size, left); out.push({ coach_number: `${d.prefix}${i}`, seats: n }); left -= n; }
  return out;
}

function buildLayout(classCode, total, rows) {
  const given = (rows || []).map((r) => ({ coach_number: r.coach_number, seats: Number(r.seats) }));
  const custom = given.length > 0 && given.reduce((a, r) => a + r.seats, 0) === Number(total);
  const coaches = custom ? given : defaultCoaches(classCode, total);
  const bay = bayFor(classCode);
  const info = [null];
  let from = 1;
  coaches.forEach((c) => {
    c.from = from; c.to = from + c.seats - 1;
    for (let pos = 1; pos <= c.seats; pos++) info.push({ coach: c.coach_number, pos, berth: bay[(pos - 1) % bay.length] });
    from += c.seats;
  });
  return { info, coaches, custom };
}

async function loadLayout(conn, trainId, cls) {
  const [rows] = await conn.query("SELECT coach_number, seats FROM train_coaches WHERE train_id = ? AND class_code = ? ORDER BY id", [trainId, cls.class_code]);
  return buildLayout(cls.class_code, cls.total_seats, rows);
}

const berthType = (classCode, seatNo, layout) => {
  if (layout && layout.info[seatNo]) return layout.info[seatNo].berth;
  const bay = bayFor(classCode);
  return bay[(seatNo - 1) % bay.length];
};

// Pure: free seat numbers for one class, given the seat numbers really held by active bookings
function freeFromTaken(cls, takenNumbers) {
  const occupied = new Set(takenNumbers);
  let phantom = Math.max(0, Number(cls.booked_seats) - occupied.size);
  const free = [];
  for (let n = 1; n <= Number(cls.total_seats); n++) {
    if (occupied.has(n)) continue;
    if (phantom > 0) { phantom--; continue; }
    free.push(n);
  }
  return free;
}

function parseSeat(seatNumber, classCode) {
  const m = new RegExp(`^${classCode}-(\\d+)$`).exec(String(seatNumber || ""));
  return m ? Number(m[1]) : null;
}

// Seat numbers held by active (non-cancelled) bookings for one train class
async function takenSeats(conn, trainId, classCode) {
  const [rows] = await conn.query(
    `SELECT bp.seat_number FROM booking_passengers bp
       JOIN bookings b ON b.id = bp.booking_id
      WHERE b.train_id = ? AND b.class_code = ? AND b.status <> 'Cancelled' AND bp.seat_number IS NOT NULL`,
    [trainId, classCode]
  );
  return rows.map((r) => parseSeat(r.seat_number, classCode)).filter((n) => n !== null);
}

async function freeSeats(conn, trainId, cls) {
  return freeFromTaken(cls, await takenSeats(conn, trainId, cls.class_code));
}

function countByBerth(classCode, free, layout) {
  const counts = {};
  berthOptions(classCode).forEach((b) => { counts[b] = 0; });
  free.forEach((n) => { counts[berthType(classCode, n, layout)] += 1; });
  return counts;
}

/**
 * Give each passenger a seat. prefs[i] is a berth type or "" (no preference).
 * If the preferred berth is gone the passenger still gets a seat (the next free one)
 * and preferenceMet is false.
 */
function allot(classCode, free, prefs, layout) {
  let pool = [...free];
  // keep the group together: put the seats of the first coach that can hold everyone at the front of the pool
  if (layout && prefs.length > 1) {
    const perCoach = {};
    pool.forEach((n) => { const c = layout.info[n]; if (c) perCoach[c.coach] = (perCoach[c.coach] || 0) + 1; });
    const best = Object.keys(perCoach).find((c) => perCoach[c] >= prefs.length);
    if (best) pool = [...pool.filter((n) => layout.info[n].coach === best), ...pool.filter((n) => layout.info[n].coach !== best)];
  }
  return prefs.map((pref) => {
    let idx = pref ? pool.findIndex((n) => berthType(classCode, n, layout) === pref) : 0;
    const met = !pref || idx !== -1;
    if (idx === -1) idx = 0;
    const [seat] = pool.splice(idx, 1);
    const at = layout && layout.info[seat];
    return { seat, berth: berthType(classCode, seat, layout), coach: at ? at.coach : null, coachSeat: at ? at.pos : null, preference: pref || null, preferenceMet: met };
  });
}

module.exports = { parseSeat, CLASS_ORDER, berthOptions, berthType, freeFromTaken, takenSeats, freeSeats, countByBerth, allot, COACH_DEFAULTS, defaultCoaches, buildLayout, loadLayout };
