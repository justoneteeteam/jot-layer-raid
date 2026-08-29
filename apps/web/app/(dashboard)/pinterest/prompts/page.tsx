"use client";

import React, { useEffect, useState } from "react";

interface Prompt {
  id: string;
  name: string;
  styleDescription: string;
  positivePrompt: string;
  negativePrompt: string;
  colorPalette: string;
  lightingStyle: string;
  cameraStyle: string;
}

const DEFAULT_PROMPTS = [
  { id: "1", name: "Modern Scandinavian", styleDescription: "Clean, minimalist with warm wood tones", positivePrompt: "interior design, living room, modern scandinavian, bright, cozy", negativePrompt: "cluttered, dark, moody", colorPalette: "#ffffff, #f5f5f5, #e0d5c1, #a39b8b, #2c2c2c", lightingStyle: "Natural Soft", cameraStyle: "35mm Lens" },
  { id: "2", name: "Japandi", styleDescription: "Blend of Japanese and Scandinavian minimalism", positivePrompt: "japandi interior, bedroom, zen, wabi-sabi, natural light", negativePrompt: "maximalist, colorful, chaotic", colorPalette: "#e9e5df, #c9bcae, #8c8273, #4a4541, #1a1a1a", lightingStyle: "Diffused Morning Light", cameraStyle: "50mm Prime" },
  { id: "3", name: "Luxury Bathroom", styleDescription: "High-end marble and brass fixtures", positivePrompt: "luxury bathroom, marble, brass fixtures, spa-like, elegant", negativePrompt: "cheap, outdated, small", colorPalette: "#fcfcfc, #ececec, #d1ccbd, #b39b59, #333333", lightingStyle: "Studio Lighting", cameraStyle: "Wide Angle" },
  { id: "4", name: "Boho Bedroom", styleDescription: "Eclectic, textured, earthy tones", positivePrompt: "bohemian bedroom, rattan, macrame, plants, cozy", negativePrompt: "minimalist, sterile, cold", colorPalette: "#f4ece6, #e3c4a8, #d39d78, #865e47, #4b5e40", lightingStyle: "Golden Hour", cameraStyle: "50mm" },
  { id: "5", name: "Coastal Living", styleDescription: "Breezy, light blues, natural textures", positivePrompt: "coastal living room, beach house, airy, rattan, linen", negativePrompt: "urban, dark, heavy", colorPalette: "#ffffff, #e6f0f9, #b5d4e6, #7da7c5, #e0d5c1", lightingStyle: "Bright Daylight", cameraStyle: "35mm" },
  { id: "6", name: "Minimal Kitchen", styleDescription: "Sleek flat-panel cabinets, concrete accents", positivePrompt: "minimalist kitchen, flat panel cabinets, concrete counter, modern", negativePrompt: "ornate, traditional, cluttered", colorPalette: "#f0f0f0, #d9d9d9, #a6a6a6, #595959, #1a1a1a", lightingStyle: "Soft Overhead", cameraStyle: "24mm" },
];

