"use client";

import { useState, useRef, useCallback, type ReactNode, type DragEvent } from "react";

interface UploadModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  accept: string; // e.g. ".ttf,.otf,.woff,.woff2"
  acceptLabel: string; // e.g. "TTF, OTF, WOFF"
  multiple?: boolean;
  icon?: string;
  files: File[];
  onFilesSelected: (files: File[]) => void;
  onConfirm: () => void;
  uploading?: boolean;
  children?: ReactNode; // preview content slot
}

export default function UploadModal({
  open,
  onClose,
  title,
  accept,
  acceptLabel,
  multiple = true,
  icon = "📁",
  files,
  onFilesSelected,
  onConfirm,
  uploading = false,
  children,
}: UploadModalProps) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOver(false);
      const dropped = Array.from(e.dataTransfer.files);
      const exts = accept.split(",").map((x) => x.trim().toLowerCase());
      const valid = dropped.filter((f) =>
        exts.some((ext) => f.name.toLowerCase().endsWith(ext))
      );
      if (valid.length > 0) {
        onFilesSelected(multiple ? [...files, ...valid] : [valid[0]!]);
      }
    },
    [accept, files, multiple, onFilesSelected]
  );

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    if (selected.length > 0) {
      onFilesSelected(multiple ? [...files, ...selected] : [selected[0]!]);
    }
    e.target.value = "";
  };

  const removeFile = (index: number) => {
    onFilesSelected(files.filter((_, i) => i !== index));
  };

  if (!open) return null;

  const hasFiles = files.length > 0;

  return (
    <div className="upload-modal-overlay" onClick={onClose}>
      <div
        className="upload-modal"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="upload-modal-header">
          <div className="upload-modal-title">
            <span className="upload-modal-icon">{icon}</span>
            {title}
          </div>
          <button className="upload-modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="upload-modal-body">
          {/* Drop Zone */}
          <div
            className={`upload-dropzone ${dragOver ? "dragover" : ""} ${hasFiles ? "has-files" : ""}`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
          >
            <input
              ref={inputRef}
              type="file"
              accept={accept}
              multiple={multiple}
              onChange={handleFileInput}
              style={{ display: "none" }}
            />
            <div className="upload-dropzone-icon">{hasFiles ? "✅" : "☁️"}</div>
            <div className="upload-dropzone-text">
              {hasFiles
                ? `${files.length} file${files.length > 1 ? "s" : ""} selected — click to add more`
                : "Drag & drop files here, or click to browse"}
            </div>
            <div className="upload-dropzone-hint">Accepts: {acceptLabel}</div>
          </div>

          {/* File List */}
          {hasFiles && (
            <div className="upload-file-list">
              {files.map((f, i) => (
                <div key={`${f.name}-${i}`} className="upload-file-item">
                  <span className="upload-file-name">{f.name}</span>
                  <span className="upload-file-size">
                    {(f.size / 1024).toFixed(1)} KB
                  </span>
                  <button
                    className="upload-file-remove"
                    onClick={(e) => { e.stopPropagation(); removeFile(i); }}
                    title="Remove"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Preview Slot */}
          {hasFiles && children && (
            <div className="upload-preview-area">{children}</div>
          )}
        </div>

        {/* Footer */}
        <div className="upload-modal-footer">
          <button className="btn btn-secondary" onClick={onClose} disabled={uploading}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={onConfirm}
            disabled={!hasFiles || uploading}
          >
            {uploading ? (
              <>
                <span className="upload-spinner" /> Uploading…
              </>
            ) : (
              <>⬆️ Upload {files.length > 0 ? `(${files.length})` : ""}</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
