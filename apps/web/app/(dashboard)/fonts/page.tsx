"use client";

import { useState, useEffect, useCallback } from "react";
import UploadModal from "../../components/UploadModal";
import { Font, Team, fetchTeams, fetchFonts } from "../../lib/api";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://api-worker.justoneteeteam.workers.dev";

interface FontEntry {
  id: number;
  name: string;
  category: string;
  team_id?: number;
  jersey_type?: string;
  file: File | null;
  objectUrl: string;
  preview: string;
}

const CATEGORIES = ["NFL", "MLB", "NCAA", "NHL", "Custom"];
const JERSEY_TYPES = ["Home", "Away", "Alternate"];

export default function FontsPage() {
  /* ── State ── */
  const [modalOpen, setModalOpen] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<FontEntry[]>([]);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("All");
  const [filterTeam, setFilterTeam] = useState<number | "All">("All");
  
  const [uploadedFonts, setUploadedFonts] = useState<Font[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);

  // Load teams and fonts on mount
  useEffect(() => {
    Promise.all([
      fetchTeams().catch(e => { console.error(e); return []; }),
      fetchFonts().catch(e => { console.error(e); return []; })
    ]).then(([teamsData, fontsData]) => {
      setTeams(teamsData);
      setUploadedFonts(fontsData);
      setLoading(false);
    });
  }, []);

  /* ── Load dynamic fonts for previews ── */
  useEffect(() => {
    uploadedFonts.forEach((f) => {
      if (f.file_url && f.name) {
        const alreadyLoaded = Array.from(document.fonts.values()).some(
          (face) => face.family === f.name
        );
        if (!alreadyLoaded) {
          const fontFace = new FontFace(f.name, `url(${f.file_url})`, { display: 'swap' });
          fontFace
            .load()
            .then((loaded) => {
              document.fonts.add(loaded);
            })
            .catch((e) => {
              console.error(`Error loading font ${f.name}:`, e);
            });
        }
      }
    });
  }, [uploadedFonts]);

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
            team_id: undefined,
            jersey_type: undefined,
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
            team_id: undefined,
            jersey_type: undefined,
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
  
  const updatePreviewTeam = (idx: number, teamIdStr: string) => {
    setPreviews((prev) =>
      prev.map((p, i) => (i === idx ? { ...p, team_id: teamIdStr ? parseInt(teamIdStr) : undefined } : p))
    );
  };
  
  const updatePreviewJersey = (idx: number, jerseyType: string) => {
    setPreviews((prev) =>
      prev.map((p, i) => (i === idx ? { ...p, jersey_type: jerseyType || undefined } : p))
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
    
    try {
      for (const p of previews) {
        if (!p.file) continue;
        const formData = new FormData();
        formData.append("files", p.file);
        formData.append("category", p.category);
        if (p.team_id) formData.append("team_id", p.team_id.toString());
        if (p.jersey_type) formData.append("jersey_type", p.jersey_type);
        
        const res = await fetch(`${API_BASE}/api/fonts/upload`, {
          method: "POST",
          body: formData
        });
        
        if (!res.ok) throw new Error(`Failed to upload ${p.name}`);
      }
      
      // Refresh fonts
      const newFonts = await fetchFonts();
      setUploadedFonts(newFonts);
      
      setFiles([]);
      setPreviews([]);
      setModalOpen(false);
    } catch (err) {
      console.error(err);
      alert("Error uploading fonts");
    } finally {
      setUploading(false);
    }
  };

  /* ── Delete ── */
  const handleDelete = async (id: number) => {
    if (!window.confirm("Delete this font?")) return;
    try {
      const res = await fetch(`${API_BASE}/api/fonts/${id}`, { method: "DELETE" });
      if (res.ok) {
        setUploadedFonts((prev) => prev.filter((f) => f.id !== id));
      } else {
        alert("Failed to delete font");
      }
    } catch (err) {
      console.error(err);
      alert("Error deleting font");
    }
  };

  /* ── Filter ── */
  const filtered = uploadedFonts.filter((f) => {
    const matchSearch = f.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = filterCat === "All" || f.category === filterCat;
    const matchTeam = filterTeam === "All" || f.team_id === filterTeam;
    return matchSearch && matchCat && matchTeam;
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
              value={filterTeam}
              onChange={(e) => setFilterTeam(e.target.value === "All" ? "All" : parseInt(e.target.value))}
              style={{ width: 160, height: 36 }}
            >
              <option value="All">All Teams</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            
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
                <th>Team & Jersey</th>
                <th>Preview</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", padding: 32 }}>Loading fonts...</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <div className="empty-state" style={{ padding: 32 }}>
                      <div className="empty-state-icon">🔤</div>
                      <div className="empty-state-title">No fonts found</div>
                      <div className="empty-state-text">Upload font files to get started</div>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((font) => {
                  return (
                    <tr key={font.id}>
                      <td style={{ fontWeight: 600 }}>{font.name}</td>
                      <td>
                        <span className="badge badge-info">{font.category}</span>
                      </td>
                      <td>
                        {font.team_name ? (
                          <div>
                            <div style={{ fontWeight: 500 }}>{font.team_name}</div>
                            {font.jersey_type && <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{font.jersey_type} Jersey</div>}
                          </div>
                        ) : (
                          <span style={{ color: "var(--text-muted)", fontSize: 12 }}>Global</span>
                        )}
                      </td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center" }}>
                          <div style={{ fontSize: 22, letterSpacing: 1, fontFamily: font.name }}>
                            SMITH-NJIGBA 11
                          </div>
                        </div>
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
            <div key={idx} className="font-preview-card" style={{ padding: 12 }}>
              <div className="font-preview-header" style={{ marginBottom: 8, display: "flex", flexDirection: "column", gap: 8 }}>
                <span className="font-preview-name">{entry.name}</span>
                <div style={{ display: "flex", gap: 8 }}>
                  <select
                    className="input"
                    value={entry.category}
                    onChange={(e) => updatePreviewCategory(idx, e.target.value)}
                    style={{ flex: 1, height: 30, fontSize: 12 }}
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  
                  <select
                    className="input"
                    value={entry.team_id || ""}
                    onChange={(e) => updatePreviewTeam(idx, e.target.value)}
                    style={{ flex: 1, height: 30, fontSize: 12 }}
                  >
                    <option value="">No Team (Global)</option>
                    {teams.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                  
                  {entry.team_id && (
                    <select
                      className="input"
                      value={entry.jersey_type || ""}
                      onChange={(e) => updatePreviewJersey(idx, e.target.value)}
                      style={{ flex: 1, height: 30, fontSize: 12 }}
                    >
                      <option value="">Any Jersey</option>
                      {JERSEY_TYPES.map((jt) => (
                        <option key={jt} value={jt}>{jt}</option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
              <div
                className="font-preview-text"
                style={{ fontFamily: entry.name, padding: "16px 0", textAlign: "center", border: "1px dashed var(--border-default)", borderRadius: 4, margin: "8px 0" }}
              >
                {entry.preview}
              </div>
              <input
                className="input"
                placeholder="Preview text…"
                value={entry.preview}
                onChange={(e) => updatePreviewText(idx, e.target.value)}
                style={{ height: 30, fontSize: 12, width: "100%" }}
              />
            </div>
          ))}
        </div>
      </UploadModal>
    </div>
  );
}
