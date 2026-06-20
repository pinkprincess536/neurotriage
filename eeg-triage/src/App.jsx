import { useState } from "react";
import Login from "./components/Login";
import PatientManager from "./components/PatientManager";
import FileUpload from "./components/FileUpload";
import ThresholdSlider from "./components/ThresholdSlider";
import ResultsTable from "./components/ResultsTable";
import "./App.css";

const BACKEND_URL = "http://localhost:8000";

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem("doctor_token"));
  const [patientId, setPatientId] = useState(null);
  const [file, setFile] = useState(null);
  const [threshold, setThreshold] = useState(0.7);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleLogin = (userToken) => {
    localStorage.setItem("doctor_token", userToken);
    setToken(userToken);
  };

  const handleLogout = () => {
    localStorage.removeItem("doctor_token");
    setToken(null);
    setPatientId(null);
    setFile(null);
    setResults(null);
    setError(null);
  };

  const handleProcess = async () => {
    if (!file || !patientId) return;
    setLoading(true);
    setError(null);
    setResults(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(
        `${BACKEND_URL}/patients/${patientId}/upload?threshold=${threshold}`,
        { method: "POST", body: formData }
      );

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || "Prediction failed");
      }

      const data = await response.json();
      setResults(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>EEG Seizure Triage Assistant</h1>
        <button className="logout-btn" onClick={handleLogout}>
          Sign Out
        </button>
      </header>

      <div className="dashboard-content">
        <PatientManager patientId={patientId} onSelect={setPatientId} />

        <FileUpload file={file} onFileSelect={setFile} />

        <ThresholdSlider threshold={threshold} onChange={setThreshold} />

        <button
          className="process-btn"
          onClick={handleProcess}
          disabled={!file || !patientId || loading}
        >
          {loading ? "Processing..." : "Process Recording"}
        </button>

        {error && <div className="error">{error}</div>}

        {results && <ResultsTable data={results} />}
      </div>
    </div>
  );
}

