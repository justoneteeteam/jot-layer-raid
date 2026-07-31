"use client";

import React, { useEffect, useState } from "react";

interface Theme {
  id: string;
  name: string;
  season: string;
  mood: string;
  colorPalette: string;
  decorElements: string;
  recommendedStyles: string;
}

const DEFAULT_THEMES = [
  { id: "1", name: "Summer Refresh", season: "Summer", mood: "Vibrant, fresh, and breezy", colorPalette: "#ffeb3b, #03a9f4, #4caf50, #ffffff, #ff9800", decorElements: "linen pillows, citrus bowls, sheer curtains, indoor plants, rattan chairs", recommendedStyles: "Coastal, Boho, Modern Bright" },
  { id: "2", name: "Cozy Fall", season: "Fall", mood: "Warm, inviting, and textured", colorPalette: "#d84315, #ff8f00, #5d4037, #8d6e63, #efebe9", decorElements: "knit throws, pumpkins, amber glass, wood logs, dried pampas", recommendedStyles: "Rustic, Farmhouse, Traditional" },
  { id: "3", name: "Christmas Magic", season: "Winter", mood: "Festive, glowing, and nostalgic", colorPalette: "#b71c1c, #1b5e20, #ffd54f, #ffffff, #3e2723", decorElements: "garlands, warm fairy lights, velvet stockings, pinecones, brass candlesticks", recommendedStyles: "Traditional, Luxury, Cozy Scandinavian" },
  { id: "4", name: "Spooky Halloween", season: "Fall", mood: "Moody, dark, and playful", colorPalette: "#212121, #e65100, #4a148c, #616161, #bdbdbd", decorElements: "black candles, faux cobwebs, matte black pumpkins, vintage mirrors", recommendedStyles: "Gothic, Maximalist, Moody Vintage" },
  { id: "5", name: "Back to School", season: "Late Summer", mood: "Organized, focused, and energetic", colorPalette: "#1565c0, #fbc02d, #e53935, #fafafa, #424242", decorElements: "corkboards, desk organizers, wire baskets, modern clocks", recommendedStyles: "Mid-Century Modern, Minimalist Desk" },
  { id: "6", name: "Black Friday Sale", season: "Fall", mood: "Sleek, urgent, and premium", colorPalette: "#000000, #ff1744, #ffffff, #9e9e9e, #212121", decorElements: "bold typography posters, clean surfaces, spotlighting, premium packaging mockups", recommendedStyles: "Ultra Modern, Minimalist, Commercial" },
  { id: "7", name: "Valentine's Romance", season: "Winter", mood: "Soft, romantic, and elegant", colorPalette: "#d81b60, #f8bbd0, #c2185b, #ffffff, #fff0f5", decorElements: "silk fabrics, rose petals, soft pink candles, crystal glasses, velvet chairs", recommendedStyles: "Parisian Chic, Glam, Soft Modern" },
  { id: "8", name: "Mother's Day", season: "Spring", mood: "Gentle, blooming, and appreciative", colorPalette: "#e1bee7, #ce93d8, #f48fb1, #f1f8e9, #ffffff", decorElements: "fresh peonies, pastel ceramics, breakfast trays, lace napkins", recommendedStyles: "Cottagecore, Shabby Chic, Light & Airy" },
];

