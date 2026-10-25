import { useEffect, useState } from "react";
import api from "../api/client";
import Toast from "../components/Toast";
import { PayStatus } from "../components/PaymentPanel";
import { useAuth } from "../context/AuthContext";

const TABS = ["Overview", "Trains", "Stations", "Routes", "Fares", "Coaches", "Bookings", "Users"];

export default function AdminDashboard() {
  const [tab, setTab] = useState("Overview");
  const [toast, setToast] = useState("");
  const { user } = useAuth();
  const notify = (m) => setToast(m);

  return (
    <div className="admin-shell">
      <Toast message={toast} onDone={() => setToast("")} />

      <aside className="admin-side">
        <div className="admin-side-title">Staff portal</div>
        <nav className="admin-side-nav">
          {TABS.map((t) => (
            <button key={t} className={"side-link" + (tab === t ? " active" : "")} onClick={() => setTab(t)}>{t}</button>
          ))}
        </nav>
        <div className="side-user">Signed in as<b>{user?.email}</b></div>
      </aside>

      <section className="admin-main">
        <div className="admin-head">
          <div>
            <div className="admin-eyebrow">{tab}</div>
            <h2>Admin Console</h2>
          </div>
          {tab === "Overview" && (
            <div className="admin-head-actions">
              <button className="btn btn-outline btn-sm" onClick={() => setTab("Bookings")}>View bookings</button>
              <button className="btn btn-primary btn-sm" onClick={() => setTab("Trains")}>+ Add train</button>
            </div>
          )}
        </div>

        {tab === "Overview" && <Overview go={setTab} />}
        {tab === "Trains" && <ManageTrains notify={notify} />}
        {tab === "Stations" && <ManageStations notify={notify} />}
        {tab === "Routes" && <ManageRoutes notify={notify} />}
        {tab === "Fares" && <ManageFares notify={notify} />}
        {tab === "Coaches" && <ManageCoaches notify={notify} />}
        {tab === "Bookings" && <ManageBookings notify={notify} />}
        {tab === "Users" && <ManageUsers notify={notify} />}
      </section>
    </div>
  );
}

/* ---------------- Overview ---------------- */
const ICONS = {
  train: <><rect x="5" y="3" width="14" height="14" rx="3" /><path d="M5 11h14M9 21l2-4M15 21l-2-4" /></>,
  pin: <><path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z" /><circle cx="12" cy="10" r="2.5" /></>,
  ticket: <><path d="M3 9V7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 6v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-6z" /><path d="M13 5v14" strokeDasharray="2 3" /></>,
  users: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5" /><path d="M16 5a3.5 3.5 0 0 1 0 7M18 14.8c2 .6 3.2 2.3 3.5 5.2" /></>,
  gauge: <><path d="M4 17a8 8 0 1 1 16 0" /><path d="M12 17l4-5" /></>,
  rupee: <><path d="M7 5h10M7 9h10M7 5c5 0 7 1.5 7 4s-2 4-7 4l7 7" /></>,
};

function Icon({ name }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICONS[name]}</svg>
  );
}

// bookings per day for the last 7 days, from the real bookings list
function lastSevenDays(bookings) {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    days.push({ key, label: d.toLocaleDateString("en-IN", { weekday: "short" }), count: 0 });
  }
  bookings.forEach((b) => {
    const day = days.find((x) => x.key === String(b.created_at).slice(0, 10));
    if (day) day.count += 1;
  });
  return days;
}

