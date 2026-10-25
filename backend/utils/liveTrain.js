/**
 * "Where is my train" - live running status.
 *  1. If RAPIDAPI_KEY is set, ask the provider (default path /api/v1/liveTrainStatus on irctc1).
 *  2. If that is not configured / fails, estimate the position from this site's own timetable
 *     (clearly labelled source: "timetable" - it cannot know about delays).
 */
const pool = require("../config/db");

const pick = (o, ...keys) => { for (const k of keys) if (o && o[k] !== undefined && o[k] !== null && o[k] !== "") return o[k]; return undefined; };

// "Now" in India, regardless of server timezone
function istNow() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date()).reduce((a, p) => ({ ...a, [p.type]: p.value }), {});
  return { date: `${parts.year}-${parts.month}-${parts.day}`, minutes: Number(parts.hour) * 60 + Number(parts.minute) };
}

const hhmm = (mins) => { const m = ((mins % 1440) + 1440) % 1440; return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`; };

// ---------------- RailRadar (https://railradar.in/docs/live-train-status) ----------------
// Free plan = 100 requests / month, so every answer is cached (RAILRADAR_CACHE_MIN, default 10 min).
const cache = new Map();
const CACHE_MS = (Number(process.env.RAILRADAR_CACHE_MIN) || 10) * 60000;
const hm = (iso) => (iso ? String(iso).slice(11, 16) : "");

async function fromRailRadar(trainNo) {
  const key = process.env.RAILRADAR_API_KEY;
  if (!key) return { error: "not_configured" };
  const hit = cache.get(trainNo);
  if (hit && Date.now() - hit.t < (hit.value.error ? 2 * 60000 : CACHE_MS)) return hit.value;

  const done = (value) => { cache.set(trainNo, { t: Date.now(), value }); return value; };
  try {
    const base = process.env.RAILRADAR_BASE || "https://api.railradar.in";
    const res = await fetch(`${base}/v1/trains/${encodeURIComponent(trainNo)}/live`, {
      headers: { Authorization: `Bearer ${key}`, "X-API-Key": key }, signal: AbortSignal.timeout(15000),
    });
    if (res.status === 401 || res.status === 403) return done({ error: "bad_key" });
    if (res.status === 429) return done({ error: "quota" });
    if (res.status === 404) return done({ error: "not_found" });
    const body = await res.json().catch(() => null);
    const d = body && body.data;
    if (!res.ok || !d) return done({ error: "unavailable" });

    const route = Array.isArray(d.route) ? d.route : [];
    const nameOf = (code) => (route.find((r) => r.stationCode === code) || {}).stationName || code;
    let nextMarked = false;
    const stops = route.filter((r) => r.isHalt !== false).map((r) => {
      let status = r.status === "departed" ? "passed" : r.status === "arrived" ? "current" : "upcoming";
      if (status === "upcoming" && !nextMarked) { status = "next"; nextMarked = true; }
      return {
        name: r.stationName, code: r.stationCode,
        scheduled_arr: hm(r.scheduledArrival), scheduled_dep: hm(r.scheduledDeparture),
        expected_arr: hm(r.actualArrival), delay_min: Number(r.delayArrival) || 0, platform: r.platform || null, status,
      };
    });
    const raw = String(d.status || "").toLowerCase();
    const state = /not.?start|yet|scheduled|upcoming/.test(raw) ? "not_started" : /complete|terminat|reached|arrived|ended/.test(raw) ? "arrived" : "running";
    const loc = d.currentLocation || {};
    const delay = Number(d.delayMinutes) || 0;
    return done({
      source: "live", provider: "RailRadar", train_name: d.trainName || (d.train && d.train.name),
      origin: d.train && d.train.source && d.train.source.name, destination: d.train && d.train.destination && d.train.destination.name,
      state, delay_min: delay,
      current_station: loc.stationCode ? nameOf(loc.stationCode) : (d.previousHalt && d.previousHalt.stationName) || null,
      current_status: loc.status || null, speed_kmh: loc.speedKmh ?? null,
      next_station: (d.nextHalt && d.nextHalt.stationName) || null,
      headline: state === "not_started" ? "Not started yet" : state === "arrived" ? "Journey completed" : delay > 0 ? `Running ${delay} min late` : "Running on time",
      alerts: (Array.isArray(d.exceptions) ? d.exceptions : []).map((e) => e.message || e.type).filter(Boolean),
      last_updated: d.lastUpdatedAt || null, stops,
    });
  } catch { return done({ error: "unavailable" }); }
}

const RR_NOTES = {
  not_configured: "Live tracking is not configured (add RAILRADAR_API_KEY to backend/.env), so this is estimated from the timetable and cannot show delays.",
  bad_key: "RailRadar rejected the API key (check RAILRADAR_API_KEY), so this is estimated from the timetable.",
  quota: "The RailRadar request limit for this plan is used up, so this is estimated from the timetable and cannot show delays.",
  not_found: "RailRadar has no live data for this train, so this is estimated from the timetable.",
  unavailable: "Live tracking is unavailable right now, so this is estimated from the timetable and cannot show delays.",
};

async function fromProvider(trainNo) {
  if (!process.env.RAPIDAPI_KEY) return null;
  const host = process.env.RAPIDAPI_HOST || "irctc1.p.rapidapi.com";
  const path = process.env.RAPIDAPI_LIVE_PATH || "/api/v1/liveTrainStatus";
  const url = `https://${host}${path}?trainNo=${encodeURIComponent(trainNo)}&startDay=${process.env.RAPIDAPI_LIVE_STARTDAY || 1}`;
  try {
    const res = await fetch(url, { headers: { "x-rapidapi-key": process.env.RAPIDAPI_KEY, "x-rapidapi-host": host }, signal: AbortSignal.timeout(15000) });
    if (!res.ok) return null;
    const body = await res.json();
    const d = body && (body.data || body.Data);
    if (!d || body.status === false) return null;

    const delay = Number(pick(d, "delay", "Delay", "current_delay", "late_by")) || 0;
    const current = pick(d, "current_station_name", "CurrentStationName", "current_station", "last_station_name");
    const upcoming = pick(d, "upcoming_stations", "UpcomingStations", "route", "stations") || [];
    const stops = (Array.isArray(upcoming) ? upcoming : []).map((s) => ({
      name: pick(s, "station_name", "stationName", "name") || pick(s, "station_code", "code"),
      code: pick(s, "station_code", "stationCode", "code"),
      scheduled_arr: pick(s, "sta", "arrival", "arrival_time", "eta"),
      scheduled_dep: pick(s, "std", "departure", "departure_time", "etd"),
      expected_arr: pick(s, "eta", "expected_arrival"),
      delay_min: Number(pick(s, "delay", "arrival_delay")) || 0,
      status: "upcoming",
    }));
    return {
      source: "live",
      train_name: pick(d, "train_name", "TrainName"),
      current_station: current || null,
      next_station: pick(d, "next_station_name", "NextStationName") || stops[0]?.name || null,
      delay_min: delay,
      message: pick(d, "status", "message", "Message", "status_message") || null,
      eta: pick(d, "eta", "ETA") || null,
      stops,
    };
  } catch { return null; }
}

