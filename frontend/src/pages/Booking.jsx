import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import Toast from "../components/Toast";

function availability(cls) {
  const left = cls.total_seats - cls.booked_seats;
  if (left <= 0) return { label: "Full", cls: "avail-full" };
  if (left < cls.total_seats * 0.15) return { label: `${left} left`, cls: "avail-low" };
  return { label: `${left} available`, cls: "avail-ok" };
}

export default function Booking() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [stations, setStations] = useState([]);
  const [form, setForm] = useState({ from: "", to: "", date: "", passengers: 1 });
  const [results, setResults] = useState([]);
  const [searched, setSearched] = useState(false);
  const [selectedTrain, setSelectedTrain] = useState(null);
  const [selectedClass, setSelectedClass] = useState(null);
  const [passengers, setPassengers] = useState([{ name: "", age: "", gender: "M" }]);
  const [savedPassengers, setSavedPassengers] = useState([]);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [confirmedPNR, setConfirmedPNR] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.get("/stations").then((res) => setStations(res.data)).catch(() => {});
    const params = new URLSearchParams(location.search);
    const from = params.get("from"), to = params.get("to"), date = params.get("date"), pax = params.get("passengers");
    const sort = params.get("sort");
    if (from && to) {
      const f = { from, to, date: date || "", passengers: pax || 1 };
      setForm(f);
      runSearch(f, sort);
    }
    if (user) {
      api.get("/passengers").then((res) => setSavedPassengers(res.data)).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function durationToMinutes(d) {
    if (!d) return Infinity;
    const h = /(\d+)\s*h/.exec(d);
    const m = /(\d+)\s*m/.exec(d);
    return (h ? parseInt(h[1]) * 60 : 0) + (m ? parseInt(m[1]) : 0);
  }

  async function runSearch(f, sort) {
    if (!f.from || !f.to) return;
    const res = await api.get("/trains", { params: { from: f.from, to: f.to } });
    let data = res.data;
    if (sort === "fastest") {
      data = [...data].sort((a, b) => durationToMinutes(a.duration) - durationToMinutes(b.duration));
    }
    setResults(data);
    setSearched(true);
    setSelectedTrain(null);
    setSelectedClass(null);
    setConfirmedPNR(null);
  }

  function handleSearchSubmit(e) {
    e.preventDefault();
    if (form.from === form.to) { setError("Origin and destination can't be the same."); return; }
    setError("");
    runSearch(form);
  }

  function selectClass(train, cls) {
    setSelectedTrain(train);
    setSelectedClass(cls);
    setPassengers(Array.from({ length: Number(form.passengers) || 1 }, () => ({ name: "", age: "", gender: "M" })));
    setError("");
  }

  function updatePassenger(i, key, value) {
    setPassengers((prev) => prev.map((p, idx) => (idx === i ? { ...p, [key]: value } : p)));
  }

  function fillFromSaved(i, savedId) {
    const sp = savedPassengers.find((p) => String(p.id) === savedId);
    if (!sp) return;
    setPassengers((prev) => prev.map((p, idx) => (idx === i ? { name: sp.name, age: sp.age, gender: sp.gender } : p)));
  }

  async function confirmBooking() {
    if (!user) { navigate("/login"); return; }
    if (!form.date) { setError("Please choose a journey date."); return; }
    if (passengers.some((p) => !p.name.trim() || !p.age)) { setError("Please fill in every passenger's name and age."); return; }

    setSubmitting(true);
    setError("");
    try {
      const res = await api.post("/bookings", {
        train_id: selectedTrain.id,
        class_code: selectedClass.class_code,
        journey_date: form.date,
        passengers: passengers.map((p) => ({ ...p, age: Number(p.age) })),
      });
      setConfirmedPNR(res.data);
      setToast(res.data.status === "Confirmed" ? "Booking confirmed!" : "Added to waiting list.");
    } catch (err) {
      setError(err.response?.data?.error || "Booking failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const totalFare = selectedClass ? selectedClass.fare * passengers.length : 0;

  return (
    <div className="container" style={{ padding: "40px 24px 70px" }}>
      <Toast message={toast} onDone={() => setToast("")} />
      <h2>Book Tickets</h2>
      <p style={{ color: "var(--ink-soft)", marginBottom: 20 }}>Search a route, pick a class, and confirm passenger details.</p>

      <form className="search-card" style={{ margin: "0 0 30px", maxWidth: "none" }} onSubmit={handleSearchSubmit}>
        <div className="search-grid">
          <div className="field">
            <label>From Station</label>
            <select value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value })} required>
              <option value="">Select origin</option>
              {stations.map((s) => <option key={s.id} value={s.code}>{s.name} ({s.code})</option>)}
            </select>
          </div>
          <div className="field">
            <label>To Station</label>
            <select value={form.to} onChange={(e) => setForm({ ...form, to: e.target.value })} required>
              <option value="">Select destination</option>
              {stations.map((s) => <option key={s.id} value={s.code}>{s.name} ({s.code})</option>)}
            </select>
          </div>
          <div className="field">
            <label>Journey Date</label>
            <input type="date" min={new Date().toISOString().slice(0, 10)} value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </div>
          <div className="field">
            <label>Passengers</label>
            <select value={form.passengers} onChange={(e) => setForm({ ...form, passengers: e.target.value })}>
              {[1,2,3,4,5,6].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <button className="btn btn-primary" type="submit" style={{ height: 44 }}>Search Trains</button>
        </div>
      </form>

      {error && <div className="msg-error">{error}</div>}

      {searched && !confirmedPNR && (
        results.length === 0 ? (
          <div className="empty-state"><h4>No direct trains on this route</h4><p>Try a different station pair.</p></div>
        ) : (
          results.map((t) => (
            <div className="train-card" key={t.id} style={{ flexDirection: "column" }}>
              <div style={{ display: "flex", justifyContent: "space-between", width: "100%", flexWrap: "wrap" }}>
                <div>
                  <span className="train-num">#{t.train_number}</span> <span className="train-name">{t.name}</span>
                  <div style={{ fontSize: 12.5, color: "var(--ink-soft)", marginTop: 4 }}>Runs: {t.days_of_operation}</div>
                </div>
              </div>
              <div className="route-line" style={{ width: "100%" }}>
                <div className="route-point"><b>{t.departure_time?.slice(0,5)}</b><span>{t.source_name}</span></div>
                <div className="route-track" />
                <div className="route-point"><b>{t.arrival_time?.slice(0,5)}</b><span>{t.destination_name}</span></div>
                <div style={{ fontSize: 12.5, color: "var(--ink-soft)", minWidth: 70, textAlign: "right" }}>{t.duration}</div>
              </div>
              <div className="class-row">
                {t.classes.map((c) => {
                  const av = availability(c);
                  const isSel = selectedTrain?.id === t.id && selectedClass?.id === c.id;
                  return (
                    <div key={c.id} className={"class-chip" + (isSel ? " selected" : "")} onClick={() => selectClass(t, c)}>
                      <b>{c.class_code}</b>
                      ₹{c.fare}
                      <div className={av.cls} style={{ fontSize: 11, marginTop: 2 }}>{av.label}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )
      )}

      {selectedTrain && selectedClass && !confirmedPNR && (
        <div className="ticket" style={{ marginTop: 24 }}>
          <div className="ticket-head">
            <div>
              <div style={{ fontSize: 13, color: "var(--on-navy)" }}>Passenger details</div>
              <b>#{selectedTrain.train_number} {selectedTrain.name} · {selectedClass.class_code}</b>
            </div>
            <div>{form.date || "Select a date above"}</div>
          </div>
          <div className="ticket-body">
            {passengers.map((p, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1.4fr", gap: 12, marginBottom: 12 }}>
                <input placeholder="Full name" value={p.name} onChange={(e) => updatePassenger(i, "name", e.target.value)}
                  style={{ padding: 10, border: "1.5px solid var(--line)", borderRadius: 8 }} />
                <input placeholder="Age" type="number" min="1" value={p.age} onChange={(e) => updatePassenger(i, "age", e.target.value)}
                  style={{ padding: 10, border: "1.5px solid var(--line)", borderRadius: 8 }} />
                <select value={p.gender} onChange={(e) => updatePassenger(i, "gender", e.target.value)}
                  style={{ padding: 10, border: "1.5px solid var(--line)", borderRadius: 8 }}>
                  <option value="M">Male</option><option value="F">Female</option><option value="O">Other</option>
                </select>
                {savedPassengers.length > 0 && (
                  <select defaultValue="" onChange={(e) => fillFromSaved(i, e.target.value)}
                    style={{ padding: 10, border: "1.5px solid var(--line)", borderRadius: 8 }}>
                    <option value="">Use saved passenger…</option>
                    {savedPassengers.map((sp) => <option key={sp.id} value={sp.id}>{sp.name} ({sp.age})</option>)}
                  </select>
                )}
              </div>
            ))}

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 20, borderTop: "1px dashed var(--line)", paddingTop: 16 }}>
              <div>
                <div style={{ fontSize: 12, color: "var(--ink-soft)", textTransform: "uppercase" }}>Fare summary</div>
                <b style={{ fontSize: 20 }}>₹{totalFare.toLocaleString("en-IN")}</b>
                <span style={{ fontSize: 12.5, color: "var(--ink-soft)" }}> ({passengers.length} × ₹{selectedClass.fare})</span>
              </div>
              <button className="btn btn-primary" disabled={submitting} onClick={confirmBooking}>
                {submitting ? "Booking…" : user ? "Confirm & Pay" : "Login to book"}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmedPNR && (
        <div className="ticket" style={{ marginTop: 24 }}>
          <div className="ticket-head">
            <div>
              <div style={{ fontSize: 12, color: "var(--on-navy)" }}>PNR NUMBER</div>
              <div className="pnr">{confirmedPNR.pnr}</div>
            </div>
            <span className={"status-badge " + (confirmedPNR.status === "Confirmed" ? "status-confirmed" : "status-waiting")}>
              {confirmedPNR.status}
            </span>
          </div>
          <div className="ticket-body">
            <p>Your ticket for <b>#{selectedTrain.train_number} {selectedTrain.name}</b> has been booked.</p>
            <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
              <button className="btn btn-outline btn-sm" onClick={() => navigate("/my-bookings")}>Go to My Bookings</button>
              <button className="btn btn-outline btn-sm" onClick={() => navigate(`/pnr-status?pnr=${confirmedPNR.pnr}`)}>View PNR Status</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
