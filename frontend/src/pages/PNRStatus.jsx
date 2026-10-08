import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import api from "../api/client";

export default function PNRStatus() {
  const location = useLocation();
  const [pnr, setPnr] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const p = params.get("pnr");
    if (p) { setPnr(p); lookup(p); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function lookup(value) {
    const q = (value || pnr).trim();
    if (!q) { setError("Enter a PNR number."); return; }
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await api.get(`/bookings/pnr/${q}`);
      setResult(res.data);
    } catch (err) {
      setError(err.response?.data?.error || "No booking found for this PNR.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container" style={{ padding: "40px 24px 70px", maxWidth: 700 }}>
      <h2>PNR Status</h2>
      <p style={{ color: "var(--ink-soft)", marginBottom: 20 }}>Enter your 10-digit PNR to check booking and passenger status.</p>

      <div style={{ display: "flex", gap: 10 }}>
        <input placeholder="e.g. 4821093765" value={pnr} onChange={(e) => setPnr(e.target.value)}
          style={{ flex: 1, padding: 12, border: "1.5px solid var(--line)", borderRadius: 8, fontSize: 14 }} />
        <button className="btn btn-primary" onClick={() => lookup()} disabled={loading}>
          {loading ? "Checking…" : "Check Status"}
        </button>
      </div>

      {error && <div className="msg-error" style={{ marginTop: 16 }}>{error}</div>}

      {result && (
        <div className="ticket" style={{ marginTop: 22 }}>
          <div className="ticket-head">
            <div>
              <div style={{ fontSize: 12, color: "#C9DAD3" }}>PNR NUMBER</div>
              <div className="pnr">{result.pnr}</div>
            </div>
            <span className={"status-badge " + (
              result.status === "Confirmed" ? "status-confirmed" :
              result.status === "Cancelled" ? "status-cancelled" : "status-waiting"
            )}>{result.status}</span>
          </div>
          <div className="ticket-body">
            <div className="ticket-grid">
              <div className="tg-item"><span>Train</span><b>#{result.train_number} {result.train_name}</b></div>
              <div className="tg-item"><span>Route</span><b>{result.source_name} → {result.destination_name}</b></div>
              <div className="tg-item"><span>Journey date</span><b>{result.journey_date}</b></div>
              <div className="tg-item"><span>Class</span><b>{result.class_code}</b></div>
            </div>
            <table className="data-table" style={{ width: "100%" }}>
              <thead><tr><th>Passenger</th><th>Age</th><th>Gender</th><th>Seat</th></tr></thead>
              <tbody>
                {result.passengers.map((p) => (
                  <tr key={p.id}>
                    <td>{p.name}</td><td>{p.age}</td><td>{p.gender}</td><td>{p.seat_number || "Waitlisted"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