async function fromTimetable(trainNo) {
  const [trows] = await pool.query(
    `SELECT t.id, t.train_number, t.name, t.departure_time, t.arrival_time, s1.name AS source_name, s2.name AS destination_name
       FROM trains t JOIN stations s1 ON s1.id = t.source_station_id JOIN stations s2 ON s2.id = t.destination_station_id
      WHERE t.train_number = ?`, [trainNo]);
  const t = trows[0];
  if (!t) return null;
  const [stopsRaw] = await pool.query(
    `SELECT tr.arrival_offset_min, tr.departure_offset_min, s.name, s.code FROM train_routes tr JOIN stations s ON s.id = tr.station_id
      WHERE tr.train_id = ? ORDER BY tr.stop_number`, [t.id]);

  const [h, m] = String(t.departure_time).split(":").map(Number);
  const dep0 = h * 60 + m;
  const [ah, am] = String(t.arrival_time).split(":").map(Number);
  let total = (ah * 60 + am) - dep0; if (total <= 0) total += 1440;

  const stops = stopsRaw.length
    ? stopsRaw.map((s) => ({ name: s.name, code: s.code, arr: dep0 + s.arrival_offset_min, dep: dep0 + s.departure_offset_min }))
    : [{ name: t.source_name, code: "", arr: dep0, dep: dep0 }, { name: t.destination_name, code: "", arr: dep0 + total, dep: dep0 + total }];

  const now = istNow().minutes;
  let el = now - dep0;                       // minutes since departure today
  if (el < 0 && el + 1440 <= total) el += 1440; // overnight run that left yesterday
  let state = "running";
  if (el < 0) state = "not_started";
  else if (el > total) state = "arrived";

  let idx = -1; // last stop passed
  stops.forEach((s, i) => { if (state !== "not_started" && el >= s.dep - dep0) idx = i; });
  const out = stops.map((s, i) => ({
    name: s.name, code: s.code, scheduled_arr: hhmm(s.arr), scheduled_dep: hhmm(s.dep), delay_min: 0,
    status: state === "arrived" || i <= idx ? "passed" : i === idx + 1 ? "next" : "upcoming",
  }));
  return {
    source: "timetable", train_name: t.name, train_number: t.train_number,
    state,
    current_station: idx >= 0 ? stops[idx].name : null,
    next_station: state === "arrived" ? null : stops[Math.min(idx + 1, stops.length - 1)].name,
    delay_min: 0,
    origin: t.source_name, destination: t.destination_name,
    stops: out,
  };
}

/** Returns a normalised status object, or null if the train is unknown. */
async function getTrainStatus(trainNo) {
  const local = await fromTimetable(trainNo).catch((e) => { console.error("Timetable estimate failed:", e.message); return null; });
  let live = await fromRailRadar(trainNo);
  let why = live.error;
  if (live.error) {
    live = process.env.RAPIDAPI_LIVE_ENABLED === "true" ? await fromProvider(trainNo) : null; // optional old fallback
  }
  if (!local && !live) return null;
  if (!live) return { ...local, note: RR_NOTES[why] || RR_NOTES.unavailable };
  return { ...(local || {}), ...live, train_number: trainNo, train_name: live.train_name || local?.train_name, stops: live.stops.length ? live.stops : local?.stops || [] };
}

function describe(s) {
  if (s.source === "timetable") {
    if (s.state === "not_started") return "has not started yet (timetable)";
    if (s.state === "arrived") return "has completed its run (timetable)";
    return `is near ${s.current_station || "its origin"}, next ${s.next_station} (timetable, delays unknown)`;
  }
  const late = s.delay_min > 0 ? `running ${s.delay_min} min late` : "running on time";
  return `${s.current_station ? "last seen at " + s.current_station + ", " : ""}${late}${s.next_station ? ", next " + s.next_station : ""}`;
}

module.exports = { getTrainStatus, describe, istNow };
