import { useState, useRef, useEffect, useCallback } from "react";
import { BACKEND_URL } from "../config";
import FileUpload from "./FileUpload";
import ThresholdSlider from "./ThresholdSlider";
import ResultsTable from "./ResultsTable";

export default function DoctorDashboard({ token, onLogout }) {
  const [patients, setPatients] = useState([]);
  const [loadingPatients, setLoadingPatients] = useState(true);
  const [selectedPatientId, setSelectedPatientId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [newPatientName, setNewPatientName] = useState("");
  const [adding, setAdding] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  // Recordings history
  const [recordings, setRecordings] = useState([]);
  const [loadingRecordings, setLoadingRecordings] = useState(false);
  const [selectedRecording, setSelectedRecording] = useState(null);
  const [recordingWindows, setRecordingWindows] = useState([]);
  const [loadingWindows, setLoadingWindows] = useState(false);

  // Upload / process
  const [file, setFile] = useState(null);
  const [threshold, setThreshold] = useState(0.70);
  const [results, setResults] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [processError, setProcessError] = useState(null);

  const addInputRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/patients`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setPatients(data.patients);
          if (data.patients.length > 0) setSelectedPatientId(data.patients[0].id);
        }
      } catch (e) { console.error(e); }
      finally { setLoadingPatients(false); }
    })();
  }, [token]);

  useEffect(() => {
    if (showAddForm) addInputRef.current?.focus();
  }, [showAddForm]);

  // Load recordings whenever patient changes
  const loadRecordings = useCallback(async (patientId) => {
    if (!patientId) return;
    setLoadingRecordings(true);
    try {
      const res = await fetch(`${BACKEND_URL}/patients/${patientId}/recordings`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setRecordings(data.recordings);
      }
    } catch (e) { console.error(e); }
    finally { setLoadingRecordings(false); }
  }, [token]);

  useEffect(() => {
    setRecordings([]);
    setResults(null);
    setFile(null);
    setProcessError(null);
    setSelectedRecording(null);
    setRecordingWindows([]);
    loadRecordings(selectedPatientId);
  }, [selectedPatientId, loadRecordings]);

  const handleRecordingClick = async (rec) => {
    if (selectedRecording?.id === rec.id) {
      setSelectedRecording(null);
      setRecordingWindows([]);
      return;
    }
    setSelectedRecording(rec);
    setLoadingWindows(true);
    try {
      const res = await fetch(`${BACKEND_URL}/recordings/${rec.id}/windows`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setRecordingWindows(data.windows);
      }
    } catch (e) { console.error(e); }
    finally { setLoadingWindows(false); }
  };

  const handleHistoryFeedback = async (window_, label) => {
    try {
      const res = await fetch(`${BACKEND_URL}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          recording_id: window_.recording_id || selectedRecording.id,
          timestamp_sec: window_.timestamp_sec,
          score: window_.model_score,
          label,
        }),
      });
      if (!res.ok) throw new Error("failed");
      // Update label locally
      setRecordingWindows((prev) =>
        prev.map((w) =>
          w.id === window_.id ? { ...w, doctor_label: label } : w
        )
      );
    } catch (e) { console.error(e); }
  };

  const currentPatient = patients.find((p) => p.id === selectedPatientId) || null;

  const handleAddPatient = async () => {
    if (!newPatientName.trim()) return;
    setAdding(true);
    try {
      const res = await fetch(`${BACKEND_URL}/patients`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: newPatientName.trim() }),
      });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setPatients((prev) => [data.patient, ...prev]);
      setSelectedPatientId(data.patient.id);
      setNewPatientName("");
      setShowAddForm(false);
    } catch (e) { console.error(e); }
    finally { setAdding(false); }
  };

  const handleDeletePatient = async (patientId, e) => {
    e.stopPropagation();
    if (!window.confirm("Delete this patient and all their recordings? This cannot be undone.")) return;
    setDeletingId(patientId);
    try {
      const res = await fetch(`${BACKEND_URL}/patients/${patientId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to delete");
      setPatients((prev) => prev.filter((p) => p.id !== patientId));
      if (selectedPatientId === patientId) {
        const remaining = patients.filter((p) => p.id !== patientId);
        setSelectedPatientId(remaining.length > 0 ? remaining[0].id : null);
      }
    } catch (e) { console.error(e); }
    finally { setDeletingId(null); }
  };

  const handleProcess = async () => {
    if (!file || !selectedPatientId) return;
    setProcessing(true);
    setProcessError(null);
    setResults(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(
        `${BACKEND_URL}/patients/${selectedPatientId}/upload?threshold=${threshold}`,
        { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: formData }
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Prediction failed");
      }
      const data = await res.json();
      setResults(data);
      // Refresh recordings list so new one appears in history
      loadRecordings(selectedPatientId);
      // Update recording count on patient card
      setPatients((prev) =>
        prev.map((p) =>
          p.id === selectedPatientId
            ? { ...p, recording_count: (p.recording_count ?? 0) + 1 }
            : p
        )
      );
    } catch (err) {
      setProcessError(err.message);
    } finally {
      setProcessing(false);
    }
  };

  const filteredPatients = patients.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const initials = (name) =>
    name.split(" ").slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");

  const fmtDuration = (sec) => {
    if (!sec) return "—";
    const m = Math.floor(sec / 60);
    const h = Math.floor(m / 60);
    return h > 0 ? `${h}h ${m % 60}m` : `${m}m`;
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans">

      {/* Header */}
      <header className="bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between sticky top-0 z-20 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-rose-500 p-2.5 rounded-2xl text-white shadow-md">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" className="animate-pulse">
              <path d="M12 3C9 3 7 5 7 7.5c0 .7.2 1.4.6 1.9C6.6 9.8 6 10.8 6 12c0 .8.3 1.5.8 2C6.3 14.5 6 15.2 6 16c0 1.7 1.3 3 3 3h6c1.7 0 3-1.3 3-3 0-.8-.3-1.5-.8-2 .5-.5.8-1.2.8-2 0-1.2-.6-2.2-1.6-2.6.4-.5.6-1.2.6-1.9C17 5 15 3 12 3z"/>
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black tracking-tight text-slate-800">NeuroTriage</h1>
              <span className="bg-rose-100 text-rose-700 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">Clinician Portal</span>
            </div>
            <p className="text-xs text-slate-500">Subject triage, model verification, &amp; feedback loop</p>
          </div>
        </div>
        <button onClick={onLogout} className="bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold px-4 py-2 rounded-xl transition">Log Out</button>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row">

        {/* Sidebar */}
        <div className="w-full lg:w-80 bg-white border-r border-slate-100 p-5 flex flex-col gap-4 shrink-0">

          <div className="flex justify-between items-center">
            <div className="flex items-center gap-1.5 text-slate-700 font-bold text-sm">
              <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" className="text-rose-500">
                <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
              </svg>
              Patients ({patients.length})
            </div>
            <button onClick={() => setShowAddForm((v) => !v)}
              className="bg-rose-50 hover:bg-rose-100 text-rose-600 p-1.5 rounded-lg transition inline-flex items-center gap-1">
              <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                <path d="M8 9a3 3 0 100-6 3 3 0 000 6zM8 11a6 6 0 016 6H2a6 6 0 016-6zM16 7a1 1 0 10-2 0v1h-1a1 1 0 100 2h1v1a1 1 0 102 0v-1h1a1 1 0 100-2h-1V7z" />
              </svg>
              <span className="text-xs font-bold">New</span>
            </button>
          </div>

          {showAddForm && (
            <div className="flex gap-2">
              <input ref={addInputRef} type="text"
                className="flex-1 pl-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs placeholder-slate-400 focus:outline-none focus:border-rose-500"
                placeholder="Patient name..."
                value={newPatientName}
                onChange={(e) => setNewPatientName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleAddPatient(); }}
              />
              <button onClick={handleAddPatient} disabled={adding || !newPatientName.trim()}
                className="bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold px-3 py-2 rounded-xl transition disabled:opacity-40">
                {adding ? "..." : "Add"}
              </button>
            </div>
          )}

          <div className="relative">
            <input type="text"
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs placeholder-slate-400 focus:outline-none focus:border-rose-500"
              placeholder="Search patient..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" />
              </svg>
            </span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-1.5 max-h-[calc(100vh-300px)]">
            {loadingPatients ? (
              <p className="text-xs text-slate-400 text-center py-6">Loading...</p>
            ) : filteredPatients.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">No patients found.</p>
            ) : filteredPatients.map((patient) => {
              const isSelected = patient.id === selectedPatientId;
              return (
                <div key={patient.id} className={`group flex items-center gap-2 p-3 rounded-xl border cursor-pointer transition ${
                  isSelected ? "bg-rose-50/50 border-rose-200" : "border-transparent bg-slate-50 hover:bg-slate-100"
                }`} onClick={() => setSelectedPatientId(patient.id)}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-black shrink-0 ${
                    isSelected ? "bg-rose-500 text-white" : "bg-slate-200 text-slate-600"
                  }`}>{initials(patient.name)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold truncate text-slate-800">{patient.name}</p>
                    <p className="text-[10px] text-slate-500">{patient.recording_count ?? 0} recording{patient.recording_count !== 1 ? "s" : ""}</p>
                  </div>
                  <button
                    onClick={(e) => handleDeletePatient(patient.id, e)}
                    disabled={deletingId === patient.id}
                    className="opacity-0 group-hover:opacity-100 transition p-1 rounded-lg hover:bg-red-50 text-red-400 hover:text-red-600 shrink-0"
                    title="Delete patient"
                  >
                    {deletingId === patient.id ? (
                      <span className="inline-block w-3 h-3 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <svg width="13" height="13" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" />
                      </svg>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right workspace */}
        <div className="flex-1 bg-slate-50/50 p-6 flex flex-col gap-6 overflow-y-auto max-h-[calc(100vh-80px)]">

          {!currentPatient ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-slate-400">
                    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-slate-600">Select a patient to begin triage</p>
                <p className="text-xs text-slate-400 mt-1">Or add a new patient from the sidebar</p>
              </div>
            </div>
          ) : (
            <>
              {/* Patient header */}
              <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm flex justify-between items-start gap-4">
                <div>
                  <span className="text-xs font-black bg-rose-50 text-rose-600 px-3 py-1 rounded-lg uppercase tracking-wide">Active Case</span>
                  <h2 className="text-2xl font-black text-slate-800 tracking-tight mt-2">{currentPatient.name}</h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Created {new Date(currentPatient.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex gap-6 border-l border-slate-100 pl-6 shrink-0">
                  <div className="text-center">
                    <span className="block text-[10px] font-bold text-slate-400 uppercase">Recordings</span>
                    <span className="text-2xl font-black text-slate-700">{currentPatient.recording_count ?? 0}</span>
                  </div>
                </div>
              </div>

              {/* Upload section */}
              <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm space-y-4">
                <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide flex items-center gap-2">
                  <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" className="text-rose-500">
                    <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" />
                  </svg>
                  Upload New EEG Recording
                </h3>
                <FileUpload file={file} onFileSelect={setFile} />
                <ThresholdSlider threshold={threshold} onChange={setThreshold} />
                <button onClick={handleProcess} disabled={!file || processing}
                  className="w-full py-3.5 rounded-2xl text-sm font-semibold text-white bg-rose-500 hover:bg-rose-600 shadow-md flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:pointer-events-none">
                  {processing ? (
                    <span className="inline-block animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  ) : (
                    <>
                      <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" />
                      </svg>
                      Process Recording
                    </>
                  )}
                </button>
                {processError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-4 py-3 rounded-2xl">{processError}</div>
                )}
              </div>

              {/* Latest results */}
              {results && (
                <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm">
                  <ResultsTable token={token} data={results} />
                </div>
              )}

              {/* Recording history */}
              <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm">
                <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide flex items-center gap-2 mb-4">
                  <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" className="text-violet-500">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" />
                  </svg>
                  Recording History
                  {recordings.length > 0 && (
                    <span className="ml-1 bg-violet-100 text-violet-700 text-[10px] font-bold px-2 py-0.5 rounded-full">{recordings.length}</span>
                  )}
                </h3>

                {loadingRecordings ? (
                  <p className="text-xs text-slate-400 text-center py-6">Loading history...</p>
                ) : recordings.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-xs text-slate-400">No recordings yet for this patient.</p>
                    <p className="text-xs text-slate-400 mt-1">Upload an EDF file above to get started.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {recordings.map((rec) => {
                      const isExpanded = selectedRecording?.id === rec.id;
                      return (
                        <div key={rec.id} className="border border-slate-100 rounded-2xl overflow-hidden">
                          {/* Recording row — clickable */}
                          <button
                            type="button"
                            onClick={() => handleRecordingClick(rec)}
                            className={`w-full flex items-center justify-between px-4 py-3 text-left transition ${
                              isExpanded ? "bg-violet-50" : "bg-slate-50 hover:bg-slate-100"
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className={`p-2 rounded-lg shrink-0 ${isExpanded ? "bg-violet-100 text-violet-600" : "bg-slate-200 text-slate-500"}`}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14,2 14,8 20,8"/>
                                </svg>
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-slate-800 truncate">{rec.filename}</p>
                                <p className="text-[10px] text-slate-500 font-mono">
                                  {new Date(rec.created_at).toLocaleDateString()} · {fmtDuration(rec.duration_sec)} · threshold {rec.threshold_used?.toFixed(2)}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                rec.flagged_windows > 0 ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"
                              }`}>
                                {rec.flagged_windows ?? 0} flagged
                              </span>
                              <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor"
                                className={`text-slate-400 transition-transform ${isExpanded ? "rotate-90" : ""}`}>
                                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"/>
                              </svg>
                            </div>
                          </button>

                          {/* Expanded windows panel */}
                          {isExpanded && (
                            <div className="border-t border-slate-100 px-4 py-4 bg-white">
                              {loadingWindows ? (
                                <p className="text-xs text-slate-400 text-center py-4">Loading windows...</p>
                              ) : recordingWindows.length === 0 ? (
                                <p className="text-xs text-slate-400 text-center py-4">No flagged windows for this recording.</p>
                              ) : (
                                <div className="space-y-2">
                                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">
                                    Flagged Windows — click to label
                                  </p>
                                  {recordingWindows.map((w) => {
                                    const mins = Math.floor(w.timestamp_sec / 60);
                                    const secs = Math.floor(w.timestamp_sec % 60);
                                    const ts = `${String(mins).padStart(2,"0")}:${String(secs).padStart(2,"0")}`;
                                    const label = w.doctor_label;
                                    return (
                                      <div key={w.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                                        <div className="flex items-center gap-3">
                                          <span className="font-mono text-xs font-bold text-slate-700">{ts}</span>
                                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                            w.model_score >= 0.95 ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"
                                          }`}>
                                            {w.model_score >= 0.95 ? "🔴 Urgent" : "🟡 Review"} · {w.model_score?.toFixed(3)}
                                          </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          {label === "seizure" ? (
                                            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-200">
                                              ✓ Seizure
                                            </span>
                                          ) : label === "normal" ? (
                                            <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-lg border border-slate-200">
                                              ✗ Not seizure
                                            </span>
                                          ) : (
                                            <>
                                              <button
                                                onClick={() => handleHistoryFeedback(w, "seizure")}
                                                className="text-[10px] font-bold px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition"
                                              >
                                                ✓ Seizure
                                              </button>
                                              <button
                                                onClick={() => handleHistoryFeedback(w, "normal")}
                                                className="text-[10px] font-bold px-2.5 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 transition"
                                              >
                                                ✗ Not seizure
                                              </button>
                                            </>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>                {loadingRecordings ? (
                  <p className="text-xs text-slate-400 text-center py-6">Loading history...</p>
                ) : recordings.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-xs text-slate-400">No recordings yet for this patient.</p>
                    <p className="text-xs text-slate-400 mt-1">Upload an EDF file above to get started.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-slate-100 rounded-2xl">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold uppercase text-[9px] tracking-wider">
                          <th className="py-3 px-4">File</th>
                          <th className="py-3 px-4">Date</th>
                          <th className="py-3 px-4">Duration</th>
                          <th className="py-3 px-4">Flagged</th>
                          <th className="py-3 px-4">Threshold</th>
                          <th className="py-3 px-4">Model</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {recordings.map((rec) => (
                          <tr key={rec.id} className="hover:bg-slate-50/50 transition text-slate-600">
                            <td className="py-3.5 px-4 font-mono font-medium text-slate-800 max-w-[160px] truncate">{rec.filename}</td>
                            <td className="py-3.5 px-4 font-mono text-[10px]">
                              {new Date(rec.created_at).toLocaleDateString()}{" "}
                              <span className="text-slate-400">{new Date(rec.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                            </td>
                            <td className="py-3.5 px-4 font-mono">{fmtDuration(rec.duration_sec)}</td>
                            <td className="py-3.5 px-4">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                rec.flagged_windows > 0 ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"
                              }`}>
                                {rec.flagged_windows ?? 0} / {rec.total_windows ?? "—"}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 font-mono">{rec.threshold_used?.toFixed(2) ?? "—"}</td>
                            <td className="py-3.5 px-4">
                              <span className="bg-violet-50 text-violet-700 text-[9px] font-bold px-2 py-0.5 rounded-full">
                                {rec.model_version ?? "—"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
