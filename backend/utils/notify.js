/**
 * SMS notifications
 *  - booking confirmation (sent right after a booking is made)
 *  - journey-day train status (sent from ~6 AM IST on the journey date, and again when the delay
 *    changes by 15+ minutes or the train arrives). A background job checks every 30 minutes (live lookups are cached to save API quota).
 */
const pool = require("../config/db");
const { sendSms, normalizePhone } = require("./sms");
const { getTrainStatus, describe, istNow } = require("./liveTrain");

const fmtDate = (d) => {
  const dt = new Date(d); // MySQL DATE comes back as a JS date or "YYYY-MM-DD"
  return isNaN(dt) ? String(d).slice(0, 10) : dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};
const ymd = (d) => (d instanceof Date ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` : String(d).slice(0, 10));

async function log(bookingId, kind, phone, message, result, extra = {}) {
  await pool.query(
    "INSERT INTO sms_log (booking_id, kind, phone, message, provider_status, delay_min, train_state) VALUES (?,?,?,?,?,?,?)",
    [bookingId, kind, phone, message, result.status, extra.delay ?? null, extra.state ?? null]
  ).catch(() => {});
}

function bookingMessage(b) {
  const seats = (b.passengers || []).map((p) => (p.seat_number ? `${p.coach ? "Coach " + p.coach + " seat " + p.coach_seat : p.seat_number}${p.berth_type ? " " + p.berth_type : ""}` : "WL")).join(", ");
  return `RailReserve: PNR ${b.pnr} ${b.status}. Train ${b.train_number} ${b.train_name}, ${b.source_name} to ${b.destination_name}, ${fmtDate(b.journey_date)}, ${b.class_code}${b.upgraded_from ? " (upgraded from " + b.upgraded_from + ")" : ""}. Seats: ${seats}. Fare Rs.${b.total_fare}. Payment: ${b.payment_status}. Have a safe journey!`;
}

async function sendBookingSms(bookingId) {
  const [rows] = await pool.query(
    `SELECT b.*, t.train_number, t.name AS train_name, s1.name AS source_name, s2.name AS destination_name, u.phone
       FROM bookings b JOIN trains t ON t.id = b.train_id JOIN stations s1 ON s1.id = t.source_station_id
       JOIN stations s2 ON s2.id = t.destination_station_id JOIN users u ON u.id = b.user_id WHERE b.id = ?`, [bookingId]);
  if (!rows.length) return { ok: false, status: "not_found" };
  const [pax] = await pool.query("SELECT seat_number, berth_type, coach, coach_seat FROM booking_passengers WHERE booking_id = ?", [bookingId]);
  const b = { ...rows[0], passengers: pax };
  const text = bookingMessage(b);
  const result = await sendSms(b.phone, text);
  await log(bookingId, "booking", normalizePhone(b.phone) || String(b.phone || ""), text, result);
  return result;
}

async function runJourneyNotifier() {
  const now = istNow();
  if (now.minutes < 6 * 60) return; // not before 6 AM
  const [rows] = await pool.query(
    `SELECT b.id, b.pnr, b.class_code, t.train_number, t.name AS train_name, s1.name AS source_name, s2.name AS destination_name,
            t.departure_time, u.phone
       FROM bookings b JOIN trains t ON t.id = b.train_id JOIN stations s1 ON s1.id = t.source_station_id
       JOIN stations s2 ON s2.id = t.destination_station_id JOIN users u ON u.id = b.user_id
      WHERE b.journey_date = ? AND b.status IN ('Confirmed','Waiting') AND u.phone IS NOT NULL AND u.phone <> ''`, [now.date]);
  if (!rows.length) return;

  const cache = new Map();
  for (const b of rows) {
    if (!normalizePhone(b.phone)) continue;
    if (!cache.has(b.train_number)) cache.set(b.train_number, await getTrainStatus(b.train_number).catch(() => null));
    const st = cache.get(b.train_number);
    if (!st) continue;

    const [last] = await pool.query(
      "SELECT delay_min, train_state, created_at FROM sms_log WHERE booking_id = ? AND kind = 'journey' AND DATE(created_at) = CURDATE() ORDER BY id DESC LIMIT 1", [b.id]);
    const prev = last[0];
    const delay = st.delay_min || 0;
    const shouldSend = !prev
      || (st.state === "arrived" && prev.train_state !== "arrived")
      || (st.source === "live" && Math.abs(delay - (prev.delay_min || 0)) >= 15);
    if (!shouldSend) continue;

    const text = `RailReserve: Train ${b.train_number} ${b.train_name} (${b.source_name} to ${b.destination_name}, dep ${String(b.departure_time).slice(0, 5)}) ${describe(st)}. PNR ${b.pnr}.`;
    const result = await sendSms(b.phone, text);
    await log(b.id, "journey", normalizePhone(b.phone), text, result, { delay, state: st.state });
  }
}

function startNotifier() {
  const run = () => runJourneyNotifier().catch((e) => console.error("Journey SMS job failed:", e.message));
  setTimeout(run, 20000);
  setInterval(run, 30 * 60 * 1000); // every 30 min keeps within the free RailRadar quota
  console.log(`SMS notifications: provider = ${process.env.SMS_PROVIDER || "console (messages are only printed, not sent)"}`);
}

module.exports = { sendBookingSms, runJourneyNotifier, startNotifier };
