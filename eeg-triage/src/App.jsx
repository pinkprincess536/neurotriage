import { useState } from "react";
import FileUpload from "./components/FileUpload";
import ThresholdSlider from "./components/ThresholdSlider";
import ResultsTable from "./components/ResultsTable";
import "./App.css";

const BACKEND_URL = "http://localhost:8000";

export default function App() {
  const [file, setFile] = useState(null);
  const [threshold, setThreshold] = useState(0.7);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleProcess = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    setResults(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(
        `${BACKEND_URL}/predict?threshold=${threshold}`,
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

  return (
    <div className="app">
      <h1>EEG Seizure Triage Assistant</h1>

      <FileUpload file={file} onFileSelect={setFile} />

      <ThresholdSlider threshold={threshold} onChange={setThreshold} />

      <button
        className="process-btn"
        onClick={handleProcess}
        disabled={!file || loading}
      >
        {loading ? "Processing..." : "Process Recording"}
      </button>

      {error && <div className="error">{error}</div>}

      {results && <ResultsTable data={results} />}
    </div>
  );
}
