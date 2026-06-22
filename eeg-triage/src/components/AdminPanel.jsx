import { useState } from "react";
import { BACKEND_URL } from "../config";

const THRESHOLD_SWEEP = [
  { threshold: 0.50, recall: 0.95, falseAlarmRate: 330, savedReviewTimePercent: 68 },
  { threshold: 0.55, recall: 0.93, falseAlarmRate: 280, savedReviewTimePercent: 72 },
  { threshold: 0.60, recall: 0.93, falseAlarmRate: 279, savedReviewTimePercent: 75 },
  { threshold: 0.65, recall: 0.90, falseAlarmRate: 250, savedReviewTimePercent: 79 },
  { threshold: 0.70, recall: 0.88, falseAlarmRate: 224, savedReviewTimePercent: 82 },
  { threshold: 0.75, recall: 0.84, falseAlarmRate: 194, savedReviewTimePercent: 86 },
  { threshold: 0.80, recall: 0.76, falseAlarmRate: 164, savedReviewTimePercent: 89 },
  { threshold: 0.85, recall: 0.68, falseAlarmRate: 134, savedReviewTimePercent: 92 },
  { threshold: 0.90, recall: 0.55, falseAlarmRate: 101, savedReviewTimePercent: 95 },
  { threshold: 0.95, recall: 0.36, falseAlarmRate: 62,  savedReviewTimePercent: 97 },
];

const MODEL_HYPERPARAMETERS = {
  architecture: "EEGCNN1D (3 ConvBlocks + FC classifier)",
  parametersCount: "~300,000 trainable weights",
  frequencyDomain: "0.5–40 Hz Bandpass, 60 Hz Notch",
  temporalWindow: "1792 samples @ 256 Hz (7.0 seconds, 30% overlap)",
  datasetDistribution: "12 train patients / 12 test patients (CHB-MIT)",
  lossFunction: "Weighted CrossEntropyLoss (Seizure Weight: 20×)",
  optimization: "Adam Optimizer, LR=0.001, 13 epochs",
};

const fmt = (v) => (v != null ? (v * 100).toFixed(1) + "%" : "—");