export default function PromptLibrary() {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<Prompt | null>(null);

  const [formData, setFormData] = useState({
    name: "", styleDescription: "", positivePrompt: "", negativePrompt: "", colorPalette: "", lightingStyle: "", cameraStyle: ""
  });

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "https://api-worker.justoneteeteam.workers.dev";

  const fetchPrompts = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${apiUrl}/api/pinterest/prompts`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setPrompts(data.length ? data : DEFAULT_PROMPTS);
      } else {
        setPrompts(DEFAULT_PROMPTS);
      }
    } catch (e) {
      console.error(e);
      setPrompts(DEFAULT_PROMPTS);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrompts();
  }, []);

  const handleOpenModal = (prompt?: Prompt) => {
    if (prompt) {
      setEditingPrompt(prompt);
      setFormData(prompt);
    } else {
      setEditingPrompt(null);
      setFormData({ name: "", styleDescription: "", positivePrompt: "", negativePrompt: "", colorPalette: "", lightingStyle: "", cameraStyle: "" });
    }
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this prompt?")) return;
    try {
      const token = localStorage.getItem("token");
      if (id.length > 5) {
        await fetch(`${apiUrl}/api/pinterest/prompts/${id}`, {
          method: "DELETE", headers: { "Authorization": `Bearer ${token}` }
        });
      }
      setPrompts(prev => prev.filter(p => p.id !== id));
    } catch (e) { console.error(e); }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem("token");
      const url = editingPrompt ? `${apiUrl}/api/pinterest/prompts/${editingPrompt.id}` : `${apiUrl}/api/pinterest/prompts`;
      const method = editingPrompt ? "PUT" : "POST";
      
      const isDefaultMock = editingPrompt && editingPrompt.id.length < 5;
      
      if (!isDefaultMock) {
        await fetch(url, {
          method,
          headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify(formData)
        });
      }

      if (editingPrompt) {
        setPrompts(prev => prev.map(p => p.id === editingPrompt.id ? { ...formData, id: p.id } : p));
      } else {
        setPrompts(prev => [...prev, { ...formData, id: Math.random().toString() }]);
      }
      
      setIsModalOpen(false);
    } catch (e) { console.error(e); }
  };

  return (
    <div style={{ padding: "2rem", minHeight: "100vh" }}>
      <style dangerouslySetInnerHTML={{__html: `
        .prompt-card { background: var(--bg-primary); border: 1px solid var(--border-default); border-radius: 12px; padding: 1.5rem; display: flex; flex-direction: column; gap: 1rem; box-shadow: var(--shadow-sm); transition: transform 0.2s; }
        .prompt-card:hover { transform: translateY(-2px); box-shadow: var(--shadow-md); }
        .color-swatch { width: 24px; height: 24px; border-radius: 50%; border: 1px solid var(--border-default); display: inline-block; }
        .tag { background: var(--bg-tertiary); color: var(--text-secondary); padding: 0.25rem 0.5rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 500; }
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 50; }
        .modal-content { background: var(--bg-primary); padding: 2rem; border-radius: 12px; width: 100%; max-width: 600px; max-height: 90vh; overflow-y: auto; box-shadow: var(--shadow-lg); }
        .form-group { display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1rem; }
        .form-group label { font-size: 0.875rem; font-weight: 500; color: var(--text-primary); }
        .form-control { padding: 0.5rem; border: 1px solid var(--border-default); border-radius: 6px; font-family: inherit; font-size: 0.875rem; }
        .form-control:focus { outline: none; border-color: var(--accent); }
      `}} />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
        <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "2rem", color: "var(--text-primary)", margin: 0 }}>
          Prompt Library
        </h1>
        <button className="btn btn-primary" onClick={() => handleOpenModal()} style={{
          background: "var(--accent)", color: "white", padding: "0.5rem 1rem", borderRadius: "6px", border: "none", cursor: "pointer", fontWeight: 500
        }}>
          + Create New
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "1.5rem" }}>
        {prompts.map(prompt => (
          <div key={prompt.id} className="prompt-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <h3 style={{ margin: 0, fontSize: "1.125rem", fontWeight: 600, color: "var(--text-primary)", fontFamily: "'Space Grotesk', sans-serif" }}>{prompt.name}</h3>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button onClick={() => handleOpenModal(prompt)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}>✏️</button>
                <button onClick={() => handleDelete(prompt.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--error)" }}>🗑️</button>
              </div>
            </div>
            
            <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--text-secondary)" }}>{prompt.styleDescription}</p>
            
            <div>
              <p style={{ margin: "0 0 0.5rem 0", fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" }}>Positive Prompt snippet</p>
              <div style={{ background: "var(--bg-secondary)", padding: "0.75rem", borderRadius: "6px", fontSize: "0.875rem", color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {prompt.positivePrompt}
              </div>
            </div>

            <div>
              <p style={{ margin: "0 0 0.5rem 0", fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" }}>Palette</p>
              <div style={{ display: "flex", gap: "0.25rem" }}>
                {prompt.colorPalette.split(',').map((color, i) => (
                  <span key={i} className="color-swatch" style={{ backgroundColor: color.trim() }} title={color.trim()} />
                ))}
              </div>
            </div>

            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "auto" }}>
              <span className="tag">💡 {prompt.lightingStyle}</span>
              <span className="tag">📷 {prompt.cameraStyle}</span>
            </div>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setIsModalOpen(false)}>
          <div className="modal-content">
            <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "1.5rem", margin: "0 0 1.5rem 0" }}>
              {editingPrompt ? "Edit Prompt" : "Create Prompt"}
            </h2>
            <form onSubmit={handleSave}>
              <div className="form-group">
                <label>Name</label>
                <input required className="form-control" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
              </div>
              <div className="form-group">
                <label>Style Description</label>
                <input required className="form-control" value={formData.styleDescription} onChange={e => setFormData({...formData, styleDescription: e.target.value})} />
              </div>
              <div className="form-group">
                <label>Positive Prompt</label>
                <textarea required className="form-control" rows={3} value={formData.positivePrompt} onChange={e => setFormData({...formData, positivePrompt: e.target.value})} />
              </div>
              <div className="form-group">
                <label>Negative Prompt</label>
                <textarea className="form-control" rows={2} value={formData.negativePrompt} onChange={e => setFormData({...formData, negativePrompt: e.target.value})} />
              </div>
              <div className="form-group">
                <label>Color Palette (hex codes, comma separated)</label>
                <input className="form-control" value={formData.colorPalette} onChange={e => setFormData({...formData, colorPalette: e.target.value})} placeholder="#ffffff, #000000" />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div className="form-group">
                  <label>Lighting Style</label>
                  <input className="form-control" value={formData.lightingStyle} onChange={e => setFormData({...formData, lightingStyle: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>Camera Style</label>
                  <input className="form-control" value={formData.cameraStyle} onChange={e => setFormData({...formData, cameraStyle: e.target.value})} />
                </div>
              </div>
              
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "1rem", marginTop: "2rem" }}>
                <button type="button" onClick={() => setIsModalOpen(false)} style={{
                  padding: "0.5rem 1rem", border: "1px solid var(--border-default)", background: "transparent", borderRadius: "6px", cursor: "pointer", fontWeight: 500
                }}>Cancel</button>
                <button type="submit" style={{
                  padding: "0.5rem 1rem", border: "none", background: "var(--accent)", color: "white", borderRadius: "6px", cursor: "pointer", fontWeight: 500
                }}>Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
