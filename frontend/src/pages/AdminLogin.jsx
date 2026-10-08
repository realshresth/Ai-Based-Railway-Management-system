import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function AdminAuth() {
  const [mode, setMode] = useState("login");
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [signupForm, setSignupForm] = useState({ name: "", email: "", password: "", adminCode: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { adminLogin, adminRegister } = useAuth();
  const navigate = useNavigate();

  async function submitLogin(e) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      await adminLogin(loginForm.email, loginForm.password);
      navigate("/admin");
    } catch (err) {
      setError(err.response?.data?.error || (err.request ? "Couldn't reach the server. Is the backend running?" : "Admin login failed."));
    } finally {
      setLoading(false);
    }
  }

  async function submitSignup(e) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      await adminRegister(signupForm);
      navigate("/admin");
    } catch (err) {
      setError(err.response?.data?.error || (err.request ? "Couldn't reach the server. Is the backend running?" : "Admin registration failed."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-toggle">
        <button type="button" className={mode === "login" ? "active" : ""} onClick={() => { setMode("login"); setError(""); }}>Admin Sign In</button>
        <button type="button" className={mode === "signup" ? "active" : ""} onClick={() => { setMode("signup"); setError(""); }}>Admin Sign Up</button>
      </div>

      <h2 style={{ marginBottom: 6 }}>Railway staff portal</h2>
      <p style={{ color: "var(--ink-soft)", fontSize: 13.5, marginBottom: 22 }}>
        Admin access only — manage trains, stations, routes, users and bookings.
      </p>
      {error && <div className="msg-error">{error}</div>}

      {mode === "login" ? (
        <form onSubmit={submitLogin}>
          <div className="form-field">
            <label>Admin email</label>
            <input type="email" value={loginForm.email} onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })} required />
          </div>
          <div className="form-field">
            <label>Password</label>
            <input type="password" value={loginForm.password} onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })} required />
          </div>
          <button className="btn btn-primary btn-block" disabled={loading}>{loading ? "Logging in…" : "Admin Login"}</button>
          <div style={{ marginTop: 16, fontSize: 12.5, textAlign: "center", color: "var(--ink-soft)" }}>
            Default seed credentials: admin@railsarthi.in / admin123<br />
            (set via <code>npm run seed:admin</code> in the backend)
          </div>
        </form>
      ) : (
        <form onSubmit={submitSignup}>
          <div className="form-field">
            <label>Full name</label>
            <input value={signupForm.name} onChange={(e) => setSignupForm({ ...signupForm, name: e.target.value })} required />
          </div>
          <div className="form-field">
            <label>Admin email</label>
            <input type="email" value={signupForm.email} onChange={(e) => setSignupForm({ ...signupForm, email: e.target.value })} required />
          </div>
          <div className="form-field">
            <label>Password</label>
            <input type="password" value={signupForm.password} onChange={(e) => setSignupForm({ ...signupForm, password: e.target.value })} required minLength={6} />
          </div>
          <div className="form-field">
            <label>Admin signup code</label>
            <input value={signupForm.adminCode} onChange={(e) => setSignupForm({ ...signupForm, adminCode: e.target.value })} required />
          </div>
          <button className="btn btn-primary btn-block" disabled={loading}>{loading ? "Creating admin account…" : "Create admin account"}</button>
          <div style={{ marginTop: 16, fontSize: 12.5, textAlign: "center", color: "var(--ink-soft)" }}>
            The signup code is set as <code>ADMIN_SIGNUP_CODE</code> in the backend's <code>.env</code> — share it only with staff.
          </div>
        </form>
      )}

      <div style={{ marginTop: 16, fontSize: 12.5, textAlign: "center", color: "var(--ink-soft)" }}>
        Not staff? <Link to="/login">Go to Client sign in</Link>
      </div>
    </div>
  );
}
