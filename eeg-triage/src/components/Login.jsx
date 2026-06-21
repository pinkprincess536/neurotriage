import { useState } from "react";

const BACKEND_URL = "http://localhost:8000";

export default function Login({ onLogin }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!password) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${BACKEND_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Login failed");
      }

      const data = await res.json();
      onLogin(data.token, data.role);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <h1>EEG Seizure Triage</h1>
        <p className="login-subtitle">Doctor Login</p>
        <form className="login-form" onSubmit={handleSubmit}>
          <input
            className="login-input"
            type="password"
            placeholder="Enter password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
          />
          <button className="login-btn" type="submit" disabled={loading}>
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
        {error && <div className="login-error">{error}</div>}
      </div>
    </div>
  );
}