function Overview({ go }) {
  const [stats, setStats] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/users/stats/overview").then((res) => setStats(res.data)).catch(() => setError("Could not load stats."));
    api.get("/bookings").then((res) => setBookings(res.data)).catch(() => {});
  }, []);

  if (error) return <div className="msg-error">{error}</div>;
  if (!stats) return <p>Loading stats…</p>;

  const cards = [
    { label: "Total trains", value: stats.totalTrains, icon: "train", tone: "green" },
    { label: "Total stations", value: stats.totalStations, icon: "pin", tone: "blue" },
    { label: "Total bookings", value: stats.totalBookings, icon: "ticket", tone: "rose" },
    { label: "Total passengers", value: stats.totalPassengers, icon: "users", tone: "violet" },
    { label: "Network occupancy", value: `${stats.occupancyPercent}%`, icon: "gauge", tone: "amber" },
    { label: "Revenue (confirmed + waiting)", value: `₹${Number(stats.revenue).toLocaleString("en-IN")}`, icon: "rupee", tone: "green" },
  ];

  const days = lastSevenDays(bookings);
  const max = Math.max(1, ...days.map((d) => d.count));
  const peak = Math.max(...days.map((d) => d.count));
  const pct = Math.max(0, Math.min(100, Number(stats.occupancyPercent) || 0));
  const circ = 2 * Math.PI * 48;

  const actions = [
    { label: "Add a train", hint: "Schedule, classes and fares", tab: "Trains" },
    { label: "Add a station", hint: "Code, city and state", tab: "Stations" },
    { label: "Edit routes", hint: "Stops and timings", tab: "Routes" },
    { label: "Manage users", hint: "Clients and staff", tab: "Users" },
  ];

  return (
    <>
      <div className="kpi-grid">
        {cards.map((c) => (
          <div className="kpi-card" key={c.label}>
            <div className={"kpi-ic tone-" + c.tone}><Icon name={c.icon} /></div>
            <div><div className="kpi-label">{c.label}</div><div className="kpi-value">{c.value}</div></div>
          </div>
        ))}
      </div>

      <div className="panel-row">
        <div className="panel panel-wide">
          <div className="panel-head">
            <div className="panel-title">Bookings this week</div>
            <div className="panel-sub">{peak === 0 ? "No bookings in the last 7 days" : `Busiest day: ${peak} booking${peak > 1 ? "s" : ""}`}</div>
          </div>
          <svg viewBox="0 0 520 190" className="bar-chart" role="img" aria-label="Bookings per day for the last 7 days">
            <g stroke="var(--line)" strokeWidth="1">
              <line x1="0" y1="30" x2="520" y2="30" /><line x1="0" y1="80" x2="520" y2="80" /><line x1="0" y1="130" x2="520" y2="130" />
            </g>
            {days.map((d, i) => {
              const h = d.count === 0 ? 4 : Math.max(10, (d.count / max) * 120);
              const x = 20 + i * 74;
              return (
                <g key={d.key}>
                  <rect x={x} y={150 - h} width="42" height={h} rx="8"
                    fill={d.count === 0 ? "var(--line)" : d.count === peak ? "var(--navy)" : "var(--green)"} />
                  {d.count > 0 && <text x={x + 21} y={150 - h - 6} textAnchor="middle" fontSize="12" fontWeight="600" fill="var(--navy)">{d.count}</text>}
                  <text x={x + 21} y="176" textAnchor="middle" fontSize="12" fill="var(--ink-soft)">{d.label}</text>
                </g>
              );
            })}
          </svg>
        </div>

        <div className="panel panel-ring">
          <div className="panel-title" style={{ alignSelf: "stretch" }}>Seat occupancy</div>
          <div className="ring-wrap">
            <svg viewBox="0 0 120 120" width="170" height="170" role="img" aria-label={`Occupancy ${pct} percent`}>
              <circle cx="60" cy="60" r="48" fill="none" stroke="var(--line)" strokeWidth="14" />
              <circle cx="60" cy="60" r="48" fill="none" stroke="var(--success)" strokeWidth="14" strokeLinecap="round"
                strokeDasharray={`${(pct / 100) * circ} ${circ}`} transform="rotate(-90 60 60)" />
            </svg>
            <div className="ring-center"><b>{pct}%</b><span>of seats booked</span></div>
          </div>
        </div>
      </div>

      <div className="action-row">
        {actions.map((a) => (
          <button key={a.label} className="action-card" onClick={() => go(a.tab)}>
            {a.label}<span>{a.hint}</span>
          </button>
        ))}
      </div>
    </>
  );
}

