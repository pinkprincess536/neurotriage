import { useState } from "react";
import { BACKEND_URL } from "../config";

export default function ResultsTable({ token, data }) {
  const [feedback, setFeedback] = useState({});

  const submitFeedback = async (r, choice) => {
    const labelValue = choice === "yes" ? "seizure" : "normal";
    setFeedback((prev) => ({ ...prev, [r.rank]: { choice, status: "saving" } }));
    try {
      const res = await fetch(`${BACKEND_URL}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          recording_id: data.recording_id,
          timestamp_sec: r.timestamp_sec,
          score: r.score,
          label: labelValue,
        }),
      });
      if (!res.ok) throw new Error("save failed");
      setFeedback((prev) => ({ ...prev, [r.rank]: { choice, status: "saved" } }));
    } catch {
      setFeedback((prev) => ({ ...prev, [r.rank]: { choice, status: "error" } }));
    }
  };

  const clearFeedback = (rank) => {
    setFeedback((prev) => { const n = { ...prev }; delete n[rank]; return n; });
  };

  const tierBadge = (tier) =>
    tier === "urgent"
      ? <span className="bg-rose-100 text-rose-700 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase">🔴 Urgent</span>
      : <span className="bg-amber-100 text-amber-700 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase">🟡 Review</span>;

  const renderAction = (r) => {
    const fb = feedback[r.rank];
    if (!fb) {
      return (
        <div className="flex gap-1.5">
          <button
            onClick={() => submitFeedback(r, "yes")}
            className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2.5 py-1.5 rounded-lg transition border border-emerald-200"
          >
            ✓ Seizure
          </button>
          <button
            onClick={() => submitFeedback(r, "no")}
            className="bg-slate-50 hover:bg-slate-100 text-slate-600 text-[10px] font-bold px-2.5 py-1.5 rounded-lg transition border border-slate-200"
          >
            ✗ Not seizure
          </button>
        </div>
      );
    }
    if (fb.status === "saving") return <span className="text-[10px] text-slate-400">Saving…</span>;
    if (fb.status === "error") return (
      <div className="flex gap-1.5 items-center">
        <span className="text-[10px] text-rose-600">⚠ Failed</span>
        <button onClick={() => submitFeedback(r, fb.choice)} className="text-[10px] text-violet-600 hover:underline">Retry</button>
        <button onClick={() => clearFeedback(r.rank)} className="text-[10px] text-slate-400 hover:underline">Cancel</button>
      </div>
    );
    return (
      <div className="flex items-center gap-1.5">
        <span className={`text-[10px] font-bold ${fb.choice === "yes" ? "text-emerald-600" : "text-slate-500"}`}>
          {fb.choice === "yes" ? "✓ Confirmed seizure" : "✗ Not a seizure"}
        </span>
        <button onClick={() => clearFeedback(r.rank)} className="text-[10px] text-slate-400 hover:underline">change</button>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-800">Triage Results</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {data.flagged_windows} / {data.total_windows} windows flagged
            {data.recording_duration_sec ? ` · ${(data.recording_duration_sec / 60).toFixed(0)} min recording` : ""}
            {" · "}est. {data.estimated_per_hour} flagged/hr
          </p>
        </div>
        <span className={`text-xs font-bold px-3 py-1 rounded-full ${
          data.flagged_windows === 0
            ? "bg-emerald-50 text-emerald-700"
            : data.flagged_windows > 5
            ? "bg-rose-50 text-rose-700"
            : "bg-amber-50 text-amber-700"
        }`}>
          {data.flagged_windows === 0 ? "No flags" : data.flagged_windows > 5 ? "High activity" : "Needs review"}
        </span>
      </div>

      {data.results.length === 0 ? (
        <div className="text-center py-8 text-slate-400 text-sm">
          No windows flagged above threshold {data.threshold.toFixed(2)}.
        </div>
      ) : (
        <div className="overflow-x-auto border border-slate-100 rounded-2xl">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold uppercase text-[9px] tracking-wider">
                <th className="py-3 px-4">#</th>
                <th className="py-3 px-4">Time</th>
                <th className="py-3 px-4">Score</th>
                <th className="py-3 px-4">Tier</th>
                <th className="py-3 px-4">Feedback</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {data.results.map((r) => (
                <tr key={r.rank} className="hover:bg-slate-50/50 transition text-slate-600">
                  <td className="py-3.5 px-4 font-mono font-bold text-slate-800">{r.rank}</td>
                  <td className="py-3.5 px-4 font-mono">{r.timestamp_str}</td>
                  <td className="py-3.5 px-4">
                    <span className={`font-mono font-bold ${r.score >= 0.95 ? "text-rose-600" : r.score >= 0.70 ? "text-amber-600" : "text-slate-600"}`}>
                      {r.score.toFixed(3)}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">{tierBadge(r.tier)}</td>
                  <td className="py-3.5 px-4">{renderAction(r)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
