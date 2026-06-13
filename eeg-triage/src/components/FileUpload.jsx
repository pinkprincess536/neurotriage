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
      className="file-upload"
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
      onClick={() => inputRef.current?.click()}
    >
      {file ? (
        <p>
          Selected: <strong>{file.name}</strong> ({formatSize(file.size)})
        </p>
      ) : (
        <p>Drop a .edf file here or click to browse</p>
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
