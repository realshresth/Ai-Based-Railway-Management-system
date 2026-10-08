import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/client";

export default function ForgotPassword() {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const navigate = useNavigate();

  async function requestReset(e) {
    e.preventDefault();
    setError(""); setInfo("");
    try {
      const res = await api.post("/auth/forgot-password", { email });
      // No email service is configured in this demo, so the token is
      // returned directly instead of being emailed — see backend/routes/auth.js
      setToken(res.data.resetToken);
      setInfo("A reset token was generated. In production this would be emailed — for this demo it's pre-filled below.");
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.error || "Could not start password reset.");
    }
  }

  async function resetPassword(e) {
    e.preventDefault();
    setError("");
    try {
      await api.post("/auth/reset-password", { token, newPassword });
      setInfo("Password updated — redirecting to login…");
      setTimeout(() => navigate("/login"), 1500);
    } catch (err) {
      setError(err.response?.data?.error || "Could not reset password.");
    }
  }

  return (
    <div className="auth-wrap">
      <h2 style={{ marginBottom: 6 }}>Forgot password</h2>
      {error && <div className="msg-error">{error}</div>}
      {info && <div className="msg-ok">{info}</div>}

      {step === 1 ? (
        <form onSubmit={requestReset}>
          <div className="form-field">
            <label>Account email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <button className="btn btn-primary btn-block">Send reset token</button>
        </form>
      ) : (
        <form onSubmit={resetPassword}>
          <div className="form-field">
            <label>Reset token</label>
            <input value={token} onChange={(e) => setToken(e.target.value)} required />
          </div>
          <div className="form-field">
            <label>New password</label>
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={6} />
          </div>
          <button className="btn btn-primary btn-block">Reset password</button>
        </form>
      )}
    </div>
  );
}
