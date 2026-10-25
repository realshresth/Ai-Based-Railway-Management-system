import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import Toast from "../components/Toast";
import PaymentPanel, { PayStatus, TXN_RE } from "../components/PaymentPanel";

const CLASS_ORDER = ["SL", "3A", "2A", "1A"];

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
  const [form, setForm] = useState({ from: "", to: "", date: "" });
  const [results, setResults] = useState([]);
  const [searched, setSearched] = useState(false);
  const [selectedTrain, setSelectedTrain] = useState(null);
  const [selectedClass, setSelectedClass] = useState(null);
  const [savedPassengers, setSavedPassengers] = useState([]); // from Passenger Management
  const [passengers, setPassengers] = useState([{ name: "", age: "", gender: "M" }]);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [confirmedPNR, setConfirmedPNR] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [loginPrompt, setLoginPrompt] = useState(false);
  const [autoUpgrade, setAutoUpgrade] = useState(false);
  const [seatClasses, setSeatClasses] = useState([]); // live vacancy + berth counts for the selected train
  const [maxFare, setMaxFare] = useState(null);
  const [txn, setTxn] = useState("");
  const [payGroup] = useState(() => `g${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`);

  useEffect(() => {
    api.get("/stations").then((res) => setStations(res.data)).catch(() => {});
    const params = new URLSearchParams(location.search);
    const from = params.get("from"), to = params.get("to"), date = params.get("date");
    const sort = params.get("sort");
    const mf = params.get("maxFare") ? Number(params.get("maxFare")) : null;
    if (mf) setMaxFare(mf);
    if (from || to) {
      const f = { from: from || "", to: to || "", date: date || "" };
      setForm(f);
      runSearch(f, sort, mf);
    }
    if (user) api.get("/passengers").then((res) => setSavedPassengers(res.data)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function durationToMinutes(d) {
    if (!d) return Infinity;
    const h = /(\d+)\s*h/.exec(d);
    const m = /(\d+)\s*m/.exec(d);
    return (h ? parseInt(h[1]) * 60 : 0) + (m ? parseInt(m[1]) : 0);
  }

  async function runSearch(f, sort, fareCap) {
    if (!f.from && !f.to) return;
    const res = await api.get("/trains", { params: { from: f.from || undefined, to: f.to || undefined } });
    let data = res.data;
    if (fareCap) {
      data = data
        .map((t) => ({ ...t, classes: t.classes.filter((c) => Number(c.fare) <= fareCap) }))
        .filter((t) => t.classes.length);
    }
    if (sort === "cheapest") {
      const low = (t) => Math.min(...t.classes.map((c) => Number(c.fare)));
      data = [...data].sort((a, b) => low(a) - low(b));
    }
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
    if (form.from && form.from === form.to) { setError("Origin and destination can't be the same."); return; }
    setError("");
    setMaxFare(null);
    runSearch(form);
  }

  function selectClass(train, cls) {
    if (!user) { setLoginPrompt(true); return; } // logged-out visitors must log in first
    setSelectedTrain(train);
    setSelectedClass(cls);
    setPassengers((prev) => prev.map((p) => ({ ...p, berth_pref: "" })));
    setError("");
    api.get("/seats/vacant", { params: { train_id: train.id } })
      .then((res) => setSeatClasses(res.data[0]?.classes || []))
      .catch(() => setSeatClasses([]));
  }

  function updatePassenger(i, key, value) {
    setPassengers((prev) => prev.map((p, idx) => (idx === i ? { ...p, [key]: value } : p)));
  }

  function fillFromSaved(i, savedId) {
    const sp = savedPassengers.find((q) => String(q.id) === savedId);
    if (!sp) return;
    setPassengers((prev) => prev.map((p, idx) => (idx === i ? { ...p, name: sp.name, age: sp.age, gender: sp.gender } : p)));
  }

  function addPassenger() {
    setPassengers((prev) => (prev.length >= 6 ? prev : [...prev, { name: "", age: "", gender: "M", berth_pref: "" }]));
  }
  function removePassenger(i) {
    setPassengers((prev) => (prev.length <= 1 ? prev : prev.filter((_, idx) => idx !== i)));
  }

  async function confirmBooking() {
    if (!user) { navigate("/login"); return; }
    if (!form.date) { setError("Please choose a journey date."); return; }
    if (passengers.some((p) => !p.name.trim() || !p.age)) { setError("Please fill in every passenger's name and age."); return; }

    if (!TXN_RE.test(txn.trim())) {
      setError("Pay on UPI first, then write the transaction ID (8–30 letters or digits).");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const res = await api.post("/bookings", {
        auto_upgrade: autoUpgrade,
        payment: { method: "online", transaction_id: txn.trim(), group: payGroup },
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
  const curClass = selectedClass ? seatClasses.find((c) => c.class_code === selectedClass.class_code) : null;
  const higherFree = selectedClass
    ? seatClasses.filter((c) => CLASS_ORDER.indexOf(c.class_code) > CLASS_ORDER.indexOf(selectedClass.class_code) && c.vacant >= passengers.length)
    : [];
  const classShort = curClass && curClass.vacant < passengers.length;

  return (
    <div className="container" style={{ padding: "40px 24px 70px" }}>
      <Toast message={toast} onDone={() => setToast("")} />
      {loginPrompt && (
        <div className="modal-back" onClick={() => setLoginPrompt(false)}>
          <div className="modal-box" role="dialog" aria-modal="true" aria-labelledby="login-pop-title" onClick={(e) => e.stopPropagation()}>
            <div className="modal-icon">🔒</div>
            <h3 id="login-pop-title">Please log in to book</h3>
            <p>You need to be logged in to book seats. Log in or create a free account, then come back to pick your class.</p>
            <div className="modal-actions">
              <button className="btn btn-primary" autoFocus
                onClick={() => navigate("/login", { state: { from: location.pathname + location.search } })}>Login</button>
              <button className="btn btn-outline" onClick={() => navigate("/register", { state: { from: location.pathname + location.search } })}>Create account</button>
              <button className="btn btn-outline" onClick={() => setLoginPrompt(false)}>Not now</button>
            </div>
          </div>
        </div>
      )}
      <h2>Book Tickets</h2>
      <p style={{ color: "var(--ink-soft)", marginBottom: 20 }}>Search a route, pick a class, and confirm passenger details.</p>

      <form className="search-card" style={{ margin: "0 0 30px", maxWidth: "none" }} onSubmit={handleSearchSubmit}>
        <div className="search-grid">
          <div className="swap-group">
          <div className="field">
            <label>From Station</label>
            <select value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value, to: form.to === e.target.value ? "" : form.to })}>
              <option value="">Select origin</option>
              {stations.filter((s) => s.code !== form.to).map((s) => <option key={s.id} value={s.code}>{s.name} ({s.code})</option>)}
            </select>
          </div>
          <button type="button" className="swap-btn" aria-label="Swap stations" title="Swap stations"
            onClick={() => setForm({ ...form, from: form.to, to: form.from })}>⇄</button>
          <div className="field">
            <label>To Station</label>
            <select value={form.to} onChange={(e) => setForm({ ...form, to: e.target.value, from: form.from === e.target.value ? "" : form.from })}>
              <option value="">Select destination</option>
              {stations.filter((s) => s.code !== form.from).map((s) => <option key={s.id} value={s.code}>{s.name} ({s.code})</option>)}
            </select>
          </div>
          </div>
          <div className="field">
            <label>Journey Date</label>
            <input type="date" min={new Date().toISOString().slice(0, 10)} value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </div>
          <button className="btn btn-primary" type="submit" style={{ height: 44 }}>Search Trains</button>
        </div>
      </form>

      {error && <div className="msg-error">{error}</div>}
      {maxFare && searched && <div className="msg-ok">Showing classes priced up to ₹{maxFare.toLocaleString("en-IN")}.</div>}

      {searched && !confirmedPNR && (
        results.length === 0 ? (
          <div className="empty-state"><h4>No trains found</h4><p>Try a different station pair{maxFare ? " or a higher fare limit" : ""}.</p></div>
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
              <div key={i} style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: ".04em", color: "var(--ink-soft)", marginBottom: 6 }}>
                  Passenger {i + 1}{i === 0 ? " (primary)" : ""}
                </div>
                {savedPassengers.length > 0 && (
                  <select value="" onChange={(e) => fillFromSaved(i, e.target.value)} className="pax-saved" aria-label={`Choose passenger ${i + 1} from saved passengers`}>
                    <option value="">Choose passenger</option>
                    {savedPassengers.map((sp) => <option key={sp.id} value={sp.id}>{sp.name} · {sp.age} · {sp.gender}</option>)}
                  </select>
                )}
                <div className="pax-row">
                  <input placeholder="Full name" value={p.name} onChange={(e) => updatePassenger(i, "name", e.target.value)}
                    style={{ padding: 10, border: "1.5px solid var(--line)", borderRadius: 8 }} aria-label={`Passenger ${i + 1} name`} />
                  <input placeholder="Age" type="number" min="1" max="120" value={p.age} onChange={(e) => updatePassenger(i, "age", e.target.value)}
                    style={{ padding: 10, border: "1.5px solid var(--line)", borderRadius: 8 }} aria-label={`Passenger ${i + 1} age`} />
                  <select value={p.gender} onChange={(e) => updatePassenger(i, "gender", e.target.value)}
                    style={{ padding: 10, border: "1.5px solid var(--line)", borderRadius: 8 }} aria-label={`Passenger ${i + 1} gender`}>
                    <option value="M">Male</option><option value="F">Female</option><option value="O">Other</option>
                  </select>
                  <select value={p.berth_pref || ""} onChange={(e) => updatePassenger(i, "berth_pref", e.target.value)}
                    style={{ padding: 10, border: "1.5px solid var(--line)", borderRadius: 8 }} aria-label="Berth preference">
                    <option value="">Berth: no preference</option>
                    {Object.entries(curClass?.berths || {}).map(([b, n]) => (
                      <option key={b} value={b} disabled={n === 0}>{b} ({n} vacant)</option>
                    ))}
                  </select>
                  {i > 0 ? <button type="button" className="btn btn-outline btn-sm" onClick={() => removePassenger(i)}>Remove</button> : <span />}
                </div>
              </div>
            ))}
            {passengers.length < 6 && (
              <button type="button" className="btn btn-outline btn-sm" onClick={addPassenger} style={{ marginBottom: 6 }}>+ Add passenger</button>
            )}

            <div className="upgrade-card">
              <label className="upgrade-toggle">
                <input type="checkbox" checked={autoUpgrade} onChange={(e) => setAutoUpgrade(e.target.checked)} />
                <span>
                  <b>Auto-upgrade (free)</b>
                  <em>If {selectedClass.class_code} is full, move us to a higher class on this train when seats are vacant. You still pay the {selectedClass.class_code} fare.</em>
                </span>
              </label>
              <div className="upgrade-hint">
                {curClass && <span>{selectedClass.class_code}: <b>{curClass.vacant}</b> vacant</span>}
                {higherFree.length > 0
                  ? <span>Higher class free now: {higherFree.map((c) => `${c.class_code} (${c.vacant})`).join(", ")}</span>
                  : <span>No higher class has enough free seats right now</span>}
              </div>
              {classShort && !autoUpgrade && <div className="upgrade-warn">Only {curClass.vacant} vacant in {selectedClass.class_code} — this booking would be waitlisted. Turn on auto-upgrade to try a higher class.</div>}
            </div>

            <PaymentPanel amount={totalFare} method="online" onMethod={() => {}} txn={txn} onTxn={setTxn} group={payGroup} />

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 20, borderTop: "1px dashed var(--line)", paddingTop: 16 }}>
              <div>
                <div style={{ fontSize: 12, color: "var(--ink-soft)", textTransform: "uppercase" }}>Fare summary</div>
                <b style={{ fontSize: 20 }}>₹{totalFare.toLocaleString("en-IN")}</b>
                <span style={{ fontSize: 12.5, color: "var(--ink-soft)" }}> ({passengers.length} × ₹{selectedClass.fare})</span>
              </div>
              <button className="btn btn-primary" disabled={submitting} onClick={confirmBooking}>
                {submitting ? "Booking…" : user ? "Confirm & submit payment" : "Login to book"}
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
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginTop: 8 }}>
              <span style={{ fontSize: 13.5, color: "var(--ink-soft)" }}>Payment ({confirmedPNR.payment_method === "online" ? "UPI" : "at counter"}):</span>
              <PayStatus status={confirmedPNR.payment_status} />
            </div>
            <p style={{ fontSize: 13, color: "var(--ink-soft)" }}>
              {confirmedPNR.payment_method === "online"
                ? "Staff will verify your transaction ID. The status updates here and in My Bookings."
                : `Pay ₹${Number(confirmedPNR.totalFare).toLocaleString("en-IN")} at the booking counter and quote your PNR.`}
            </p>
            <div className={confirmedPNR.sms_to ? "msg-ok" : "msg-error"} style={{ marginBottom: 10 }}>
              {confirmedPNR.sms_to
                ? `Confirmation SMS sent to ${confirmedPNR.sms_to}. We'll also text you this train's status on the journey date.`
                : "No SMS sent: add your mobile number in Profile to get booking and train-status messages."}
            </div>
            {confirmedPNR.upgraded_from && (
              <div className="msg-ok">Good news: your seats were upgraded from {confirmedPNR.upgraded_from} to {confirmedPNR.class_code} at no extra cost.</div>
            )}
            <table className="data-table" style={{ width: "100%", margin: "12px 0" }}>
              <thead><tr><th>Passenger</th><th>Coach</th><th>Seat</th><th>Berth</th><th>Preference</th></tr></thead>
              <tbody>
                {confirmedPNR.passengers.map((q, i) => (
                  <tr key={i}>
                    <td>{q.name}</td>
                    <td><b>{q.coach || "-"}</b></td>
                    <td className="mono">{q.coach_seat ? q.coach_seat : q.seat_number || "Waitlisted"}</td>
                    <td>{q.berth_type || "-"}</td>
                    <td>{!q.berth_pref ? "None" : q.preference_met === false ? `${q.berth_pref} (not available)` : `${q.berth_pref} ✓`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ display: "flex", gap: 12, marginTop: 16, flexWrap: "wrap" }}>
              <span className="dl-note">Ticket download unlocks after staff verify your payment. Check My Bookings.</span>
              <button className="btn btn-outline btn-sm" onClick={() => navigate("/my-bookings")}>Go to My Bookings</button>
              <button className="btn btn-outline btn-sm" onClick={() => navigate(`/pnr-status?pnr=${confirmedPNR.pnr}`)}>View PNR Status</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