export default function ThemeLibrary() {
  const [themes, setThemes] = useState<Theme[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTheme, setEditingTheme] = useState<Theme | null>(null);

  const [formData, setFormData] = useState({
    name: "", season: "", mood: "", colorPalette: "", decorElements: "", recommendedStyles: ""
  });

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  const fetchThemes = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${apiUrl}/api/pinterest/themes`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setThemes(data.length ? data : DEFAULT_THEMES);
      } else {
        setThemes(DEFAULT_THEMES);
      }
    } catch (e) {
      console.error(e);
      setThemes(DEFAULT_THEMES);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchThemes();
  }, []);

  const handleOpenModal = (theme?: Theme) => {
    if (theme) {
      setEditingTheme(theme);
      setFormData(theme);
    } else {
      setEditingTheme(null);
      setFormData({ name: "", season: "", mood: "", colorPalette: "", decorElements: "", recommendedStyles: "" });
    }
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this theme?")) return;
    try {
      const token = localStorage.getItem("token");
      if (id.length > 5) {
        await fetch(`${apiUrl}/api/pinterest/themes/${id}`, {
          method: "DELETE", headers: { "Authorization": `Bearer ${token}` }
        });
      }
      setThemes(prev => prev.filter(t => t.id !== id));
    } catch (e) { console.error(e); }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem("token");
      const url = editingTheme ? `${apiUrl}/api/pinterest/themes/${editingTheme.id}` : `${apiUrl}/api/pinterest/themes`;
      const method = editingTheme ? "PUT" : "POST";
      
      const isDefaultMock = editingTheme && editingTheme.id.length < 5;
      
      if (!isDefaultMock) {
        await fetch(url, {
          method,
          headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify(formData)
        });
      }

      if (editingTheme) {
        setThemes(prev => prev.map(t => t.id === editingTheme.id ? { ...formData, id: t.id } : t));
      } else {
        setThemes(prev => [...prev, { ...formData, id: Math.random().toString() }]);
      }
      
      setIsModalOpen(false);
    } catch (e) { console.error(e); }
  };

  const getSeasonColor = (season: string) => {
    const s = season.toLowerCase();
    if (s.includes('summer')) return { bg: '#FFF9C4', text: '#F57F17' };
    if (s.includes('fall') || s.includes('autumn')) return { bg: '#FFE0B2', text: '#E65100' };
    if (s.includes('winter')) return { bg: '#E3F2FD', text: '#0D47A1' };
    if (s.includes('spring')) return { bg: '#E8F5E9', text: '#1B5E20' };
    return { bg: 'var(--bg-tertiary)', text: 'var(--text-secondary)' };
  };

  return (
    <div style={{ padding: "2rem", minHeight: "100vh" }}>
      <style dangerouslySetInnerHTML={{__html: `
        .theme-card { background: var(--bg-primary); border: 1px solid var(--border-default); border-radius: 12px; padding: 1.5rem; display: flex; flex-direction: column; gap: 1rem; box-shadow: var(--shadow-sm); transition: transform 0.2s; }
        .theme-card:hover { transform: translateY(-2px); box-shadow: var(--shadow-md); border-color: var(--accent); }
        .color-swatch { width: 24px; height: 24px; border-radius: 4px; border: 1px solid var(--border-default); display: inline-block; }
        .tag-pill { display: inline-block; background: var(--bg-secondary); border: 1px solid var(--border-default); color: var(--text-secondary); padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.75rem; font-weight: 500; margin: 0.125rem; }
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 50; }
        .modal-content { background: var(--bg-primary); padding: 2rem; border-radius: 12px; width: 100%; max-width: 600px; max-height: 90vh; overflow-y: auto; box-shadow: var(--shadow-lg); }
        .form-group { display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1rem; }
        .form-group label { font-size: 0.875rem; font-weight: 500; color: var(--text-primary); }
        .form-control { padding: 0.5rem; border: 1px solid var(--border-default); border-radius: 6px; font-family: inherit; font-size: 0.875rem; }
        .form-control:focus { outline: none; border-color: var(--accent); }
      `}} />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
        <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "2rem", color: "var(--text-primary)", margin: 0 }}>
          Theme Library
        </h1>
        <button className="btn btn-primary" onClick={() => handleOpenModal()} style={{
          background: "var(--accent)", color: "white", padding: "0.5rem 1rem", borderRadius: "6px", border: "none", cursor: "pointer", fontWeight: 500
        }}>
          + Create Theme
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(350px, 1fr))", gap: "1.5rem" }}>
        {themes.map(theme => {
          const seasonColors = getSeasonColor(theme.season);
          return (
            <div key={theme.id} className="theme-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <h3 style={{ margin: "0 0 0.5rem 0", fontSize: "1.25rem", fontWeight: 600, color: "var(--text-primary)", fontFamily: "'Space Grotesk', sans-serif" }}>{theme.name}</h3>
                  <span style={{ 
                    background: seasonColors.bg, color: seasonColors.text, 
                    padding: "0.25rem 0.5rem", borderRadius: "9999px", fontSize: "0.75rem", fontWeight: 600, display: "inline-block"
                  }}>
                    {theme.season}
                  </span>
                </div>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button onClick={() => handleOpenModal(theme)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}>✏️</button>
                  <button onClick={() => handleDelete(theme.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--error)" }}>🗑️</button>
                </div>
              </div>
              
              <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--text-secondary)", fontStyle: "italic" }}>"{theme.mood}"</p>
              
              <div>
                <p style={{ margin: "0 0 0.5rem 0", fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" }}>Colors</p>
                <div style={{ display: "flex", gap: "0.25rem" }}>
                  {theme.colorPalette.split(',').map((color, i) => (
                    <span key={i} className="color-swatch" style={{ backgroundColor: color.trim() }} title={color.trim()} />
                  ))}
                </div>
              </div>

              <div>
                <p style={{ margin: "0 0 0.5rem 0", fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" }}>Decor Elements</p>
                <div style={{ display: "flex", flexWrap: "wrap", margin: "-0.125rem" }}>
                  {theme.decorElements.split(',').map((el, i) => (
                    <span key={i} className="tag-pill">{el.trim()}</span>
                  ))}
                </div>
              </div>

              <div style={{ marginTop: "auto", borderTop: "1px solid var(--border-default)", paddingTop: "1rem" }}>
                <p style={{ margin: "0 0 0.5rem 0", fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" }}>Recommended Styles</p>
                <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--text-primary)" }}>{theme.recommendedStyles}</p>
              </div>
            </div>
          );
        })}
      </div>

      {isModalOpen && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setIsModalOpen(false)}>
          <div className="modal-content">
            <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "1.5rem", margin: "0 0 1.5rem 0" }}>
              {editingTheme ? "Edit Theme" : "Create Theme"}
            </h2>
            <form onSubmit={handleSave}>
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "1rem" }}>
                <div className="form-group">
                  <label>Theme Name</label>
                  <input required className="form-control" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>Season</label>
                  <input required className="form-control" value={formData.season} onChange={e => setFormData({...formData, season: e.target.value})} placeholder="e.g. Fall" />
                </div>
              </div>
              <div className="form-group">
                <label>Mood</label>
                <input required className="form-control" value={formData.mood} onChange={e => setFormData({...formData, mood: e.target.value})} placeholder="Warm, inviting, etc." />
              </div>
              <div className="form-group">
                <label>Color Palette (hex codes, comma separated)</label>
                <input className="form-control" value={formData.colorPalette} onChange={e => setFormData({...formData, colorPalette: e.target.value})} placeholder="#ffffff, #000000" />
              </div>
              <div className="form-group">
                <label>Decor Elements (comma separated)</label>
                <textarea className="form-control" rows={2} value={formData.decorElements} onChange={e => setFormData({...formData, decorElements: e.target.value})} placeholder="pumpkins, warm fairy lights..." />
              </div>
              <div className="form-group">
                <label>Recommended Styles (comma separated)</label>
                <textarea className="form-control" rows={2} value={formData.recommendedStyles} onChange={e => setFormData({...formData, recommendedStyles: e.target.value})} placeholder="Rustic, Modern..." />
              </div>
              
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "1rem", marginTop: "2rem" }}>
                <button type="button" onClick={() => setIsModalOpen(false)} style={{
                  padding: "0.5rem 1rem", border: "1px solid var(--border-default)", background: "transparent", borderRadius: "6px", cursor: "pointer", fontWeight: 500
                }}>Cancel</button>
                <button type="submit" style={{
                  padding: "0.5rem 1rem", border: "none", background: "var(--accent)", color: "white", borderRadius: "6px", cursor: "pointer", fontWeight: 500
                }}>Save Theme</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
