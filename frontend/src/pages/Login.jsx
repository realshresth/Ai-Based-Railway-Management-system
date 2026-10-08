import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ClientAuth() {
  const location = useLocation();
  const [mode, setMode] = useState(location.pathname === "/register" ? "signup" : "login");
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [signupForm, setSignupForm] = useState({ name: "", email: "", phone: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();
  const navigate = useNavigate();

  async function submitLogin(e) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      await login(loginForm.email, loginForm.password);
      navigate("/");
    } catch (err) {
      setError(err.response?.data?.error || (err.request ? "Couldn't reach the server. Is the backend running?" : "Login failed."));
    } finally {
      setLoading(false);
    }
  }

  async function submitSignup(e) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      await register(signupForm);
      navigate("/");
    } catch (err) {
      setError(err.response?.data?.error || (err.request ? "Couldn't reach the server. Is the backend running?" : "Registration failed."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-toggle">
        <button type="button" className={mode === "login" ? "active" : ""} onClick={() => { setMode("login"); setError(""); }}>Sign In</button>
        <button type="button" className={mode === "signup" ? "active" : ""} onClick={() => { setMode("signup"); setError(""); }}>Sign Up</button>
      </div>

      <h2 style={{ marginBottom: 6 }}>{mode === "login" ? "Welcome back" : "Create your account"}</h2>
      <p style={{ color: "var(--ink-soft)", fontSize: 13.5, marginBottom: 22 }}>
        {mode === "login" ? "Log in to book tickets and manage your trips." : "Book tickets, save passengers, and track your trips."}
      </p>
      {error && <div className="msg-error">{error}</div>}

      {mode === "login" ? (
        <form onSubmit={submitLogin}>
          <div className="form-field">
            <label>Email</label>
            <input type="email" value={loginForm.email} onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })} required />
          </div>
          <div className="form-field">
            <label>Password</label>
            <input type="password" value={loginForm.password} onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })} required />
          </div>
          <button className="btn btn-primary btn-block" disabled={loading}>{loading ? "Logging in…" : "Login"}</button>
          <div style={{ marginTop: 14, fontSize: 13, textAlign: "center", color: "var(--ink-soft)" }}>
            <Link to="/forgot-password">Forgot password?</Link>
          </div>
        </form>
      ) : (
        <form onSubmit={submitSignup}>
          <div className="form-field">
            <label>Full name</label>
            <input value={signupForm.name} onChange={(e) => setSignupForm({ ...signupForm, name: e.target.value })} required />
          </div>
          <div className="form-field">
            <label>Email</label>
            <input type="email" value={signupForm.email} onChange={(e) => setSignupForm({ ...signupForm, email: e.target.value })} required />
          </div>
          <div className="form-field">
            <label>Phone</label>
            <input value={signupForm.phone} onChange={(e) => setSignupForm({ ...signupForm, phone: e.target.value })} />
          </div>
          <div className="form-field">
            <label>Password</label>
            <input type="password" value={signupForm.password} onChange={(e) => setSignupForm({ ...signupForm, password: e.target.value })} required minLength={6} />
          </div>
          <button className="btn btn-primary btn-block" disabled={loading}>{loading ? "Creating account…" : "Create account"}</button>
        </form>
      )}

      <div style={{ marginTop: 18, fontSize: 12.5, textAlign: "center", color: "var(--ink-soft)" }}>
        Railway staff? <Link to="/admin-login">Go to the Admin portal</Link>
      </div>
    </div>
  );
}
