/**
 * Extra sample trains around Gorakhpur (GKP), Lucknow (LKO) and Varanasi (BSB).
 * Runs once per database (remembered in the app_flags table), so trains you delete later do not come back.
 * Existing stations/trains are reused, nothing is overwritten. Timetables are SAMPLE data - edit them in the Admin Console.
 */
const FLAG = "seed_extra_trains_v1";

// code, name, city, state, name-prefix used to find a station you already created under another code
const STATIONS = [
  ["GKP", "Gorakhpur Junction", "Gorakhpur", "Uttar Pradesh", "Gorakhpur"],
  ["LKO", "Lucknow Charbagh", "Lucknow", "Uttar Pradesh", "Lucknow"],
  ["BSB", "Varanasi Junction", "Varanasi", "Uttar Pradesh", "Varanasi"],
  ["NDLS", "New Delhi", "New Delhi", "Delhi", "New Delhi"],
  ["CNB", "Kanpur Central", "Kanpur", "Uttar Pradesh", "Kanpur"],
  ["PNBE", "Patna Junction", "Patna", "Bihar", "Patna"],
  ["BST", "Basti", "Basti", "Uttar Pradesh", "Basti"],
  ["GD", "Gonda Junction", "Gonda", "Uttar Pradesh", "Gonda"],
  ["AY", "Ayodhya Cantt", "Ayodhya", "Uttar Pradesh", "Ayodhya"],
  ["JNU", "Jaunpur Junction", "Jaunpur", "Uttar Pradesh", "Jaunpur"],
  ["MAU", "Mau Junction", "Mau", "Uttar Pradesh", "Mau"],
  ["BBK", "Barabanki Junction", "Barabanki", "Uttar Pradesh", "Barabanki"],
];

// number, name, [stops: station code, minutes from origin departure], departure, arrival, duration, days, fares {SL,3A,2A,1A}
const TRAINS = [
  ["15111", "Gorakhdham Intercity", [["GKP", 0], ["BST", 60], ["GD", 150], ["BBK", 270], ["LKO", 330]], "06:00", "11:30", "5h 30m", "Daily", [190, 480, 690, 1150]],
  ["15112", "Awadh Gorakhpur Express", [["LKO", 0], ["BBK", 50], ["GD", 160], ["BST", 255], ["GKP", 335]], "16:45", "22:20", "5h 35m", "Daily", [190, 480, 690, 1150]],
  ["15113", "Purvanchal Link Express", [["GKP", 0], ["MAU", 90], ["JNU", 215], ["BSB", 315]], "05:30", "10:45", "5h 15m", "Daily", [200, 500, 720, 1200]],
  ["15114", "Kashi Gorakhpur Express", [["BSB", 0], ["JNU", 100], ["MAU", 225], ["GKP", 320]], "17:30", "22:50", "5h 20m", "Daily", [200, 500, 720, 1200]],
  ["15121", "Lucknow Kashi Express", [["LKO", 0], ["AY", 120], ["JNU", 285], ["BSB", 405]], "07:15", "14:00", "6h 45m", "Mon,Wed,Fri,Sat", [235, 590, 850, 1420]],
  ["15122", "Kashi Lucknow Express", [["BSB", 0], ["JNU", 120], ["AY", 285], ["LKO", 405]], "15:20", "22:05", "6h 45m", "Tue,Thu,Sat,Sun", [235, 590, 850, 1420]],
  ["12551", "Gorakhpur Delhi Superfast", [["GKP", 0], ["BST", 65], ["LKO", 340], ["CNB", 430], ["NDLS", 770]], "19:30", "08:20", "12h 50m", "Daily", [390, 1020, 1480, 2520]],
  ["12552", "Delhi Gorakhpur Superfast", [["NDLS", 0], ["CNB", 340], ["LKO", 430], ["BST", 705], ["GKP", 770]], "20:15", "09:05", "12h 50m", "Daily", [390, 1020, 1480, 2520]],
  ["12561", "Kashi Delhi Express", [["BSB", 0], ["LKO", 390], ["CNB", 480], ["NDLS", 770]], "20:40", "09:30", "12h 50m", "Daily", [380, 1000, 1450, 2480]],
  ["15201", "Gorakhpur Patna Express", [["GKP", 0], ["MAU", 100], ["PNBE", 450]], "08:00", "15:30", "7h 30m", "Daily", [230, 575, 830, 1380]],
];

const SEATS = { SL: 216, "3A": 128, "2A": 96, "1A": 24 };
const NAMES = { SL: "Sleeper", "3A": "AC 3-Tier", "2A": "AC 2-Tier", "1A": "AC First" };

async function seedExtraTrains(conn) {
  await conn.query("CREATE TABLE IF NOT EXISTS app_flags (name VARCHAR(60) PRIMARY KEY, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)");
  const [done] = await conn.query("SELECT 1 FROM app_flags WHERE name = ?", [FLAG]);
  if (done.length) return 0;

  // resolve (or create) stations
  const ids = {};
  for (const [code, name, city, state, prefix] of STATIONS) {
    let [r] = await conn.query("SELECT id FROM stations WHERE code = ?", [code]);
    if (!r.length) [r] = await conn.query("SELECT id FROM stations WHERE name LIKE ? ORDER BY id LIMIT 1", [prefix + "%"]);
    if (r.length) ids[code] = r[0].id;
    else {
      const [ins] = await conn.query("INSERT INTO stations (code, name, city, state) VALUES (?,?,?,?)", [code, name, city, state]);
      ids[code] = ins.insertId;
    }
  }

  let added = 0;
  for (const [number, name, stops, dep, arr, dur, days, fares] of TRAINS) {
    const [exists] = await conn.query("SELECT id FROM trains WHERE train_number = ?", [number]);
    if (exists.length) continue;
    const first = stops[0][0], last = stops[stops.length - 1][0];
    const [t] = await conn.query(
      "INSERT INTO trains (train_number, name, source_station_id, destination_station_id, departure_time, arrival_time, duration, days_of_operation) VALUES (?,?,?,?,?,?,?,?)",
      [number, name, ids[first], ids[last], dep + ":00", arr + ":00", dur, days]
    );
    for (let i = 0; i < stops.length; i++) {
      const [code, off] = stops[i];
      const halt = i === 0 || i === stops.length - 1 ? 0 : 5;
      await conn.query(
        "INSERT INTO train_routes (train_id, station_id, stop_number, arrival_offset_min, departure_offset_min) VALUES (?,?,?,?,?)",
        [t.insertId, ids[code], i + 1, off, off + halt]
      );
    }
    const order = ["SL", "3A", "2A", "1A"];
    for (let k = 0; k < order.length; k++) {
      const c = order[k];
      const booked = Math.round(SEATS[c] * [0.35, 0.45, 0.4, 0.3][k]); // some seats already taken so availability looks real
      await conn.query(
        "INSERT INTO train_classes (train_id, class_code, class_name, fare, total_seats, booked_seats) VALUES (?,?,?,?,?,?)",
        [t.insertId, c, NAMES[c], fares[k], SEATS[c], booked]
      );
    }
    added++;
  }
  await conn.query("INSERT INTO app_flags (name) VALUES (?)", [FLAG]);
  return added;
}

module.exports = { seedExtraTrains };