export default function AdminPanel({ token, models, onRetrain, onActivate, retraining, retrainResult, retrainError, activating, onLogout }) {
  const [selectedSweepIdx, setSelectedSweepIdx] = useState(4); // default 0.70
  const activeSweep = THRESHOLD_SWEEP[selectedSweepIdx];

  return (
    <div id="admin_portal" className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans">

      {/* Header */}
      <header className="bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between sticky top-0 z-20 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-violet-600 p-2.5 rounded-2xl text-white shadow-md">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
              <path fillRule="evenodd" clipRule="evenodd" d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7L12 2zm-1 13l-3-3 1.41-1.41L11 12.17l4.59-4.58L17 9l-6 6z"/>
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black tracking-tight text-slate-800">NeuroTriage</h1>
              <span className="bg-violet-100 text-violet-700 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                Clinical Admin Panel
              </span>
            </div>
            <p className="text-xs text-slate-500">Neural model metrics, dataset telemetry, &amp; sensitivity sweep charts</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onLogout}
          className="bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-800 text-xs font-bold px-4 py-2 rounded-xl transition duration-150"
        >
          Log Out
        </button>
      </header>

      {/* Content */}
      <div className="flex-1 p-6 space-y-6 overflow-y-auto max-h-[calc(100vh-80px)]">

        {/* Top telemetry banner */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm flex items-center gap-4">
            <div className="bg-violet-50 text-violet-600 p-3 rounded-xl shrink-0">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
              </svg>
            </div>
            <div>
              <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">Active Version</span>
              <span className="text-xl font-extrabold text-slate-700 font-mono">{models?.active_version ?? "—"}</span>
            </div>
          </div>

          <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm flex items-center gap-4">
            <div className="bg-violet-50 text-violet-600 p-3 rounded-xl shrink-0">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="22,12 18,12 15,21 9,3 6,12 2,12"/>
              </svg>
            </div>
            <div>
              <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">Total Versions</span>
              <span className="text-xl font-extrabold text-slate-700 font-mono">{models?.versions?.length ?? 0}</span>
            </div>
          </div>

          <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm flex items-center gap-4">
            <div className="bg-emerald-50 text-emerald-600 p-3 rounded-xl shrink-0">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="23,6 13.5,15.5 8.5,10.5 1,18"/><polyline points="17,6 23,6 23,12"/>
              </svg>
            </div>
            <div>
              <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">Best Recall</span>
              <span className="text-xl font-extrabold text-emerald-600 font-mono">95% @ 0.50</span>
            </div>
          </div>

          <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm flex items-center gap-4">
            <div className="bg-amber-50 text-amber-600 p-3 rounded-xl shrink-0">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            </div>
            <div>
              <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">Min FA/hr</span>
              <span className="text-xl font-extrabold text-amber-600 font-mono">62 @ 0.95</span>
            </div>
          </div>
        </div>

        {/* Main grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Left: Model hyperparameters + retrain */}
          <div className="lg:col-span-1 space-y-6">

            {/* Model Architecture Specs */}
            <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-violet-600">
                  <rect x="4" y="4" width="16" height="16" rx="2" ry="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/><line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="14" x2="23" y2="14"/><line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="14" x2="4" y2="14"/>
                </svg>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Deep 1D CNN Hyperparameters</h3>
              </div>
              <div className="space-y-3.5 text-xs text-slate-600">
                {Object.entries(MODEL_HYPERPARAMETERS).map(([key, val]) => (
                  <div key={key}>
                    <span className="block font-bold text-slate-500 uppercase text-[9px]">
                      {key.replace(/([A-Z])/g, " $1").trim()}
                    </span>
                    <span className="font-semibold text-slate-800 block font-mono">{val}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Retrain section */}
            <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Model Retraining</h3>
              <p className="text-xs text-slate-500 mb-4">Fine-tune on doctor feedback. New versions are saved but not activated until you choose.</p>
              <button
                onClick={onRetrain}
                disabled={retraining}
                className="w-full py-3 rounded-2xl text-sm font-semibold text-white bg-emerald-500 hover:bg-emerald-600 flex items-center justify-center gap-2 transition disabled:opacity-50 disabled:pointer-events-none"
              >
                {retraining ? (
                  <span className="inline-block animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                ) : (
                  <>
                    <svg width="15" height="15" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" />
                    </svg>
                    Retrain Model
                  </>
                )}
              </button>

              {retrainError && (
                <div className="mt-3 bg-red-50 border border-red-200 text-red-700 text-xs px-4 py-3 rounded-2xl">{retrainError}</div>
              )}

              {retrainResult && (
                <div className="mt-3 p-4 bg-emerald-50 border border-emerald-100 rounded-2xl text-xs text-slate-700 space-y-1.5">
                  <p><strong>{retrainResult.new_version}</strong> saved — not yet active</p>
                  <p>{retrainResult.training_samples} samples ({retrainResult.seizure_samples} seizure, {retrainResult.normal_samples} normal)</p>
                  {retrainResult.metrics && (
                    <p>Accuracy: {fmt(retrainResult.metrics.accuracy)} · Recall: {fmt(retrainResult.metrics.recall)} · F1: {fmt(retrainResult.metrics.f1)}</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right: ROC sweep + model versions */}
          <div className="lg:col-span-2 space-y-6">

            {/* ROC Threshold Sweep */}
            <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-violet-600">
                      <line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>
                    </svg>
                    ROC &amp; False Alarm Sweep
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">Adjust the clinical decision threshold to balance recall vs. workload.</p>
                </div>
                <span className="text-[10px] bg-slate-100 px-2 py-1 rounded font-mono text-slate-500">CHB-MIT Validation</span>
              </div>

              <div className="overflow-x-auto border border-slate-100 rounded-2xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold uppercase text-[9px] tracking-wider">
                      <th className="py-3 px-4">Threshold</th>
                      <th className="py-3 px-4">Recall</th>
                      <th className="py-3 px-4">FA / hr</th>
                      <th className="py-3 px-4 text-emerald-600">Time Saved</th>
                      <th className="py-3 px-4">Select</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {THRESHOLD_SWEEP.map((sweep, idx) => {
                      const isSelected = selectedSweepIdx === idx;
                      return (
                        <tr
                          key={sweep.threshold}
                          className={`hover:bg-slate-50/50 transition cursor-pointer ${isSelected ? "bg-violet-50/40 font-semibold" : "text-slate-600"}`}
                          onClick={() => setSelectedSweepIdx(idx)}
                        >
                          <td className="py-3.5 px-4 font-mono font-medium">{sweep.threshold.toFixed(2)}</td>
                          <td className="py-3.5 px-4">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] ${sweep.recall >= 0.93 ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                              {(sweep.recall * 100).toFixed(0)}%
                            </span>
                          </td>
                          <td className="py-3.5 px-4 font-mono">{sweep.falseAlarmRate} FA/hr</td>
                          <td className="py-3.5 px-4 font-mono font-bold text-emerald-600">{sweep.savedReviewTimePercent}% saved</td>
                          <td className="py-3.5 px-4">
                            <div className="flex items-center justify-center">
                              {isSelected ? (
                                <span className="bg-violet-600 text-white rounded-full p-1">
                                  <svg width="11" height="11" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" />
                                  </svg>
                                </span>
                              ) : (
                                <span className="h-2 w-2 rounded-full bg-slate-300" />
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Summary cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                <div className="bg-slate-900 text-white p-5 rounded-2xl flex flex-col justify-between">
                  <div>
                    <span className="text-[9px] font-mono font-bold text-teal-400 uppercase tracking-widest block mb-1">Sensitivity Margin</span>
                    <h4 className="text-sm font-bold">Workload Optimization</h4>
                    <p className="text-[11px] text-slate-400 mt-1">
                      At threshold {activeSweep.threshold.toFixed(2)}, clinicians skip reviewing {activeSweep.savedReviewTimePercent}% of non-seizure hours.
                    </p>
                  </div>
                  <div className="mt-6 flex items-baseline gap-2">
                    <span className="text-3xl font-black font-mono text-teal-400">{activeSweep.savedReviewTimePercent}%</span>
                    <span className="text-xs text-slate-400 font-bold">reduction in review time</span>
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-100 p-5 rounded-2xl flex flex-col justify-between">
                  <div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Operating Point</span>
                    <h4 className="text-xs font-bold text-slate-700">Recall vs. False Alarms</h4>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Recall: {(activeSweep.recall * 100).toFixed(0)}% · FA/hr: {activeSweep.falseAlarmRate}
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-200/50 flex justify-between items-center text-[10px] font-mono text-slate-400">
                    <span>Low FA</span>
                    <div className="flex-1 max-w-xs mx-4 bg-slate-200 h-1 rounded-full relative">
                      <div
                        className="absolute bg-violet-600 h-2.5 w-2.5 rounded-full top-1/2 -translate-y-1/2 transition-all duration-300"
                        style={{ left: `${(1 - activeSweep.falseAlarmRate / 330) * 100}%` }}
                      />
                    </div>
                    <span>High FA</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Model versions table */}
            {models && (
              <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">
                  Model Versions ({models.versions.length})
                </h3>
                <div className="overflow-x-auto border border-slate-100 rounded-2xl">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold uppercase text-[9px] tracking-wider">
                        <th className="py-3 px-4">Version</th>
                        <th className="py-3 px-4">Type</th>
                        <th className="py-3 px-4">Date</th>
                        <th className="py-3 px-4">Samples</th>
                        <th className="py-3 px-4">Recall</th>
                        <th className="py-3 px-4">Specificity</th>
                        <th className="py-3 px-4">F1</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {models.versions.map((v) => {
                        const m = v.metrics || {};
                        const isActive = v.version === models.active_version;
                        return (
                          <tr key={v.version} className="hover:bg-slate-50/50 transition text-slate-600">
                            <td className="py-3.5 px-4 font-mono font-bold text-slate-800">{v.version}</td>
                            <td className="py-3.5 px-4">{v.type}</td>
                            <td className="py-3.5 px-4 font-mono text-[10px]">
                              {v.created_at ? new Date(v.created_at).toLocaleDateString() : "—"}
                            </td>
                            <td className="py-3.5 px-4 font-mono">{v.training_samples ?? "—"}</td>
                            <td className="py-3.5 px-4">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] ${m.recall >= 0.8 ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                                {fmt(m.recall)}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 font-mono">{fmt(m.specificity)}</td>
                            <td className="py-3.5 px-4 font-mono">{fmt(m.f1)}</td>
                            <td className="py-3.5 px-4">
                              {isActive ? (
                                <span className="bg-emerald-50 text-emerald-700 text-[9px] font-bold px-2 py-0.5 rounded-full">Active</span>
                              ) : (
                                <span className="bg-slate-100 text-slate-500 text-[9px] font-bold px-2 py-0.5 rounded-full">Inactive</span>
                              )}
                            </td>
                            <td className="py-3.5 px-4">
                              {!isActive && (
                                <button
                                  onClick={() => onActivate(v.version)}
                                  disabled={activating === v.version}
                                  className="bg-violet-600 hover:bg-violet-700 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg transition disabled:opacity-40"
                                >
                                  {activating === v.version ? "..." : "Activate"}
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
