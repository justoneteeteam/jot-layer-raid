"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Team, fetchTeams, uploadBackground } from "../../../lib/api";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://api-worker.justoneteeteam.workers.dev";

export default function AICreatorPage() {
  const router = useRouter();
  
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [templateName, setTemplateName] = useState("");
  const [teamId, setTeamId] = useState("");
  const [colorVariant, setColorVariant] = useState("");
  
  const [teams, setTeams] = useState<Team[]>([]);

  useEffect(() => {
    fetchTeams().then(setTeams).catch(console.error);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected && selected.size <= 10 * 1024 * 1024) {
      setFile(selected);
      setPreview(URL.createObjectURL(selected));
      setError(null);
    } else {
      alert("File must be PNG/JPEG and under 10 MB");
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      setFile(droppedFile);
      setPreview(URL.createObjectURL(droppedFile));
      setError(null);
    }
  }, []);

  const handleCreate = async () => {
    if (!file) return;
    if (!templateName) {
      setError("Template name is required.");
      return;
    }
    
    setProcessing(true);
    setError(null);

    try {
      // 1. Create Template
      const res = await fetch(`${API_BASE}/api/mockups/templates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: templateName,
          team_id: teamId ? parseInt(teamId) : null,
          color_variant: colorVariant || null
        })
      });
      
      if (!res.ok) throw new Error("Failed to create template record.");
      const template = await res.json();
      
      // 2. Upload background
      await uploadBackground(template.id, file);
      
      // 3. Navigate back to mockups
      router.push("/mockups");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "An unknown error occurred";
      setError(message);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div>
      <div className="card" style={{ maxWidth: 800, margin: "0 auto", padding: 24 }}>
        <div className="card-header" style={{ marginBottom: 24 }}>
          <h2 className="card-title">✨ Create Mockup Template</h2>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32 }}>
          {/* Left: Upload */}
          <div>
            <div
              style={{
                border: "2px dashed var(--border-default)",
                borderRadius: 12,
                padding: 40,
                textAlign: "center",
                height: 300,
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                background: "var(--bg-secondary)",
                cursor: "pointer",
                transition: "border-color 150ms ease",
              }}
              onClick={() => document.getElementById("file-input")?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
            >
              <input
                id="file-input"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleFileChange}
                style={{ display: "none" }}
              />
              {preview ? (
                <img
                  src={preview}
                  alt="Preview"
                  style={{ maxWidth: "100%", maxHeight: "100%", borderRadius: 8, objectFit: "contain" }}
                />
              ) : (
                <>
                  <div style={{ fontSize: 48, marginBottom: 12 }}>📸</div>
                  <div style={{ fontWeight: 500, marginBottom: 4 }}>Upload Jersey Image</div>
                  <div style={{ color: "var(--text-muted)", fontSize: 13 }}>PNG, JPEG, or WebP</div>
                </>
              )}
            </div>
          </div>
          
          {/* Right: Form */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Template Name *</label>
              <input
                className="input"
                type="text"
                placeholder="e.g. Eagles Home Green"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
              />
            </div>
            
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Team (Optional)</label>
              <select className="input" value={teamId} onChange={(e) => setTeamId(e.target.value)}>
                <option value="">No Team / Global</option>
                {teams.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Color Variant (Optional)</label>
              <input
                className="input"
                type="text"
                placeholder="e.g. Home, Away, Alternate, Kelly Green"
                value={colorVariant}
                onChange={(e) => setColorVariant(e.target.value)}
              />
            </div>

            {error && (
              <div style={{ padding: "12px 16px", background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.3)", borderRadius: 8, color: "#ef4444", fontSize: 14 }}>
                ❌ {error}
              </div>
            )}
            
            <div style={{ flex: 1 }} />
            
            <div style={{ display: "flex", gap: 12 }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => router.push("/mockups")} disabled={processing}>
                Cancel
              </button>
              <button className="btn btn-primary" style={{ flex: 2 }} onClick={handleCreate} disabled={!file || !templateName || processing}>
                {processing ? "⏳ Creating..." : "✨ Create Template"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
