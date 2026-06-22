import { useRef } from "react";

export default function FileUpload({ file, onFileSelect }) {
  const inputRef = useRef(null);

  const handleDrop = (e) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f && f.name.endsWith(".edf")) onFileSelect(f);
  };

  const handleChange = (e) => {
    const f = e.target.files[0];
    if (f) onFileSelect(f);
  };

  const formatSize = (bytes) => {
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  return (
    <div
      className="border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center cursor-pointer transition-all duration-200 hover:border-rose-400 hover:bg-rose-50/30 bg-slate-50"
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
      onClick={() => inputRef.current?.click()}
    >
      {file ? (
        <div className="flex flex-col items-center gap-2">
          <div className="bg-rose-100 text-rose-500 p-3 rounded-xl inline-flex">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
              <polyline points="14,2 14,8 20,8"/>
            </svg>
          </div>
          <p className="text-sm font-bold text-slate-700">{file.name}</p>
          <p className="text-xs text-slate-400">{formatSize(file.size)} · Click to change</p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2">
          <div className="bg-slate-100 text-slate-400 p-3 rounded-xl inline-flex">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="16,16 12,12 8,16"/>
              <line x1="12" y1="12" x2="12" y2="21"/>
              <path d="M20.39 18.39A5 5 0 0018 9h-1.26A8 8 0 103 16.3"/>
            </svg>
          </div>
          <p className="text-sm font-semibold text-slate-600">Drop a .edf file here</p>
          <p className="text-xs text-slate-400">or click to browse</p>
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept=".edf"
        onChange={handleChange}
        hidden
      />
    </div>
  );
}