/* ---------------- Trains ---------------- */
function ManageTrains({ notify }) {
  const [trains, setTrains] = useState([]);
  const [stations, setStations] = useState([]);
  const [draft, setDraft] = useState(null);

  function load() {
    api.get("/trains").then((res) => setTrains(res.data));
    api.get("/stations").then((res) => setStations(res.data));
  }
  useEffect(load, []);

  function newDraft() {
    setDraft({
      train_number: "", name: "", source_station_id: stations[0]?.id || "", destination_station_id: stations[1]?.id || "",
      departure_time: "09:00", arrival_time: "17:00", duration: "8h 00m", days_of_operation: "Daily", baseFare: 1000, totalSeats: 500,
    });
  }

  async function save() {
    if (!draft.train_number.trim() || !draft.name.trim() || draft.source_station_id === draft.destination_station_id) {
      notify("Please fill valid details (source ≠ destination)."); return;
    }
    if (draft.id) {
      await api.put(`/trains/${draft.id}`, draft);
      notify("Train updated.");
    } else {
      await api.post("/trains", draft);
      notify("Train added.");
    }
    setDraft(null);
    load();
  }

  function startEdit(t) {
    setDraft({
      id: t.id, train_number: t.train_number, name: t.name,
      source_station_id: t.source_station_id, destination_station_id: t.destination_station_id,
      departure_time: (t.departure_time || "").slice(0, 5), arrival_time: (t.arrival_time || "").slice(0, 5),
      duration: t.duration, days_of_operation: t.days_of_operation,
    });
  }

  async function remove(id, number) {
    if (!window.confirm(`Remove train #${number}?`)) return;
    await api.delete(`/trains/${id}`);
    notify(`Removed train #${number}`);
    load();
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <button className="btn btn-primary btn-sm" onClick={newDraft}>+ Add train</button>
      </div>

      {draft && (
        <div className="card" style={{ marginBottom: 18 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Train number"><input value={draft.train_number} onChange={(e) => setDraft({ ...draft, train_number: e.target.value })} /></Field>
            <Field label="Train name"><input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></Field>
            <Field label="Source">
              <select value={draft.source_station_id} onChange={(e) => setDraft({ ...draft, source_station_id: e.target.value })}>
                {stations.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>
            <Field label="Destination">
              <select value={draft.destination_station_id} onChange={(e) => setDraft({ ...draft, destination_station_id: e.target.value })}>
                {stations.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>
            <Field label="Departure"><input type="time" value={draft.departure_time} onChange={(e) => setDraft({ ...draft, departure_time: e.target.value })} /></Field>
            <Field label="Arrival"><input type="time" value={draft.arrival_time} onChange={(e) => setDraft({ ...draft, arrival_time: e.target.value })} /></Field>
            <Field label="Duration"><input value={draft.duration} onChange={(e) => setDraft({ ...draft, duration: e.target.value })} /></Field>
            <Field label="Days of operation"><input value={draft.days_of_operation} onChange={(e) => setDraft({ ...draft, days_of_operation: e.target.value })} /></Field>
            {!draft.id && <Field label="Base fare (₹, Sleeper)"><input type="number" value={draft.baseFare} onChange={(e) => setDraft({ ...draft, baseFare: e.target.value })} /></Field>}
            {!draft.id && <Field label="Total seats"><input type="number" value={draft.totalSeats} onChange={(e) => setDraft({ ...draft, totalSeats: e.target.value })} /></Field>}
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <button className="btn btn-outline btn-sm" onClick={() => setDraft(null)}>Cancel</button>
            <button className="btn btn-primary btn-sm" onClick={save}>{draft.id ? "Update train" : "Save train"}</button>
          </div>
        </div>
      )}

      <table className="data-table" style={{ width: "100%" }}>
        <thead><tr><th>Number</th><th>Name</th><th>Route</th><th>Timing</th><th></th></tr></thead>
        <tbody>
          {trains.map((t) => (
            <tr key={t.id}>
              <td className="mono">{t.train_number}</td>
              <td>{t.name}</td>
              <td>{t.source_name} → {t.destination_name}</td>
              <td>{t.departure_time?.slice(0,5)} – {t.arrival_time?.slice(0,5)}</td>
              <td style={{ whiteSpace: "nowrap" }}>
                <button className="btn btn-outline btn-sm" style={{ marginRight: 6 }} onClick={() => startEdit(t)}>Edit</button>
                <button className="btn btn-danger btn-sm" onClick={() => remove(t.id, t.train_number)}>Remove</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------------- Stations ---------------- */
function ManageStations({ notify }) {
  const [stations, setStations] = useState([]);
  const [draft, setDraft] = useState({ code: "", name: "", city: "", state: "" });

  function load() { api.get("/stations").then((res) => setStations(res.data)); }
  useEffect(load, []);

  async function add(e) {
    e.preventDefault();
    if (!draft.code.trim() || !draft.name.trim() || !draft.city.trim()) return;
    await api.post("/stations", draft);
    notify("Station added.");
    setDraft({ code: "", name: "", city: "", state: "" });
    load();
  }

  async function remove(id) {
    if (!window.confirm("Remove this station? Trains referencing it may fail to load.")) return;
    await api.delete(`/stations/${id}`);
    notify("Station removed.");
    load();
  }

  return (
    <div>
      <form onSubmit={add} className="card" style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr 1fr 1fr auto", gap: 12, marginBottom: 20, alignItems: "end" }}>
        <Field label="Code"><input value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value })} required /></Field>
        <Field label="Name"><input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} required /></Field>
        <Field label="City"><input value={draft.city} onChange={(e) => setDraft({ ...draft, city: e.target.value })} required /></Field>
        <Field label="State"><input value={draft.state} onChange={(e) => setDraft({ ...draft, state: e.target.value })} /></Field>
        <button className="btn btn-primary btn-sm">Add</button>
      </form>

      <table className="data-table" style={{ width: "100%" }}>
        <thead><tr><th>Code</th><th>Name</th><th>City</th><th>State</th><th></th></tr></thead>
        <tbody>
          {stations.map((s) => (
            <tr key={s.id}>
              <td className="mono">{s.code}</td><td>{s.name}</td><td>{s.city}</td><td>{s.state}</td>
              <td><button className="btn btn-danger btn-sm" onClick={() => remove(s.id)}>Delete</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------------- Routes (stops) ---------------- */
function ManageRoutes({ notify }) {
  const [trains, setTrains] = useState([]);
  const [stations, setStations] = useState([]);
  const [selectedTrain, setSelectedTrain] = useState("");
  const [stops, setStops] = useState([]);
  const [draft, setDraft] = useState({ station_id: "", stop_number: 1, arrival_offset_min: 0, departure_offset_min: 0 });

  useEffect(() => {
    api.get("/trains").then((res) => setTrains(res.data));
    api.get("/stations").then((res) => setStations(res.data));
  }, []);

  function loadStops(trainId) {
    if (!trainId) { setStops([]); return; }
    api.get(`/routes/train/${trainId}`).then((res) => setStops(res.data));
  }

  async function addStop() {
    if (!selectedTrain || !draft.station_id) return;
    await api.post("/routes", { ...draft, train_id: selectedTrain });
    notify("Stop added.");
    loadStops(selectedTrain);
  }

  async function removeStop(id) {
    await api.delete(`/routes/${id}`);
    notify("Stop removed.");
    loadStops(selectedTrain);
  }

  return (
    <div>
      <Field label="Select a train">
        <select value={selectedTrain} onChange={(e) => { setSelectedTrain(e.target.value); loadStops(e.target.value); }}>
          <option value="">Choose a train…</option>
          {trains.map((t) => <option key={t.id} value={t.id}>#{t.train_number} {t.name}</option>)}
        </select>
      </Field>

      {selectedTrain && (
        <>
          <div className="card" style={{ margin: "16px 0", display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr auto", gap: 12, alignItems: "end" }}>
            <Field label="Station">
              <select value={draft.station_id} onChange={(e) => setDraft({ ...draft, station_id: e.target.value })}>
                <option value="">Select…</option>
                {stations.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>
            <Field label="Stop #"><input type="number" value={draft.stop_number} onChange={(e) => setDraft({ ...draft, stop_number: e.target.value })} /></Field>
            <Field label="Arrival (min)"><input type="number" value={draft.arrival_offset_min} onChange={(e) => setDraft({ ...draft, arrival_offset_min: e.target.value })} /></Field>
            <Field label="Departure (min)"><input type="number" value={draft.departure_offset_min} onChange={(e) => setDraft({ ...draft, departure_offset_min: e.target.value })} /></Field>
            <button className="btn btn-primary btn-sm" onClick={addStop}>Add stop</button>
          </div>

          <table className="data-table" style={{ width: "100%" }}>
            <thead><tr><th>#</th><th>Station</th><th>Arrival</th><th>Departure</th><th></th></tr></thead>
            <tbody>
              {stops.map((s) => (
                <tr key={s.id}>
                  <td>{s.stop_number}</td><td>{s.station_name}</td><td>{s.arrival_offset_min}</td><td>{s.departure_offset_min}</td>
                  <td><button className="btn btn-danger btn-sm" onClick={() => removeStop(s.id)}>Remove</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

/* ---------------- Fares ---------------- */
function ManageFares({ notify }) {
  const [trains, setTrains] = useState([]);
  const [edits, setEdits] = useState({});

  function load() { api.get("/trains").then((res) => setTrains(res.data)); }
  useEffect(load, []);

  function edit(classId, key, value) {
    setEdits((prev) => ({ ...prev, [classId]: { ...prev[classId], [key]: value } }));
  }

  async function saveFare(trainId, cls) {
    const e = edits[cls.id] || {};
    await api.put(`/trains/${trainId}/classes/${cls.id}`, {
      fare: e.fare ?? cls.fare,
      total_seats: e.total_seats ?? cls.total_seats,
    });
    notify(`Updated ${cls.class_code} fare for train #${trainId}.`);
    load();
  }

  return (
    <div>
      {trains.map((t) => (
        <div key={t.id} className="card" style={{ marginBottom: 16 }}>
          <h4 style={{ marginBottom: 12 }}>#{t.train_number} {t.name}</h4>
          <table className="data-table" style={{ width: "100%" }}>
            <thead><tr><th>Class</th><th>Fare (₹)</th><th>Total seats</th><th>Booked</th><th></th></tr></thead>
            <tbody>
              {t.classes.map((c) => (
                <tr key={c.id}>
                  <td>{c.class_code} — {c.class_name}</td>
                  <td><input type="number" defaultValue={c.fare} style={{ width: 90, padding: 6 }}
                    onChange={(e) => edit(c.id, "fare", e.target.value)} /></td>
                  <td><input type="number" defaultValue={c.total_seats} style={{ width: 90, padding: 6 }}
                    onChange={(e) => edit(c.id, "total_seats", e.target.value)} /></td>
                  <td>{c.booked_seats}</td>
                  <td><button className="btn btn-outline btn-sm" onClick={() => saveFare(t.id, c)}>Save</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

/* ---------------- Coaches ---------------- */
function ManageCoaches({ notify }) {
  const [trains, setTrains] = useState([]);
  const [trainId, setTrainId] = useState("");
  const [classes, setClasses] = useState([]);
  const [form, setForm] = useState({}); // class_code -> { coach_number, seats }
  const [err, setErr] = useState("");

  useEffect(() => {
    api.get("/trains").then((r) => { setTrains(r.data); if (r.data[0]) setTrainId(String(r.data[0].id)); });
  }, []);

  function load() {
    if (!trainId) return;
    api.get("/coaches", { params: { train_id: trainId } }).then((r) => setClasses(r.data)).catch(() => setErr("Could not load coaches."));
  }
  useEffect(load, [trainId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function run(fn, okMsg) {
    setErr("");
    try { const r = await fn(); notify(okMsg || r.data.message); load(); }
    catch (e) { setErr(e.response?.data?.error || "That did not work."); }
  }
  const setF = (cc, k, v) => setForm((f) => ({ ...f, [cc]: { ...f[cc], [k]: v } }));

  return (
    <div>
      <div className="field" style={{ maxWidth: 420, marginBottom: 16 }}>
        <label>Train</label>
        <select value={trainId} onChange={(e) => setTrainId(e.target.value)}>
          {trains.map((t) => <option key={t.id} value={t.id}>#{t.train_number} {t.name}</option>)}
        </select>
      </div>
      <p style={{ color: "var(--ink-soft)", fontSize: 13, marginBottom: 14 }}>
        Seats are numbered across the class and handed out coach by coach (berths Lower / Middle / Upper / Side repeat inside each coach).
        Adding a coach adds its seats to the class total. Passengers booked together are placed in the same coach when there is room.
      </p>
      {err && <div className="msg-error">{err}</div>}

      {classes.map((c) => {
        const f = form[c.class_code] || {};
        const last = c.coaches[c.coaches.length - 1];
        return (
          <div className="card" key={c.class_code} style={{ marginBottom: 16 }}>
            <h4 style={{ marginBottom: 4 }}>{c.class_code} — {c.class_name}</h4>
            <div style={{ fontSize: 12.5, color: "var(--ink-soft)", marginBottom: 10 }}>
              {c.total_seats} seats · {c.total_seats - c.booked_seats} vacant · {c.coaches.length} coach{c.coaches.length === 1 ? "" : "es"}
              {!c.saved && !c.out_of_sync && " (automatic layout, not saved yet)"}
            </div>
            {c.out_of_sync && <div className="msg-error">Saved coaches don't add up to the class total (it was changed in Fares). The automatic layout is being used. Set Total seats back to the sum of coach seats, or fix the coaches.</div>}
            <table className="data-table" style={{ width: "100%" }}>
              <thead><tr><th>Coach</th><th>Seats</th><th>Seat numbers</th><th>Vacant</th><th></th></tr></thead>
              <tbody>
                {c.coaches.map((k) => (
                  <tr key={k.coach_number}>
                    <td><b>{k.coach_number}</b></td><td>{k.seats}</td>
                    <td className="mono">{c.class_code}-{k.from} to {c.class_code}-{k.to}</td>
                    <td>{k.vacant}</td>
                    <td>
                      {c.saved && k === last && (
                        <button className="btn btn-danger btn-sm" onClick={() => { if (window.confirm(`Remove coach ${k.coach_number}?`)) run(() => api.delete(`/coaches/${k.id}`)); }}>Remove</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12, alignItems: "center" }}>
              {!c.saved && !c.out_of_sync && (
                <button className="btn btn-outline btn-sm" onClick={() => run(() => api.post("/coaches/generate", { train_id: Number(trainId), class_code: c.class_code }))}>Save these coaches</button>
              )}
              <input placeholder="Coach no. e.g. S5" value={f.coach_number || ""} onChange={(e) => setF(c.class_code, "coach_number", e.target.value)}
                style={{ width: 150, padding: 8, border: "1.5px solid var(--line)", borderRadius: 8 }} aria-label="Coach number" />
              <input type="number" min="1" max="120" placeholder="Seats" value={f.seats || ""} onChange={(e) => setF(c.class_code, "seats", e.target.value)}
                style={{ width: 100, padding: 8, border: "1.5px solid var(--line)", borderRadius: 8 }} aria-label="Seats in coach" />
              <button className="btn btn-primary btn-sm" onClick={() => run(async () => { const r = await api.post("/coaches", { train_id: Number(trainId), class_code: c.class_code, coach_number: f.coach_number, seats: Number(f.seats) }); setForm((x) => ({ ...x, [c.class_code]: {} })); return r; })}>+ Add coach</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ---------------- Bookings ---------------- */
function ManageBookings({ notify }) {
  const [bookings, setBookings] = useState([]);
  function load() { api.get("/bookings").then((res) => setBookings(res.data)); }
  useEffect(load, []);

  async function cancel(id, pnr) {
    if (!window.confirm(`Cancel booking ${pnr}?`)) return;
    await api.put(`/bookings/${id}/cancel`);
    notify(`Cancelled ${pnr}`);
    load();
  }

  async function setPay(id, status, pnr) {
    try {
      await api.put(`/bookings/${id}/payment`, { status });
      notify(`${pnr}: payment ${status.toLowerCase()}`);
      load();
    } catch (err) {
      notify(err.response?.data?.error || "Could not update payment.");
    }
  }

  if (bookings.length === 0) return <div className="empty-state"><h4>No bookings yet</h4></div>;

  return (
    <div style={{ overflowX: "auto" }}>
    <table className="data-table" style={{ width: "100%" }}>
      <thead><tr><th>PNR</th><th>Train</th><th>Route</th><th>Date</th><th>Class</th><th>Fare</th><th>Status</th><th>Payment</th><th></th></tr></thead>
      <tbody>
        {bookings.map((b) => (
          <tr key={b.id}>
            <td className="mono">{b.pnr}</td>
            <td>#{b.train_number} {b.train_name}</td>
            <td>{b.source_name} → {b.destination_name}</td>
            <td>{b.journey_date}</td>
            <td>{b.class_code}</td>
            <td>₹{b.total_fare}</td>
            <td><span className={"status-badge " + (
              b.status === "Confirmed" ? "status-confirmed" : b.status === "Cancelled" ? "status-cancelled" : "status-waiting"
            )}>{b.status}</span></td>
            <td>
              <div style={{ fontSize: 12, marginBottom: 4 }}>
                {b.payment_method === "online" ? "UPI" : "Counter"}{b.transaction_id ? <> · <span className="mono">{b.transaction_id}</span></> : null}
              </div>
              <PayStatus status={b.payment_status} />
              {b.status !== "Cancelled" && (
                <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                  {b.payment_method === "online" && b.payment_status !== "Verified" && (
                    <button className="btn btn-outline btn-sm" onClick={() => setPay(b.id, "Verified", b.pnr)}>Verify</button>
                  )}
                  {b.payment_method === "online" && b.payment_status === "Pending verification" && (
                    <button className="btn btn-danger btn-sm" onClick={() => setPay(b.id, "Rejected", b.pnr)}>Reject</button>
                  )}
                  {b.payment_method === "offline" && b.payment_status !== "Paid at counter" && (
                    <button className="btn btn-outline btn-sm" onClick={() => setPay(b.id, "Paid at counter", b.pnr)}>Mark paid</button>
                  )}
                </div>
              )}
            </td>
            <td>{b.status !== "Cancelled" && <button className="btn btn-danger btn-sm" onClick={() => cancel(b.id, b.pnr)}>Cancel</button>}</td>
          </tr>
        ))}
      </tbody>
    </table>
    </div>
  );
}

/* ---------------- Users ---------------- */
function ManageUsers({ notify }) {
  const [users, setUsers] = useState([]);
  function load() { api.get("/users").then((res) => setUsers(res.data)); }
  useEffect(load, []);

  async function remove(id) {
    if (!window.confirm("Delete this user account?")) return;
    try {
      await api.delete(`/users/${id}`);
      notify("User deleted.");
      load();
    } catch (err) {
      notify(err.response?.data?.error || "Could not delete user.");
    }
  }

  async function toggleRole(u) {
    const role = u.role === "admin" ? "user" : "admin";
    await api.put(`/users/${u.id}/role`, { role });
    notify(`${u.name} is now ${role}.`);
    load();
  }

  return (
    <table className="data-table" style={{ width: "100%" }}>
      <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Role</th><th></th></tr></thead>
      <tbody>
        {users.map((u) => (
          <tr key={u.id}>
            <td>{u.name}</td><td>{u.email}</td><td>{u.phone}</td>
            <td><span className="status-badge status-confirmed">{u.role}</span></td>
            <td style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-outline btn-sm" onClick={() => toggleRole(u)}>
                Make {u.role === "admin" ? "user" : "admin"}
              </button>
              <button className="btn btn-danger btn-sm" onClick={() => remove(u.id)}>Delete</button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--ink-soft)", marginBottom: 5 }}>{label}</label>
      {children}
    </div>
  );
}
