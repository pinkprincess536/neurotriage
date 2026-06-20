import { useState, useEffect, useRef } from "react";

const BACKEND_URL = "http://localhost:8000";

export default function PatientManager({ patientId, onSelect }) {
  const [patients, setPatients] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [loading, setLoading] = useState(true);
  const inputRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/patients`);
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
  }, []);

  useEffect(() => {
    if (showAdd) inputRef.current?.focus();
  }, [showAdd]);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    setAdding(true);
    try {
      const res = await fetch(`${BACKEND_URL}/patients`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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

  return (
    <div className="patient-manager">
      <label className="patient-label">Patient</label>
      <div className="patient-row">
        <select
          className="patient-select"
          value={patientId ?? ""}
          onChange={(e) => {
            const id = parseInt(e.target.value, 10);
            if (id) onSelect(id);
          }}
          disabled={loading}
        >
          <option value="" disabled>
            {loading ? "Loading..." : "Select a patient"}
          </option>
          {patients.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <button
          className="add-patient-btn"
          type="button"
          onClick={() => setShowAdd((v) => !v)}
        >
          ＋ New
        </button>
      </div>
      {showAdd && (
        <div className="add-patient-row">
          <input
            ref={inputRef}
            className="add-patient-input"
            type="text"
            placeholder="Patient name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
          />
          <button
            className="add-patient-confirm"
            type="button"
            onClick={handleAdd}
            disabled={adding || !newName.trim()}
          >
            {adding ? "..." : "Add"}
          </button>
        </div>
      )}
    </div>
  );
}
