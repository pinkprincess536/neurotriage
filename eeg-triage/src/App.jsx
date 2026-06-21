import { useState, useCallback } from "react";
import Login from "./components/Login";
import PatientManager from "./components/PatientManager";
import FileUpload from "./components/FileUpload";
import ThresholdSlider from "./components/ThresholdSlider";
import ResultsTable from "./components/ResultsTable";
import "./App.css";

import { BACKEND_URL } from "./config";

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem("doctor_token"));
  const [role, setRole] = useState(() => localStorage.getItem("doctor_role"));
  const [patientId, setPatientId] = useState(null);

  const [file, setFile] = useState(null);
  const [threshold, setThreshold] = useState(0.7);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [models, setModels] = useState(null);
  const [activating, setActivating] = useState(null);
  const [retraining, setRetraining] = useState(false);
  const [retrainResult, setRetrainResult] = useState(null);
  const [retrainError, setRetrainError] = useState(null);

  const fetchModels = useCallback(async (authToken) => {
    try {
      const res = await fetch(`${BACKEND_URL}/models`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) {
        setModels(await res.json());
      }
    } catch {}
  }, []);

  const handleLogin = (userToken, userRole) => {
    localStorage.setItem("doctor_token", userToken);
    localStorage.setItem("doctor_role", userRole);
    setToken(userToken);
    setRole(userRole);
    if (userRole === "admin") {
      fetchModels(userToken);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("doctor_token");
    localStorage.removeItem("doctor_role");
    setToken(null);
    setRole(null);
    setPatientId(null);
    setFile(null);
    setResults(null);
    setModels(null);
    setRetrainResult(null);
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

  const handleRetrain = async () => {
    setRetraining(true);
    setRetrainResult(null);
    setRetrainError(null);

    try {
      const response = await fetch(`${BACKEND_URL}/retrain`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || "Retraining failed");
      }

      const data = await response.json();
      setRetrainResult(data);
      fetchModels(token);
    } catch (err) {
      setRetrainError(err.message);
    } finally {
      setRetraining(false);
    }
  };

  const handleActivate = async (version) => {
    setActivating(version);
    try {
      const res = await fetch(`${BACKEND_URL}/models/activate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ version }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Activation failed");
      }
      fetchModels(token);
    } catch (err) {
      alert(err.message);
    } finally {
      setActivating(null);
    }
  };

  if (!token) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>EEG Seizure Triage Assistant</h1>
        <div className="user-info">
          <span className="role-badge">{role}</span>
          <button className="logout-btn" onClick={handleLogout}>Sign Out</button>
        </div>
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

      {role === "admin" && models && (
        <div className="model-section">
          <h2>Model Versions</h2>
          <table>
            <thead>
              <tr>
                <th>Version</th>
                <th>Type</th>
                <th>Date</th>
                <th>Samples</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {models.versions.map((v) => (
                <tr key={v.version}>
                  <td>{v.version}</td>
                  <td>{v.type}</td>
                  <td>{v.created_at ? new Date(v.created_at).toLocaleDateString() : "\u2014"}</td>
                  <td>{v.training_samples ?? "\u2014"}</td>
                  <td>
                    {v.version === models.active_version
                      ? <span className="badge-active">Active</span>
                      : <span className="badge-inactive">Inactive</span>}
                  </td>
                  <td>
                    {v.version !== models.active_version && (
                      <button
                        className="activate-btn"
                        onClick={() => handleActivate(v.version)}
                        disabled={activating === v.version}
                      >
                        {activating === v.version ? "Activating..." : "Activate"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {role === "admin" && (
        <div className="retrain-section">
          <h2>Model Retraining</h2>
          <p className="retrain-desc">
            Fine-tune the model using doctor feedback. New versions are saved but not activated until you choose.
          </p>
          <button
            className="retrain-btn"
            onClick={handleRetrain}
            disabled={retraining}
          >
            {retraining ? "Retraining..." : "Retrain Model"}
          </button>

          {retrainError && <div className="error">{retrainError}</div>}

          {retrainResult && (
            <div className="retrain-results">
              <p><strong>{retrainResult.new_version}</strong> saved (not yet active)</p>
              <p>{retrainResult.training_samples} samples ({retrainResult.seizure_samples} seizure, {retrainResult.normal_samples} normal)</p>
              <table>
                <thead>
                  <tr>
                    <th>Epoch</th>
                    <th>Loss</th>
                    <th>Accuracy</th>
                  </tr>
                </thead>
                <tbody>
                  {retrainResult.history.map((h) => (
                    <tr key={h.epoch}>
                      <td>{h.epoch}</td>
                      <td>{h.loss}</td>
                      <td>{(h.accuracy * 100).toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
