"use client";

import { useState, useEffect } from "react";
import UploadModal from "../../components/UploadModal";
import { Patch, fetchPatches } from "../../lib/api";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://api-worker.justoneteeteam.workers.dev";

interface PatchEntry {
  id: number;
  name: string;
  imageUrl: string;
  width: number;
  height: number;
  file: File | null;
}

export default function PatchesPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<PatchEntry[]>([]);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState("");
  const [patches, setPatches] = useState<Patch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPatches()
      .then(data => {
        setPatches(data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (files.length === 0) { setPreviews([]); return; }
    const entries: PatchEntry[] = [];
    let loaded = 0;
    files.forEach((file, i) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        entries[i] = { id: Date.now() + i, name: file.name.replace(/\.[^.]+$/, ""), imageUrl: url, width: img.naturalWidth, height: img.naturalHeight, file };
        loaded++;
        if (loaded === files.length) setPreviews([...entries]);
      };
      img.onerror = () => {
        entries[i] = { id: Date.now() + i, name: file.name.replace(/\.[^.]+$/, ""), imageUrl: url, width: 0, height: 0, file };
        loaded++;
        if (loaded === files.length) setPreviews([...entries]);
      };
      img.src = url;
    });
  }, [files]);

  const updateName = (idx: number, name: string) => {
    setPreviews((prev) => prev.map((p, i) => (i === idx ? { ...p, name } : p)));
  };

  const handleUpload = async () => {
    setUploading(true);
    try {
      const formData = new FormData();
      for (const p of previews) {
        if (p.file) {
          // You could rename the file here if needed to match `p.name`, 
          // but the backend takes filename. So we append file.
          // Note: for multiple files we should ideally send name metadata or upload one by one if names changed.
          // Since it's a simple dashboard, we upload all and let backend use filename.
          formData.append("files", p.file, p.name + (p.file.name.match(/\.[^.]+$/)?.[0] || ".png"));
        }
      }
      
      const res = await fetch(`${API_BASE}/api/patches/upload`, {
        method: "POST",
        body: formData
      });
      
      if (!res.ok) throw new Error("Failed to upload patches");
      
      const newPatches = await fetchPatches();
      setPatches(newPatches);
      
      setFiles([]); 
      setPreviews([]); 
      setModalOpen(false);
    } catch (err) {
      console.error(err);
      alert("Error uploading patches");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Delete this patch?")) return;
    try {
      const res = await fetch(`${API_BASE}/api/patches/${id}`, { method: "DELETE" });
      if (res.ok) {
        setPatches((prev) => prev.filter((p) => p.id !== id));
      } else {
        alert("Failed to delete patch");
      }
    } catch (err) {
      console.error(err);
      alert("Error deleting patch");
    }
  };

  const filtered = patches.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Patch Library</h2>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input className="input" placeholder="Search patches…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: 200, height: 36 }} />
            <button className="btn btn-primary" onClick={() => setModalOpen(true)}>⬆️ Upload Patch</button>
          </div>
        </div>
        <div className="upload-stats-bar">
          <span className="upload-stat-chip">🏷️ Total Patches: <strong>{patches.length}</strong></span>
        </div>
        <div className="patch-grid" style={{ marginTop: 16 }}>
          {loading ? (
            <div style={{ gridColumn: "1 / -1", padding: 48, textAlign: "center" }}>Loading patches...</div>
          ) : filtered.length === 0 ? (
            <div className="empty-state" style={{ gridColumn: "1 / -1", padding: 48 }}>
              <div className="empty-state-icon">🏷️</div>
              <div className="empty-state-title">No patches found</div>
              <div className="empty-state-text">Upload patch images to get started</div>
            </div>
          ) : (
            filtered.map((patch) => (
              <div key={patch.id} className="patch-card">
                <div className="patch-card-image"><img src={patch.image_url} alt={patch.name} onError={(e) => { e.currentTarget.src = "https://placehold.co/120x120?text=Error" }} /></div>
                <div className="patch-card-info">
                  <div className="patch-card-name">{patch.name}</div>
                  {patch.width && patch.height && <div className="patch-card-dims">{patch.width} × {patch.height}px</div>}
                </div>
                <div className="patch-card-actions">
                  <button className="btn btn-ghost" onClick={() => handleDelete(patch.id)} title="Delete patch">🗑️</button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <UploadModal open={modalOpen} onClose={() => { setModalOpen(false); setFiles([]); setPreviews([]); }} title="Upload Patches" accept=".png,.svg,.webp,.jpg,.jpeg" acceptLabel="PNG, SVG, WebP, JPG" multiple icon="🏷️" files={files} onFilesSelected={setFiles} onConfirm={handleUpload} uploading={uploading}>
        <div className="patch-preview-grid">
          {previews.map((entry, idx) => (
            <div key={idx} className="patch-preview-card">
              <img src={entry.imageUrl} alt={entry.name} className="patch-preview-img" />
              <div className="patch-preview-details">
                <input className="input" value={entry.name} onChange={(e) => updateName(idx, e.target.value)} placeholder="Patch name…" style={{ height: 30, fontSize: 12 }} />
                {entry.width > 0 && <span className="patch-preview-dims">{entry.width} × {entry.height}px</span>}
              </div>
            </div>
          ))}
        </div>
      </UploadModal>
    </div>
  );
}
