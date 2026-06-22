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
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          recording_id: data.recording_id,
          timestamp_sec: r.timestamp_sec,
          score: r.score,
          label: labelValue,
        }),
      });
      if (!res.ok) throw new Error("save failed");
      setFeedback((prev) => ({ ...prev, [r.rank]: { choice, status: "saved" } }));
    } catch (err) {
      console.error("Feedback save failed:", err);
      setFeedback((prev) => ({ ...prev, [r.rank]: { choice, status: "error" } }));
    }
  };

  const clearFeedback = (rank) => {
    setFeedback((prev) => {
      const next = { ...prev };
      delete next[rank];
      return next;
    });
  };

  const tierLabel = (tier) => (tier === "urgent" ? "🔴 Urgent" : "🟡 Review");

  const renderAction = (r) => {
    const fb = feedback[r.rank];

    if (!fb) {
      return (
        <>
          <button onClick={() => submitFeedback(r, "yes")}>✓</button>
          <button onClick={() => submitFeedback(r, "no")}>✗</button>
        </>
      );
    }

    const labelText = fb.choice === "yes" ? "✓ Seizure" : "✗ Not seizure";

    if (fb.status === "saving") {
      return <span className="fb-saving">Saving…</span>;
    }

    if (fb.status === "error") {
      return (
        <span className="fb-error">
          ⚠ Failed{" "}
          <button onClick={() => submitFeedback(r, fb.choice)}>Retry</button>
          <button onClick={() => clearFeedback(r.rank)}>Cancel</button>
        </span>
      );
    }

    return (
      <span className="fb-saved">
        {labelText}{" "}
        <button className="fb-change" onClick={() => clearFeedback(r.rank)}>
          change
        </button>
      </span>
    );
  };

  return (
    <div className="results">
      <p className="results-summary">
        {data.flagged_windows} / {data.total_windows} windows flagged
        {data.recording_duration_sec
          ? " (" + (data.recording_duration_sec / 60).toFixed(0) + " min"
          : ""}
        , est. {data.estimated_per_hour} flagged/hour
      </p>

      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Time</th>
            <th>Score</th>
            <th>Tier</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {data.results.map((r) => (
            <tr key={r.rank}>
              <td>{r.rank}</td>
              <td>{r.timestamp_str}</td>
              <td>{r.score.toFixed(3)}</td>
              <td>{tierLabel(r.tier)}</td>
              <td>{renderAction(r)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
