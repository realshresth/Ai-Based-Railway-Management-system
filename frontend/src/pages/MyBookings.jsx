import { useEffect, useState } from "react";
import api from "../api/client";
import Toast from "../components/Toast";
import { PayStatus } from "../components/PaymentPanel";
import { downloadTicketPdf } from "../utils/ticketPdf";
import { UPI_ID } from "../config";

const downloadTicket = (b) => downloadTicketPdf(b, { upiId: UPI_ID });
// the ticket can only be downloaded once the payment has been verified
const canDownload = (b) => b.payment_status === "Verified" || b.payment_status === "Paid at counter";

export default function MyBookings() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");
  const [expanded, setExpanded] = useState(null);

  function load() {
    setLoading(true);
    api.get("/bookings/my").then((res) => setBookings(res.data)).finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function cancelBooking(id, pnr) {
    if (!window.confirm(`Cancel booking ${pnr}?`)) return;
    try {
      await api.put(`/bookings/${id}/cancel`);
      setToast(`Booking ${pnr} cancelled.`);
      load();
    } catch (err) {
      setToast(err.response?.data?.error || "Could not cancel booking.");
    }
  }

  return (
    <div className="container" style={{ padding: "40px 24px 70px" }}>
      <Toast message={toast} onDone={() => setToast("")} />
      <h2>My Bookings</h2>
      <p style={{ color: "var(--ink-soft)", marginBottom: 20 }}>Your full booking history, tickets and cancellations.</p>

      {loading && <p>Loading…</p>}
      {!loading && bookings.length === 0 && (
        <div className="empty-state"><h4>No bookings yet</h4><p>Search for a train to make your first booking.</p></div>
      )}

      {bookings.map((b) => (
        <div className="train-card" key={b.id} style={{ flexDirection: "column" }}>
          <div style={{ display: "flex", justifyContent: "space-between", width: "100%", flexWrap: "wrap", gap: 10 }}>
            <div>
              <span className="train-num mono">{b.pnr}</span>{" "}
              <span className="train-name">#{b.train_number} {b.train_name}</span>
              <div style={{ fontSize: 12.5, color: "var(--ink-soft)", marginTop: 4 }}>
                {b.source_name} → {b.destination_name} · {b.journey_date} · {b.class_code}
              </div>
            </div>
            <span className={"status-badge " + (
              b.status === "Confirmed" ? "status-confirmed" : b.status === "Cancelled" ? "status-cancelled" : "status-waiting"
            )}>{b.status}</span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginTop: 12, fontSize: 13 }}>
            <span style={{ color: "var(--ink-soft)" }}>
              Payment · {b.payment_method === "online" ? "UPI" : "at counter (legacy)"}{b.transaction_id ? <> · Txn <span className="mono">{b.transaction_id}</span></> : null} · ₹{b.total_fare}
            </span>
            <PayStatus status={b.payment_status} />
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
            <button className="btn btn-outline btn-sm" onClick={() => setExpanded(expanded === b.id ? null : b.id)}>
              {expanded === b.id ? "Hide details" : "View details"}
            </button>
            {canDownload(b) ? (
              <button className="btn btn-outline btn-sm" onClick={() => downloadTicket(b)}>Download ticket (PDF)</button>
            ) : (
              <span className="dl-note">{b.payment_status === "Rejected" ? "Payment rejected - ticket unavailable" : "Ticket download unlocks after payment is verified"}</span>
            )}
            {b.status !== "Cancelled" && (
              <button className="btn btn-danger btn-sm" onClick={() => cancelBooking(b.id, b.pnr)}>Cancel booking</button>
            )}
          </div>

          {expanded === b.id && (
            <table className="data-table" style={{ width: "100%", marginTop: 14 }}>
              <thead><tr><th>Passenger</th><th>Age</th><th>Gender</th><th>Coach</th><th>Seat</th><th>Berth</th></tr></thead>
              <tbody>
                {b.passengers.map((p) => (
                  <tr key={p.id}><td>{p.name}</td><td>{p.age}</td><td>{p.gender}</td><td>{p.coach || "-"}</td><td>{p.coach_seat || p.seat_number || "Waitlisted"}</td><td>{p.berth_type || "-"}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ))}
    </div>
  );
}
