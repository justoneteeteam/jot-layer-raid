"use client";

import React, { useEffect, useState } from "react";

interface Settings {
  defaultModel: string;
  defaultSize: string;
  defaultFormat: string;
  autoRetry: string;
  seoModel: string;
  qwenApiKey: string;
  openaiApiKey: string;
  deepseekApiKey: string;
}

export default function PinterestSettings() {
  const [settings, setSettings] = useState<Settings>({
    defaultModel: "qwen",
    defaultSize: "1000x1500",
    defaultFormat: "png",
    autoRetry: "1",
    seoModel: "deepseek",
    qwenApiKey: "",
    openaiApiKey: "",
    deepseekApiKey: "",
  });
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ show: boolean, message: string }>({ show: false, message: "" });

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(`${apiUrl}/api/pinterest/settings`, {
          headers: { "Authorization": `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setSettings(prev => ({ ...prev, ...data }));
        }
      } catch (e) {
        console.error("Failed to fetch settings", e);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, [apiUrl]);

  const showToast = (message: string) => {
    setToast({ show: true, message });
    setTimeout(() => setToast({ show: false, message: "" }), 3000);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem("token");
      await fetch(`${apiUrl}/api/pinterest/settings`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(settings)
      });
      showToast("Settings saved successfully!");
    } catch (e) {
      console.error("Failed to save", e);
      showToast("Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div style={{ padding: "2rem" }}>Loading settings...</div>;
  }

  return (
    <div style={{ padding: "2rem", minHeight: "100vh", position: "relative" }}>
      <style dangerouslySetInnerHTML={{__html: `
        .settings-section { background: var(--bg-primary); border: 1px solid var(--border-default); border-radius: 12px; padding: 1.5rem; margin-bottom: 1.5rem; box-shadow: var(--shadow-sm); }
        .settings-title { font-family: 'Space Grotesk', sans-serif; font-size: 1.25rem; color: var(--text-primary); margin: 0 0 1rem 0; border-bottom: 1px solid var(--border-default); padding-bottom: 0.75rem; }
        .setting-row { display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1rem; }
        .setting-row:last-child { margin-bottom: 0; }
        .setting-label { font-size: 0.875rem; font-weight: 500; color: var(--text-primary); }
        .setting-desc { font-size: 0.75rem; color: var(--text-muted); margin-top: -0.25rem; }
        .form-control { padding: 0.5rem; border: 1px solid var(--border-default); border-radius: 6px; font-family: inherit; font-size: 0.875rem; background: var(--bg-primary); }
        .form-control:focus { outline: none; border-color: var(--accent); }
        .form-control:disabled { background: var(--bg-tertiary); color: var(--text-muted); cursor: not-allowed; }
        .radio-group { display: flex; gap: 1rem; }
        .radio-label { display: flex; align-items: center; gap: 0.5rem; font-size: 0.875rem; cursor: pointer; }
        
        @keyframes slideIn { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .toast { position: fixed; bottom: 2rem; right: 2rem; background: var(--success); color: white; padding: 1rem 1.5rem; border-radius: 8px; box-shadow: var(--shadow-lg); font-weight: 500; animation: slideIn 0.3s ease forwards; z-index: 100; }
      `}} />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
        <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "2rem", color: "var(--text-primary)", margin: 0 }}>
          Pinterest Settings
        </h1>
        <button onClick={handleSave} disabled={saving} style={{
          background: "var(--accent)", color: "white", padding: "0.5rem 1.5rem", borderRadius: "6px", border: "none", cursor: saving ? "wait" : "pointer", fontWeight: 600, fontSize: "0.875rem", transition: "background 0.2s"
        }}>
          {saving ? "Saving..." : "Save Settings"}
        </button>
      </div>

      <div style={{ maxWidth: "800px" }}>
        <section className="settings-section">
          <h2 className="settings-title">Generation Preferences</h2>
          
          <div className="setting-row">
            <span className="setting-label">Default Model</span>
            <div className="radio-group">
              <label className="radio-label">
                <input type="radio" name="defaultModel" value="qwen" checked={settings.defaultModel === "qwen"} onChange={(e) => setSettings({...settings, defaultModel: e.target.value})} />
                Qwen Image
              </label>
              <label className="radio-label">
                <input type="radio" name="defaultModel" value="openai" checked={settings.defaultModel === "openai"} onChange={(e) => setSettings({...settings, defaultModel: e.target.value})} />
                OpenAI DALL-E
              </label>
            </div>
            <span className="setting-desc">The primary AI model used for generating pin images.</span>
          </div>

          <div className="setting-row">
            <label className="setting-label">Default Size</label>
            <input type="text" className="form-control" value={settings.defaultSize} disabled />
            <span className="setting-desc">Standard Pinterest pin aspect ratio (2:3). Currently locked to 1000x1500.</span>
          </div>

          <div className="setting-row">
            <label className="setting-label">Default Format</label>
            <input type="text" className="form-control" value={settings.defaultFormat.toUpperCase()} disabled />
            <span className="setting-desc">File format for generated images.</span>
          </div>

          <div className="setting-row">
            <label className="setting-label">Auto Retry</label>
            <select className="form-control" value={settings.autoRetry} onChange={(e) => setSettings({...settings, autoRetry: e.target.value})} style={{ maxWidth: "200px" }}>
              <option value="1">1 Attempt</option>
              <option value="2">2 Attempts</option>
              <option value="3">3 Attempts</option>
            </select>
            <span className="setting-desc">Number of times to retry generation if an error occurs.</span>
          </div>
        </section>

        <section className="settings-section">
          <h2 className="settings-title">SEO & Metadata</h2>
          
          <div className="setting-row">
            <label className="setting-label">SEO Generation Model</label>
            <input type="text" className="form-control" value={settings.seoModel.charAt(0).toUpperCase() + settings.seoModel.slice(1)} disabled />
            <span className="setting-desc">The LLM used to generate Pin titles, descriptions, and hashtags.</span>
          </div>
        </section>

        <section className="settings-section">
          <h2 className="settings-title">API Keys</h2>
          
          <div className="setting-row">
            <label className="setting-label">Qwen API Key</label>
            <input type="password" className="form-control" value={settings.qwenApiKey} onChange={(e) => setSettings({...settings, qwenApiKey: e.target.value})} placeholder="sk-..." />
          </div>

          <div className="setting-row">
            <label className="setting-label">OpenAI API Key</label>
            <input type="password" className="form-control" value={settings.openaiApiKey} onChange={(e) => setSettings({...settings, openaiApiKey: e.target.value})} placeholder="sk-..." />
          </div>

          <div className="setting-row">
            <label className="setting-label">DeepSeek API Key</label>
            <input type="password" className="form-control" value={settings.deepseekApiKey} onChange={(e) => setSettings({...settings, deepseekApiKey: e.target.value})} placeholder="sk-..." />
          </div>
        </section>
      </div>

      {toast.show && (
        <div className="toast">
          ✓ {toast.message}
        </div>
      )}
    </div>
  );
}
