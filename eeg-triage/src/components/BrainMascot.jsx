import { useState, useEffect } from "react";
import "../App.css";

export default function BrainMascot({ mood = "idle", bubbleText, className = "" }) {
  const [isBlinking, setIsBlinking] = useState(false);
  const [speech, setSpeech] = useState("");

  useEffect(() => {
    const interval = setInterval(() => {
      if (Math.random() > 0.3) {
        setIsBlinking(true);
        setTimeout(() => setIsBlinking(false), 180);
      }
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (bubbleText) { setSpeech(bubbleText); return; }
    const map = {
      greetings: "Hi! I'm Neuro, your EEG triage assistant. Sign in to begin!",
      thinking:  "Applying bandpass filter 0.5–40 Hz & notch 60 Hz...",
      analyzing: "Running EEGCNN1D inference on 22-channel windows...",
      success:   "Analysis complete! Flagged windows are ready for review.",
      error:     "Something went wrong. Please try a valid .edf file.",
      waving:    "Welcome back, Doctor! Ready to review some brain waves?",
      idle:      "Monitoring model metrics. Let me know when you need help.",
    };
    setSpeech(map[mood] || map.idle);
  }, [mood, bubbleText]);

  const bobStyle = {
    animation: mood === "analyzing"
      ? "mascot-pulse 1s ease-in-out infinite"
      : "mascot-bob 3s ease-in-out infinite",
  };

  return (
    <div className={`mascot-wrap ${className}`} style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center" }}>
      {/* Speech bubble */}
      {speech && (
        <div className="mascot-bubble">
          {speech}
          <div className="mascot-bubble-tail" />
        </div>
      )}

      <div style={{ width: 140, height: 140, ...bobStyle }}>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="140" height="140">
          {/* Glow */}
          {(mood === "analyzing" || mood === "thinking") && (
            <circle cx="100" cy="100" r="60" fill={mood === "analyzing" ? "#c084fc" : "#818cf8"} opacity="0.15" />
          )}

          {/* Arms */}
          <path d="M60,115 C45,110 35,115 35,123 C35,130 45,130 55,123 Z" fill="#d8b4fe" stroke="#a855f7" strokeWidth="2.5" />
          <path d="M140,115 C155,110 165,115 165,123 C165,130 155,130 145,123 Z" fill="#d8b4fe" stroke="#a855f7" strokeWidth="2.5" />

          {/* Legs */}
          <ellipse cx="82" cy="158" rx="11" ry="6" fill="#a855f7" />
          <ellipse cx="118" cy="158" rx="11" ry="6" fill="#a855f7" />

          {/* Brain body */}
          <path d="M100,52 C60,52 48,72 48,97 C48,127 70,142 100,142 C130,142 152,127 152,97 C152,72 140,52 100,52Z" fill="#e9d5ff" />

          {/* Left lobe */}
          <path d="M100,55 C78,55 52,64 52,92 C52,114 68,137 96,139 C98,127 82,124 82,110 C82,94 98,90 94,76 C94,64 100,60 100,55Z"
            fill="#ddd6fe" stroke="#a855f7" strokeWidth="3.5" strokeLinecap="round" />

          {/* Right lobe */}
          <path d="M100,55 C122,55 148,64 148,92 C148,114 132,137 104,139 C102,127 118,124 118,110 C118,94 102,90 106,76 C106,64 100,60 100,55Z"
            fill="#ddd6fe" stroke="#a855f7" strokeWidth="3.5" strokeLinecap="round" />

          {/* EEG wave lines */}
          <path d="M70,74 Q100,83 130,74" stroke="#a855f7" strokeWidth="1.8" fill="none" opacity="0.45" />
          <path d="M62,114 Q100,107 138,114" stroke="#a855f7" strokeWidth="1.8" fill="none" opacity="0.45" />

          {/* Electrode dots */}
          <circle cx="72" cy="72" r="4.5" fill="#ede9fe" stroke="#e2e8f0" strokeWidth="1" />
          <circle cx="128" cy="72" r="4.5" fill="#ede9fe" stroke="#e2e8f0" strokeWidth="1" />
          <circle cx="62" cy="112" r="4.5" fill="#ede9fe" stroke="#e2e8f0" strokeWidth="1" />
          <circle cx="138" cy="112" r="4.5" fill="#ede9fe" stroke="#e2e8f0" strokeWidth="1" />

          {/* Blush */}
          <ellipse cx="68" cy="120" rx="8" ry="5" fill="#a855f7" opacity="0.25" />
          <ellipse cx="132" cy="120" rx="8" ry="5" fill="#a855f7" opacity="0.25" />

          {/* Eyes */}
          {isBlinking ? (
            <g stroke="#3730a3" strokeWidth="4" strokeLinecap="round">
              <line x1="73" y1="103" x2="87" y2="103" />
              <line x1="113" y1="103" x2="127" y2="103" />
            </g>
          ) : mood === "error" ? (
            <g stroke="#3730a3" strokeWidth="3.5" strokeLinecap="round">
              <line x1="73" y1="97" x2="85" y2="109" /><line x1="85" y1="97" x2="73" y2="109" />
              <line x1="115" y1="97" x2="127" y2="109" /><line x1="127" y1="97" x2="115" y2="109" />
            </g>
          ) : mood === "success" ? (
            <g stroke="#3730a3" strokeWidth="3.5" strokeLinecap="round" fill="none">
              <path d="M73,107 Q80,95 87,107" /><path d="M113,107 Q120,95 127,107" />
            </g>
          ) : (
            <g>
              <circle cx="80" cy="103" r="7" fill="#3730a3" />
              <circle cx="120" cy="103" r="7" fill="#3730a3" />
              <circle cx="78" cy="100" r="2.5" fill="white" />
              <circle cx="118" cy="100" r="2.5" fill="white" />
            </g>
          )}

          {/* Mouth */}
          {mood === "error" ? (
            <path d="M94,119 Q100,114 106,119" stroke="#3730a3" strokeWidth="3" strokeLinecap="round" fill="none" />
          ) : mood === "thinking" ? (
            <line x1="95" y1="118" x2="105" y2="118" stroke="#3730a3" strokeWidth="3" strokeLinecap="round" />
          ) : (
            <path d="M93,115 Q100,122 107,115" stroke="#3730a3" strokeWidth="3" strokeLinecap="round" fill="none" />
          )}
        </svg>
      </div>
    </div>
  );
}
