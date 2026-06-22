import { useState } from "react";
import { BACKEND_URL } from "../config";
import BrainMascot from "./BrainMascot";

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
        throw new Error(err.detail || "Wrong password");
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
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-3xl border border-slate-100 shadow-xl w-full max-w-4xl flex overflow-hidden" style={{ minHeight: "580px" }}>

        {/* Left panel — branding + mascot */}
        <div className="flex-1 bg-gradient-to-br from-rose-500 to-rose-600 flex flex-col items-center justify-center px-12 py-14 gap-8">
          <div className="text-center">
            <h1 className="text-5xl font-extrabold tracking-tight text-white leading-tight">
              Neuro<span className="text-rose-200 font-medium">Triage</span>
            </h1>
            <p className="text-rose-100 mt-3 text-base font-medium">Smart Seizure Triage &amp; Detection Portal</p>
          </div>

          <BrainMascot mood={loading ? "thinking" : "idle"} bubbleText={loading ? "Checking credentials..." : "Welcome back!"} />

          <div className="space-y-2 text-center">
            <div className="flex items-center gap-2 text-rose-100 text-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-200 shrink-0" />
              1D CNN · 22-channel bipolar EEG
            </div>
            <div className="flex items-center gap-2 text-rose-100 text-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-200 shrink-0" />
              Threshold-based seizure triage
            </div>
            <div className="flex items-center gap-2 text-rose-100 text-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-200 shrink-0" />
              Doctor feedback → retraining loop
            </div>
          </div>
        </div>

        {/* Right panel — form */}
        <div className="w-96 flex flex-col justify-center px-12 py-14">
          <h2 className="text-2xl font-extrabold text-slate-800 mb-1">Sign in</h2>
          <p className="text-sm text-slate-500 mb-8">Enter your access password to continue.</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Access Password
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400">
                  <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 8a6 6 0 01-7.743 5.743L10 14l-1 1-1 1H6v2H2v-4l4.257-4.257A6 6 0 1118 8zm-6-4a1 1 0 100 2 2 2 0 012 2 1 1 0 102 0 4 4 0 00-4-4z" />
                  </svg>
                </span>
                <input
                  type="password"
                  required
                  className="block w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 placeholder-slate-400 text-sm focus:outline-none focus:border-rose-500 focus:bg-white focus:ring-4 focus:ring-rose-500/10 transition-all duration-200"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoFocus
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-1.5">
                Your role is determined automatically by your password.
              </p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-4 py-3 rounded-2xl">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !password}
              className="w-full py-3.5 rounded-2xl text-sm font-semibold text-white shadow-md flex items-center justify-center gap-2 transition-all duration-200 bg-rose-500 hover:bg-rose-600 focus:ring-4 focus:ring-rose-500/20 active:translate-y-0.5 disabled:opacity-50 disabled:pointer-events-none"
            >
              {loading ? (
                <span className="inline-block animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
              ) : (
                <>
                  Enter Platform
                  <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" />
                  </svg>
                </>
              )}
            </button>
          </form>

          <p className="text-center text-xs text-slate-400 mt-8">
            NeuroTriage · EEGCNN1D · CHB-MIT Dataset
          </p>
        </div>

      </div>
    </div>
  );
}
