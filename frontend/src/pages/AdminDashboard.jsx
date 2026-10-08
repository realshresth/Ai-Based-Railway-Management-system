import { useEffect, useState } from "react";
import api from "../api/client";
import Toast from "../components/Toast";

const TABS = ["Overview", "Trains", "Stations", "Routes", "Fares", "Bookings", "Users"];

export default function AdminDashboard() {
  const [tab, setTab] = useState("Overview");
  const [toast, setToast] = useState("");
  const notify = (m) => setToast(m);

  return (
    <div className="container" style={{ padding: "40px 24px 70px" }}>
      <Toast message={toast} onDone={() => setToast("")} />
      <h2>Admin Console</h2>
      <p style={{ color: "var(--ink-soft)", marginBottom: 24 }}>Manage the network — trains, stations, routes, fares, bookings and users.</p>

      <div className="tabs-row">
        {TABS.map((t) => (
          <button key={t} className={"tab-btn" + (tab === t ? " active" : "")} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>

      {tab === "Overview" && <Overview />}
      {tab === "Trains" && <ManageTrains notify={notify} />}
      {tab === "Stations" && <ManageStations notify={notify} />}
      {tab === "Routes" && <ManageRoutes notify={notify} />}
      {tab === "Fares" && <ManageFares notify={notify} />}
      {tab === "Bookings" && <ManageBookings notify={notify} />}
      {tab === "Users" && <ManageUsers notify={notify} />}
    </div>
  );
}

/* ---------------- Overview ---------------- */
function Overview() {
  const [stats, setStats] = useState(null);
  useEffect(() => { api.get("/users/stats/overview").then((res) => setStats(res.data)); }, []);
  if (!stats) return <p>Loading stats…</p>;
  return (
    <div className="dash-grid">
      <div className="stat-card"><span>Total trains</span><b>{stats.totalTrains}</b></div>
      <div className="stat-card"><span>Total stations</span><b>{stats.totalStations}</b></div>
      <div className="stat-card"><span>Total bookings</span><b>{stats.totalBookings}</b></div>
      <div className="stat-card"><span>Total passengers</span><b>{stats.totalPassengers}</b></div>
      <div className="stat-card"><span>Network occupancy</span><b>{stats.occupancyPercent}%</b></div>
      <div className="stat-card"><span>Revenue (confirmed+waiting)</span><b>₹{stats.revenue.toLocaleString("en-IN")}</b></div>
    </div>
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
    await api.post("/trains", draft);
    notify("Train added.");
    setDraft(null);
    load();
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
            <Field label="Base fare (₹, Sleeper)"><input type="number" value={draft.baseFare} onChange={(e) => setDraft({ ...draft, baseFare: e.target.value })} /></Field>
            <Field label="Total seats"><input type="number" value={draft.totalSeats} onChange={(e) => setDraft({ ...draft, totalSeats: e.target.value })} /></Field>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <button className="btn btn-outline btn-sm" onClick={() => setDraft(null)}>Cancel</button>
            <button className="btn btn-primary btn-sm" onClick={save}>Save train</button>
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
              <td><button className="btn btn-danger btn-sm" onClick={() => remove(t.id, t.train_number)}>Remove</button></td>
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

  if (bookings.length === 0) return <div className="empty-state"><h4>No bookings yet</h4></div>;

  return (
    <table className="data-table" style={{ width: "100%" }}>
      <thead><tr><th>PNR</th><th>Train</th><th>Route</th><th>Date</th><th>Class</th><th>Fare</th><th>Status</th><th></th></tr></thead>
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
            <td>{b.status !== "Cancelled" && <button className="btn btn-danger btn-sm" onClick={() => cancel(b.id, b.pnr)}>Cancel</button>}</td>
          </tr>
        ))}
      </tbody>
    </table>
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
