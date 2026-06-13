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

const PRESETS = {
  Aggressive: 0.50,
  Balanced: 0.70,
  Conservative: 0.85,
};

export default function ThresholdSlider({ threshold, onChange }) {
  const current = THRESHOLD_TABLE[threshold] || THRESHOLD_TABLE[0.70];

  return (
    <div className="threshold-slider">
      <div className="slider-header">
        <label>Detection Sensitivity</label>
        <div className="presets">
          {Object.entries(PRESETS).map(([label, value]) => (
            <button
              key={label}
              className={threshold === value ? "preset active" : "preset"}
              onClick={() => onChange(value)}
            >
              {label}
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
      />

      <div className="slider-labels">
        <span>Aggressive</span>
        <span>Conservative</span>
      </div>

      <p className="slider-stats">
        At threshold {threshold.toFixed(2)}: ~{(current.recall * 100).toFixed(0)}% recall, ~{current.fa} false alarms/hour
      </p>
    </div>
  );
}
