import { useEffect, useState } from "react";
import api from "../api/client";
import { UPI_ID, PAYEE_NAME } from "../config";

export const TXN_RE = /^[A-Za-z0-9]{8,30}$/;

export function payBadge(status) {
  if (status === "Verified" || status === "Paid at counter") return "status-confirmed";
  if (status === "Rejected") return "status-cancelled";
  return "status-waiting";
}

export function PayStatus({ status }) {
  return <span className={"status-badge " + payBadge(status)}>{status}</span>;
}

/**
 * Payment choice used when booking:
 *  - Online: pay on UPI, then type the transaction ID. The status shows on the right.
 *  - Offline: pay at the counter; staff mark it as paid later.
 */
export default function PaymentPanel({ amount, method, onMethod, txn, onTxn, group }) {
  const [check, setCheck] = useState(null); // null | "checking" | { valid, used }
  const [copied, setCopied] = useState(false);
  const t = txn.trim();
  const formatOk = TXN_RE.test(t);

  useEffect(() => {
    if (method !== "online" || !formatOk) { setCheck(null); return undefined; }
    setCheck("checking");
    let live = true;
    const timer = setTimeout(() => {
      api.get(`/bookings/payment/check/${encodeURIComponent(t)}`, { params: { group } })
        .then((r) => { if (live) setCheck(r.data); })
        .catch(() => { if (live) setCheck(null); });
    }, 450);
    return () => { live = false; clearTimeout(timer); };
  }, [t, method, group, formatOk]);

  let st;
  if (!t) st = { text: "Waiting for transaction ID", tone: "idle" };
  else if (!formatOk) st = { text: "Invalid ID (8–30 letters/digits)", tone: "bad" };
  else if (check === "checking") st = { text: "Checking…", tone: "idle" };
  else if (check && check.used) st = { text: "Already used", tone: "bad" };
  else st = { text: "Ready – staff will verify", tone: "good" };

  async function copyUpi() {
    try { await navigator.clipboard.writeText(UPI_ID); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch (e) { /* ignore */ }
  }

  const upiLink = `upi://pay?pa=${encodeURIComponent(UPI_ID)}&pn=${encodeURIComponent(PAYEE_NAME)}&am=${Number(amount || 0).toFixed(2)}&cu=INR&tn=${encodeURIComponent("Rail ticket")}`;

  return (
    <div className="pay-panel">
      <div className="pay-title">Pay online · UPI</div>
      {(
        <div className="pay-body">
          <div className="upi-box">
            <div>
              <div className="upi-label">Pay on UPI</div>
              <div className="upi-id">{UPI_ID}</div>
              <div className="upi-amt">Amount: <b>₹{Number(amount || 0).toLocaleString("en-IN")}</b></div>
            </div>
            <div className="upi-actions">
              <button type="button" className="btn btn-outline btn-sm" onClick={copyUpi}>{copied ? "Copied ✓" : "Copy UPI ID"}</button>
              <a className="btn btn-primary btn-sm" href={upiLink}>Open UPI app</a>
            </div>
          </div>

          <div className="pay-txn-row">
            <div className="pay-txn-field">
              <label htmlFor="txn-id">Write Transaction ID</label>
              <input id="txn-id" value={txn} onChange={(e) => onTxn(e.target.value)} placeholder="e.g. 412345678901" autoComplete="off" maxLength={30} />
            </div>
            <div className={"pay-status pay-" + st.tone} role="status" aria-live="polite">
              <span className="pay-dot" />{st.text}
            </div>
          </div>
          <p className="pay-note">After paying, copy the transaction / UTR number from your UPI app and paste it above. Staff verify it against the payment received.</p>
        </div>
      )}
    </div>
  );
}
