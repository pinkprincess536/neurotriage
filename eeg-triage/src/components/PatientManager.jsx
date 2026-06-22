import { useState, useEffect, useRef } from "react";
import { BACKEND_URL } from "../config";

export default function PatientManager({ token, patientId, onSelect }) {
  const [patients, setPatients] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [loading, setLoading] = useState(true);
  const inputRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/patients`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setPatients(data.patients);
        }
      } catch (e) {
        console.error("Failed to load patients", e);
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  useEffect(() => {
    if (showAdd) inputRef.current?.focus();
  }, [showAdd]);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    setAdding(true);
    try {
      const res = await fetch(`${BACKEND_URL}/patients`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: newName.trim() }),
      });
      if (!res.ok) throw new Error("Failed to add patient");
      const data = await res.json();
      setPatients((prev) => [data.patient, ...prev]);
      onSelect(data.patient.id);
      setNewName("");
      setShowAdd(false);
    } catch (e) {
      console.error(e);
    } finally {
      setAdding(false);
    }
  };

  const initials = (name) =>
    name.split(" ").slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");

  return (
    <div className="nt-patient-panel">
      {/* Header */}
      <div className="nt-patient-header">
        <div className="nt-patient-title">
          <svg viewBox="0 0 20 20" fill="currentColor" width="15" height="15" style={{ color: "var(--accent)" }}>
            <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
          </svg>
          Patients
          <span className="nt-patient-count">{patients.length}</span>
        </div>
        <button
          type="button"
          className="nt-add-btn"
          onClick={() => setShowAdd((v) => !v)}
        >
          <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
            <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" />
          </svg>
          New
        </button>
      </div>

      {/* Add patient inline form */}
      {showAdd && (
        <div className="nt-add-row">
          <input
            ref={inputRef}
            className="nt-add-input"
            type="text"
            placeholder="Patient name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
          />
          <button
            className="nt-add-confirm"
            type="button"
            onClick={handleAdd}
            disabled={adding || !newName.trim()}
          >
            {adding ? "..." : "Add"}
          </button>
        </div>
      )}

      {/* Patient card list */}
      <div className="nt-patient-list">
        {loading ? (
          <div className="nt-patient-empty">Loading patients…</div>
        ) : patients.length === 0 ? (
          <div className="nt-patient-empty">No patients yet. Add one above.</div>
        ) : (
          patients.map((p) => {
            const isSelected = p.id === patientId;
            return (
              <button
                key={p.id}
                type="button"
                className={`nt-patient-card ${isSelected ? "selected" : ""}`}
                onClick={() => onSelect(p.id)}
              >
                <div className="nt-patient-avatar">{initials(p.name)}</div>
                <div className="nt-patient-info">
                  <span className="nt-patient-name">{p.name}</span>
                  <span className="nt-patient-meta">
                    {p.recording_count != null
                      ? `${p.recording_count} recording${p.recording_count !== 1 ? "s" : ""}`
                      : "No recordings yet"}
                  </span>
                </div>
                {isSelected && (
                  <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14" className="nt-patient-check">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" />
                  </svg>
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
