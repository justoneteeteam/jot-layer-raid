"use client";

import { useState, useEffect, useCallback } from "react";
import UploadModal from "../../components/UploadModal";

interface FontEntry {
  id: number;
  name: string;
  category: string;
  file: File | null;
  objectUrl: string;
  preview: string;
}

const CATEGORIES = ["NFL", "MLB", "NCAA", "NHL", "Custom"];

export default function FontsPage() {
  /* ── State ── */
  const [modalOpen, setModalOpen] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<FontEntry[]>([]);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("All");
  const [uploadedFonts, setUploadedFonts] = useState<FontEntry[]>([
    { id: 1, name: "NFL Block Bold", category: "NFL", file: null, objectUrl: "", preview: "SMITH-NJIGBA 11" },
    { id: 2, name: "Eagles Custom", category: "NFL", file: null, objectUrl: "", preview: "HURTS 1" },
    { id: 3, name: "MLB Script", category: "MLB", file: null, objectUrl: "", preview: "Ohtani 17" },
  ]);

  /* ── Load font faces for preview ── */
  const loadFontPreview = useCallback((file: File): Promise<FontEntry> => {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const fontName = file.name.replace(/\.(ttf|otf|woff2?|eot)$/i, "");
      const fontFace = new FontFace(fontName, `url(${url})`);
      fontFace
        .load()
        .then((loaded) => {
          document.fonts.add(loaded);
          resolve({
            id: Date.now() + Math.random(),
            name: fontName,
            category: "NFL",
            file,
            objectUrl: url,
            preview: "SMITH-NJIGBA 11",
          });
        })
        .catch(() => {
          resolve({
            id: Date.now() + Math.random(),
            name: fontName,
            category: "NFL",
            file,
            objectUrl: url,
            preview: "SMITH-NJIGBA 11",
          });
        });
    });
  }, []);

  /* ── When files change, build previews ── */
  useEffect(() => {
    if (files.length === 0) {
      setPreviews([]);
      return;
    }
    Promise.all(files.map(loadFontPreview)).then(setPreviews);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files]);

  const updatePreviewCategory = (idx: number, cat: string) => {
    setPreviews((prev) =>
      prev.map((p, i) => (i === idx ? { ...p, category: cat } : p))
    );
  };

  const updatePreviewText = (idx: number, text: string) => {
    setPreviews((prev) =>
      prev.map((p, i) => (i === idx ? { ...p, preview: text } : p))
    );
  };

  /* ── Upload ── */
  const handleUpload = async () => {
    setUploading(true);
    // Simulate upload delay — in production POST to /api/fonts/upload
    await new Promise((r) => setTimeout(r, 1200));
    setUploadedFonts((prev) => [
      ...prev,
      ...previews.map((p, i) => ({ ...p, id: Date.now() + i })),
    ]);
    setFiles([]);
    setPreviews([]);
    setUploading(false);
    setModalOpen(false);
  };

  /* ── Delete ── */
  const handleDelete = (id: number) => {
    setUploadedFonts((prev) => prev.filter((f) => f.id !== id));
  };

  /* ── Filter ── */
  const filtered = uploadedFonts.filter((f) => {
    const matchSearch = f.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = filterCat === "All" || f.category === filterCat;
    return matchSearch && matchCat;
  });

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Font Library</h2>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              className="input"
              placeholder="Search fonts…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: 200, height: 36 }}
            />
            <select
              className="input"
              value={filterCat}
              onChange={(e) => setFilterCat(e.target.value)}
              style={{ width: 120, height: 36 }}
            >
              <option value="All">All Categories</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <button
              className="btn btn-primary"
              onClick={() => setModalOpen(true)}
            >
              ⬆️ Upload Font
            </button>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="upload-stats-bar">
          <span className="upload-stat-chip">
            📊 Total: <strong>{uploadedFonts.length}</strong>
          </span>
          {CATEGORIES.map((c) => {
            const count = uploadedFonts.filter((f) => f.category === c).length;
            return count > 0 ? (
              <span key={c} className="upload-stat-chip">
                {c}: <strong>{count}</strong>
              </span>
            ) : null;
          })}
        </div>

        {/* Font Table */}
        <div className="table-wrapper" style={{ marginTop: 16 }}>
          <table>
            <thead>
              <tr>
                <th>Font Name</th>
                <th>Category</th>
                <th>Preview</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={4}>
                    <div className="empty-state" style={{ padding: 32 }}>
                      <div className="empty-state-icon">🔤</div>
                      <div className="empty-state-title">No fonts found</div>
                      <div className="empty-state-text">Upload font files to get started</div>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((font) => {
                  const fontFamily = font.objectUrl
                    ? font.name
                    : "monospace";
                  return (
                    <tr key={font.id}>
                      <td style={{ fontWeight: 600 }}>{font.name}</td>
                      <td>
                        <span className="badge badge-info">{font.category}</span>
                      </td>
                      <td
                        style={{
                          fontFamily: fontFamily,
                          fontSize: 22,
                          letterSpacing: 1,
                        }}
                      >
                        {font.preview}
                      </td>
                      <td>
                        <button
                          className="btn btn-ghost"
                          onClick={() => handleDelete(font.id)}
                          title="Delete font"
                        >
                          🗑️
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Upload Modal ── */}
      <UploadModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setFiles([]); setPreviews([]); }}
        title="Upload Fonts"
        accept=".ttf,.otf,.woff,.woff2"
        acceptLabel="TTF, OTF, WOFF, WOFF2"
        multiple
        icon="🔤"
        files={files}
        onFilesSelected={setFiles}
        onConfirm={handleUpload}
        uploading={uploading}
      >
        {/* Preview slot */}
        <div className="font-preview-grid">
          {previews.map((entry, idx) => (
            <div key={idx} className="font-preview-card">
              <div className="font-preview-header">
                <span className="font-preview-name">{entry.name}</span>
                <select
                  className="input"
                  value={entry.category}
                  onChange={(e) => updatePreviewCategory(idx, e.target.value)}
                  style={{ width: 100, height: 30, fontSize: 12 }}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div
                className="font-preview-text"
                style={{ fontFamily: entry.name }}
              >
                {entry.preview}
              </div>
              <input
                className="input"
                placeholder="Preview text…"
                value={entry.preview}
                onChange={(e) => updatePreviewText(idx, e.target.value)}
                style={{ height: 30, fontSize: 12 }}
              />
            </div>
          ))}
        </div>
      </UploadModal>
    </div>
  );
}
