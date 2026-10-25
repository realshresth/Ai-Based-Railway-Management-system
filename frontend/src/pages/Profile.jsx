import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import Toast from "../components/Toast";

const errMsg = (e, fallback) => e.response?.data?.error || (e.request ? "Couldn't reach the server." : fallback);

export default function Profile() {
  const { user, updateUser } = useAuth();
  const isAdmin = user.role === "admin";
  const [form, setForm] = useState({
    name: user.name || "", phone: user.phone || "", gender: user.gender || "",
    dob: user.dob ? String(user.dob).slice(0, 10) : "", address: user.address || "",
  });
  const [pw, setPw] = useState({ currentPassword: "", newPassword: "", confirm: "" });
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");
  const [pwError, setPwError] = useState("");
  const [bookings, setBookings] = useState([]);

  useEffect(() => {
    if (!isAdmin) api.get("/bookings/my").then((r) => setBookings(r.data)).catch(() => {});
  }, [isAdmin]);

  async function saveProfile(e) {
    e.preventDefault();
    setError("");
    try {
      const res = await api.put("/auth/profile", form);
      updateUser(res.data.user, res.data.token);
      setToast("Profile updated.");
    } catch (err) { setError(errMsg(err, "Could not update profile.")); }
  }

  async function changePassword(e) {
    e.preventDefault();
    setPwError("");
    if (pw.newPassword !== pw.confirm) { setPwError("New passwords do not match."); return; }
    try {
      await api.put("/auth/change-password", { currentPassword: pw.currentPassword, newPassword: pw.newPassword });
      setPw({ currentPassword: "", newPassword: "", confirm: "" });
      setToast("Password changed.");
    } catch (err) { setPwError(errMsg(err, "Could not change password.")); }
  }

  const active = bookings.filter((b) => b.status !== "Cancelled");
  const spent = active.reduce((s, b) => s + Number(b.total_fare), 0);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <div className="container" style={{ padding: "40px 24px 70px", maxWidth: 860 }}>
      <Toast message={toast} onDone={() => setToast("")} />
      <h2>My Profile</h2>
      <p style={{ color: "var(--ink-soft)", marginBottom: 24 }}>
        {user.email} · {isAdmin ? "Administrator" : "Client account"} · member since {String(user.created_at || "").slice(0, 10)}
      </p>

      {!isAdmin && (
        <div className="dash-grid" style={{ marginBottom: 24 }}>
          <div className="stat-card"><span>Total bookings</span><b>{bookings.length}</b></div>
          <div className="stat-card"><span>Active tickets</span><b>{active.length}</b></div>
          <div className="stat-card"><span>Total spent</span><b>₹{spent.toLocaleString("en-IN")}</b></div>
        </div>
      )}

      <form onSubmit={saveProfile} className="card" style={{ marginBottom: 22 }}>
        <h3 style={{ marginBottom: 14 }}>Personal details</h3>
        {error && <div className="msg-error">{error}</div>}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div className="form-field"><label>Full name</label><input value={form.name} onChange={set("name")} required /></div>
          <div className="form-field"><label>Email (cannot be changed)</label><input value={user.email} disabled /></div>
          <div className="form-field"><label>Mobile number (for SMS)</label><input type="tel" value={form.phone} onChange={set("phone")} placeholder="10-digit mobile number" /></div>
          <div className="form-field"><label>Gender</label>
            <select value={form.gender} onChange={set("gender")}>
              <option value="">Prefer not to say</option><option value="M">Male</option><option value="F">Female</option><option value="O">Other</option>
            </select>
          </div>
          <div className="form-field"><label>Date of birth</label><input type="date" value={form.dob} onChange={set("dob")} /></div>
          <div className="form-field"><label>Address</label><input value={form.address} onChange={set("address")} /></div>
        </div>
        <button className="btn btn-primary btn-sm">Save changes</button>
      </form>

      <form onSubmit={changePassword} className="card" style={{ marginBottom: 22 }}>
        <h3 style={{ marginBottom: 14 }}>Change password</h3>
        {pwError && <div className="msg-error">{pwError}</div>}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
          <div className="form-field"><label>Current password</label><input type="password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} required /></div>
          <div className="form-field"><label>New password</label><input type="password" minLength={6} value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} required /></div>
          <div className="form-field"><label>Confirm new password</label><input type="password" minLength={6} value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} required /></div>
        </div>
        <button className="btn btn-primary btn-sm">Update password</button>
      </form>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {isAdmin ? (
          <Link to="/admin" className="btn btn-outline btn-sm">Go to Admin Console</Link>
        ) : (
          <>
            <Link to="/my-bookings" className="btn btn-outline btn-sm">My bookings</Link>
            <Link to="/passengers" className="btn btn-outline btn-sm">Saved passengers</Link>
            <Link to="/booking" className="btn btn-primary btn-sm">Book a ticket</Link>
          </>
        )}
      </div>
    </div>
  );
}
