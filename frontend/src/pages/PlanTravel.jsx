import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import Toast from "../components/Toast";
import PaymentPanel, { PayStatus, TXN_RE } from "../components/PaymentPanel";

function emptyLeg(from = "") {
  return { from, to: "", date: "", trains: [], searched: false, selectedTrainId: null, selectedClassCode: null };
}

export default function PlanTravel() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stations, setStations] = useState([]);
  const [legs, setLegs] = useState([emptyLeg()]);
  const [passengers, setPassengers] = useState([{ name: "", age: "", gender: "M" }]);
  const [error, setError] = useState("");
  const [loginPrompt, setLoginPrompt] = useState(false);
  const [toast, setToast] = useState("");
  const [booking, setBooking] = useState(false);
  const [payMethod, setPayMethod] = useState("online");
  const [txn, setTxn] = useState("");
  const [payGroup] = useState(() => `g${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`);
  const [results, setResults] = useState(null); // array of {pnr, status} per leg once booked

  useEffect(() => {
    api.get("/stations").then((res) => setStations(res.data)).catch(() => {});
  }, []);

  function updateLeg(i, patch) {
    setLegs((prev) => prev.map((leg, idx) => (idx === i ? { ...leg, ...patch } : leg)));
  }

  function addLeg() {
    const last = legs[legs.length - 1];
    setLegs([...legs, emptyLeg(last?.to || "")]);
  }

  function removeLeg(i) {
    setLegs((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function findTrains(i) {
    const leg = legs[i];
    if (!leg.from || !leg.to || leg.from === leg.to) {
      setError(`Leg ${i + 1}: choose two different stations.`);
      return;
    }
    setError("");
    const res = await api.get("/trains", { params: { from: leg.from, to: leg.to } });
    updateLeg(i, { trains: res.data, searched: true, selectedTrainId: null, selectedClassCode: null });
  }

  function selectClass(i, trainId, classCode) {
    if (!user) { setLoginPrompt(true); return; }
    updateLeg(i, { selectedTrainId: trainId, selectedClassCode: classCode });
  }

  function updatePassenger(idx, key, value) {
    setPassengers((prev) => prev.map((p, i) => (i === idx ? { ...p, [key]: value } : p)));
  }
  function addPassenger() { setPassengers((prev) => [...prev, { name: "", age: "", gender: "M" }]); }
  function removePassenger(idx) { setPassengers((prev) => prev.filter((_, i) => i !== idx)); }

  const readyLegs = legs.filter((l) => l.selectedTrainId && l.selectedClassCode && l.date);
  const allLegsReady = legs.length > 0 && readyLegs.length === legs.length;

  function legFare(leg) {
    const train = leg.trains.find((t) => t.id === leg.selectedTrainId);
    const cls = train?.classes.find((c) => c.class_code === leg.selectedClassCode);
    return cls ? cls.fare * passengers.length : 0;
  }
  const totalFare = legs.reduce((sum, leg) => sum + legFare(leg), 0);

  async function bookTrip() {
    if (!user) { navigate("/login"); return; }
    if (!allLegsReady) { setError("Pick a train, class and date for every leg first."); return; }
    if (passengers.some((p) => !p.name.trim() || !p.age)) { setError("Fill in every passenger's name and age."); return; }

    if (payMethod === "online" && !TXN_RE.test(txn.trim())) {
      setError("Pay the trip total on UPI first, then write the transaction ID (8–30 letters or digits).");
      return;
    }

    setBooking(true);
    setError("");
    const legResults = [];
    try {
      for (const leg of legs) {
        const res = await api.post("/bookings", {
          train_id: leg.selectedTrainId,
          class_code: leg.selectedClassCode,
          journey_date: leg.date,
          passengers: passengers.map((p) => ({ ...p, age: Number(p.age) })),
          payment: { method: payMethod, transaction_id: txn.trim(), group: payGroup }, // one payment covers every leg
        });
        legResults.push({ from: leg.from, to: leg.to, ...res.data });
      }
      setResults(legResults);
      setToast("Trip booked across all legs!");
    } catch (err) {
      setError(err.response?.data?.error || "Could not book the full trip — some legs may already be booked.");
      setResults(legResults.length ? legResults : null);
    } finally {
      setBooking(false);
    }
  }

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
              <button className="btn btn-primary" autoFocus onClick={() => navigate("/login", { state: { from: "/plan-travel" } })}>Login</button>
              <button className="btn btn-outline" onClick={() => navigate("/register", { state: { from: "/plan-travel" } })}>Create account</button>
              <button className="btn btn-outline" onClick={() => setLoginPrompt(false)}>Not now</button>
            </div>
          </div>
        </div>
      )}
      <h2>Plan Travel</h2>
      <p style={{ color: "var(--ink-soft)", marginBottom: 20 }}>
        Build a multi-city trip: pick where you're going, then where you'll go from there — as many legs as you need.
      </p>

      {error && <div className="msg-error">{error}</div>}

      {legs.map((leg, i) => (
        <div className="card" key={i} style={{ marginBottom: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <h4 style={{ margin: 0 }}>Leg {i + 1}</h4>
            {legs.length > 1 && <button className="btn btn-outline btn-sm" onClick={() => removeLeg(i)}>Remove leg</button>}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 12, alignItems: "end" }}>
            <div className="field">
              <label>From</label>
              <select value={leg.from} onChange={(e) => updateLeg(i, { from: e.target.value, ...(leg.to === e.target.value ? { to: "" } : {}) })}>
                <option value="">Select origin</option>
                {stations.filter((s) => s.code !== leg.to).map((s) => <option key={s.id} value={s.code}>{s.name} ({s.code})</option>)}
              </select>
            </div>
            <div className="field">
              <label>To</label>
              <select value={leg.to} onChange={(e) => updateLeg(i, { to: e.target.value, ...(leg.from === e.target.value ? { from: "" } : {}) })}>
                <option value="">Select destination</option>
                {stations.filter((s) => s.code !== leg.from).map((s) => <option key={s.id} value={s.code}>{s.name} ({s.code})</option>)}
              </select>
            </div>
            <div className="field">
              <label>Date</label>
              <input type="date" min={new Date().toISOString().slice(0, 10)} value={leg.date}
                onChange={(e) => updateLeg(i, { date: e.target.value })} />
            </div>
            <button className="btn btn-outline" onClick={() => findTrains(i)}>Find trains</button>
          </div>

          {leg.searched && (
            leg.trains.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--ink-soft)", marginTop: 14 }}>No direct trains on this leg.</p>
            ) : (
              <div style={{ marginTop: 16 }}>
                {leg.trains.map((t) => (
                  <div key={t.id} style={{ borderTop: "1px dashed var(--line)", paddingTop: 12, marginTop: 12 }}>
                    <div style={{ fontSize: 13.5 }}>
                      <span className="train-num">#{t.train_number}</span> <b>{t.name}</b>{" "}
                      <span style={{ color: "var(--ink-soft)" }}>({t.departure_time?.slice(0,5)} → {t.arrival_time?.slice(0,5)}, {t.duration})</span>
                    </div>
                    <div className="class-row">
                      {t.classes.map((c) => {
                        const isSel = leg.selectedTrainId === t.id && leg.selectedClassCode === c.class_code;
                        return (
                          <div key={c.id} className={"class-chip" + (isSel ? " selected" : "")}
                            onClick={() => selectClass(i, t.id, c.class_code)}>
                            <b>{c.class_code}</b>₹{c.fare}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      ))}

      <button className="btn btn-outline" onClick={addLeg} style={{ marginBottom: 30 }}>+ Add another leg</button>

      <div className="card">
        <h4 style={{ marginBottom: 14 }}>Passenger details (applies to every leg)</h4>
        {passengers.map((p, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr auto", gap: 12, marginBottom: 12 }}>
            <input placeholder="Full name" value={p.name} onChange={(e) => updatePassenger(i, "name", e.target.value)}
              style={{ padding: 10, border: "1.5px solid var(--line)", borderRadius: 8 }} />
            <input placeholder="Age" type="number" min="1" value={p.age} onChange={(e) => updatePassenger(i, "age", e.target.value)}
              style={{ padding: 10, border: "1.5px solid var(--line)", borderRadius: 8 }} />
            <select value={p.gender} onChange={(e) => updatePassenger(i, "gender", e.target.value)}
              style={{ padding: 10, border: "1.5px solid var(--line)", borderRadius: 8 }}>
              <option value="M">Male</option><option value="F">Female</option><option value="O">Other</option>
            </select>
            {passengers.length > 1 && <button className="btn btn-outline btn-sm" onClick={() => removePassenger(i)}>Remove</button>}
          </div>
        ))}
        <button className="btn btn-outline btn-sm" onClick={addPassenger}>+ Add passenger</button>

        <div style={{ marginTop: 22 }}>
          <PaymentPanel amount={totalFare} method={payMethod} onMethod={setPayMethod} txn={txn} onTxn={setTxn} group={payGroup} />
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 22, borderTop: "1px dashed var(--line)", paddingTop: 16 }}>
          <div>
            <div style={{ fontSize: 12, color: "var(--ink-soft)", textTransform: "uppercase" }}>Trip total ({legs.length} leg{legs.length > 1 ? "s" : ""})</div>
            <b style={{ fontSize: 20 }}>₹{totalFare.toLocaleString("en-IN")}</b>
          </div>
          <button className="btn btn-primary" disabled={booking} onClick={bookTrip}>
            {booking ? "Booking…" : user ? "Book entire trip" : "Login to book"}
          </button>
        </div>
      </div>

      {results && (
        <div className="ticket" style={{ marginTop: 24 }}>
          <div className="ticket-head"><b>Trip booking summary</b></div>
          <div className="ticket-body">
            <table className="data-table" style={{ width: "100%" }}>
              <thead><tr><th>Leg</th><th>PNR</th><th>Status</th><th>Payment</th></tr></thead>
              <tbody>
                {results.map((r, i) => (
                  <tr key={i}>
                    <td>{r.from} → {r.to}</td>
                    <td className="mono">{r.pnr}</td>
                    <td><span className={"status-badge " + (r.status === "Confirmed" ? "status-confirmed" : "status-waiting")}>{r.status}</span></td>
                    <td><PayStatus status={r.payment_status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button className="btn btn-outline btn-sm" style={{ marginTop: 16 }} onClick={() => navigate("/my-bookings")}>Go to My Bookings</button>
          </div>
        </div>
      )}
    </div>
  );
}
