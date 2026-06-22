const THRESHOLD_TABLE = {
  0.50: { recall: 0.95, fa: 330 },
  0.55: { recall: 0.93, fa: 280 },
  0.60: { recall: 0.93, fa: 279 },
  0.65: { recall: 0.90, fa: 250 },
  0.70: { recall: 0.88, fa: 224 },
  0.75: { recall: 0.84, fa: 194 },
  0.80: { recall: 0.76, fa: 164 },
  0.85: { recall: 0.68, fa: 134 },
  0.90: { recall: 0.55, fa: 101 },
  0.95: { recall: 0.36, fa: 62 },
};

const PRESETS = [
  { label: "Aggressive", value: 0.50, color: "bg-rose-500 hover:bg-rose-600" },
  { label: "Balanced",   value: 0.70, color: "bg-violet-600 hover:bg-violet-700" },
  { label: "Conservative", value: 0.85, color: "bg-slate-600 hover:bg-slate-700" },
];

export default function ThresholdSlider({ threshold, onChange }) {
  const current = THRESHOLD_TABLE[threshold] || THRESHOLD_TABLE[0.70];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
          Detection Sensitivity
        </label>
        <div className="flex gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => onChange(p.value)}
              className={`text-[10px] font-bold px-2.5 py-1 rounded-lg text-white transition ${
                threshold === p.value ? p.color : "bg-slate-200 text-slate-500 hover:bg-slate-300"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <input
        type="range"
        min="0.50"
        max="0.95"
        step="0.05"
        value={threshold}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-rose-500"
      />

      <div className="flex justify-between text-[10px] text-slate-400 font-mono">
        <span>0.50 — More sensitive</span>
        <span>0.95 — More specific</span>
      </div>

      <div className="bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 flex items-center justify-between text-xs font-mono">
        <div>
          <span className="text-slate-400">Threshold </span>
          <span className="font-bold text-slate-800">{threshold.toFixed(2)}</span>
        </div>
        <div className="flex gap-4">
          <div>
            <span className="text-slate-400">Recall </span>
            <span className={`font-bold ${current.recall >= 0.90 ? "text-emerald-600" : current.recall >= 0.70 ? "text-amber-600" : "text-rose-600"}`}>
              ~{(current.recall * 100).toFixed(0)}%
            </span>
          </div>
          <div>
            <span className="text-slate-400">FA/hr </span>
            <span className="font-bold text-slate-700">~{current.fa}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
