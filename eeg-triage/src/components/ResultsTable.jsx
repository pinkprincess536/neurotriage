import { useState } from "react";

export default function ResultsTable({ data }) {
  const [feedback, setFeedback] = useState({});

  const handleFeedback = async (r, label) => {
  const labelValue = label === "yes" ? "seizure" : "normal";

  setFeedback(prev => ({ ...prev, [r.rank]: label }));

  try {
    await fetch("http://localhost:8000/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recording_id: data.recording_id,
        timestamp_sec: r.timestamp_sec,
        score: r.score,
        label: labelValue,
      }),
    });
  } catch (err) {
    console.error("Feedback save failed:", err);
  }
};

  const tierLabel = (tier) => (tier === "urgent" ? "🔴 Urgent" : "🟡 Review");

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
              <td>
                {feedback[r.rank] ? (
                  <span>{feedback[r.rank] === "yes" ? "✓ Seizure" : "✗ Not seizure"}</span>
                ) : (
                  <>
                    <button onClick={() => handleFeedback(r, "yes")}>✓</button>
                    <button onClick={() => handleFeedback(r, "no")}>✗</button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
