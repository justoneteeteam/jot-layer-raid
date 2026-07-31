"use client";

import React, { useState, useEffect } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function PinterestGeneratePage() {
  const [themes, setThemes] = useState<any[]>([]);
  const [styles, setStyles] = useState<any[]>([]);
  
  const [referenceImageUrl, setReferenceImageUrl] = useState("");
  const [keyword, setKeyword] = useState("");
  const [theme, setTheme] = useState("");
  const [style, setStyle] = useState("");
  const [product, setProduct] = useState("Interior & Decor");
  const [model, setModel] = useState("flux");
  const [showPromptPreview, setShowPromptPreview] = useState(false);
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [copyFeedback, setCopyFeedback] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const fetchDropdowns = async () => {
      try {
        const token = localStorage.getItem("token");
        const headers = { Authorization: `Bearer ${token}` };
        
        const [themesRes, stylesRes] = await Promise.all([
          fetch(`${API_BASE}/api/pinterest/themes`, { headers }),
          fetch(`${API_BASE}/api/pinterest/prompts`, { headers })
        ]);
        
        if (themesRes.ok) {
          const themesData = await themesRes.json();
          setThemes(themesData);
        }
        if (stylesRes.ok) {
          const stylesData = await stylesRes.json();
          setStyles(stylesData);
        }
      } catch (error) {
        console.error("Error fetching dropdowns:", error);
      }
    };
    fetchDropdowns();
  }, []);

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopyFeedback(prev => ({ ...prev, [field]: true }));
    setTimeout(() => setCopyFeedback(prev => ({ ...prev, [field]: false })), 2000);
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    setResult(null);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/api/pinterest/generate`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          keyword,
          theme,
          style,
          product,
          referenceImageUrl,
          model
        })
      });
      const data = await res.json();
      if (data.success) {
        setResult(data);
      } else {
        alert("Generation failed");
      }
    } catch (error) {
      console.error("Generate error", error);
      alert("An error occurred during generation");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = () => {
    if (!result?.image) return;
    const link = document.createElement("a");
    link.href = `data:image/png;base64,${result.image}`;
    link.download = `pinterest-creative-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const promptPreview = `Design a Pinterest pin about ${keyword || "[keyword]"} featuring ${product || "[product]"}. Use a ${theme || "[theme]"} theme and ${style || "[style]"} aesthetic. Reference: ${referenceImageUrl || "None"}.`;

  return (
    <div style={{ display: "flex", height: "100%", minHeight: "100vh", backgroundColor: "var(--bg-secondary)" }}>
      {/* Left Panel */}
      <div style={{ width: "420px", flexShrink: 0, borderRight: "1px solid var(--border-default)", backgroundColor: "var(--bg-primary)", padding: "24px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "20px" }}>
        <h2 style={{ fontFamily: "Space Grotesk, sans-serif", fontSize: "24px", fontWeight: "600", color: "var(--text-primary)", margin: 0 }}>Create Pin</h2>
        
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <label style={{ fontSize: "14px", fontWeight: "500", color: "var(--text-primary)" }}>Reference Image URL</label>
          <input type="text" className="input" value={referenceImageUrl} onChange={e => setReferenceImageUrl(e.target.value)} placeholder="https://..." style={{ width: "100%" }} />
          {referenceImageUrl && (
            <div style={{ width: "100%", height: "120px", borderRadius: "8px", overflow: "hidden", marginTop: "8px", border: "1px solid var(--border-default)" }}>
              <img src={referenceImageUrl} alt="Reference" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={(e) => (e.target as HTMLElement).style.display = 'none'} />
            </div>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <label style={{ fontSize: "14px", fontWeight: "500", color: "var(--text-primary)" }}>Pinterest Keyword</label>
          <input type="text" className="input" value={keyword} onChange={e => setKeyword(e.target.value)} placeholder="e.g. Summer Outfits" style={{ width: "100%" }} />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <label style={{ fontSize: "14px", fontWeight: "500", color: "var(--text-primary)" }}>Theme</label>
          <select className="input" value={theme} onChange={e => setTheme(e.target.value)} style={{ width: "100%" }}>
            <option value="">Select Theme</option>
            {themes.map((t: any) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <label style={{ fontSize: "14px", fontWeight: "500", color: "var(--text-primary)" }}>Style</label>
          <select className="input" value={style} onChange={e => setStyle(e.target.value)} style={{ width: "100%" }}>
            <option value="">Select Style</option>
            {styles.map((s: any) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <label style={{ fontSize: "14px", fontWeight: "500", color: "var(--text-primary)" }}>Product</label>
          <input type="text" className="input" value={product} onChange={e => setProduct(e.target.value)} placeholder="e.g. Floral Dress" style={{ width: "100%" }} />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <label style={{ fontSize: "14px", fontWeight: "500", color: "var(--text-primary)" }}>AI Generation Model</label>
          <select className="input" value={model} onChange={e => setModel(e.target.value)} style={{ width: "100%" }}>
            <option value="flux">⚡ FLUX.1 Schnell (Cloudflare Workers AI - Free 120/day)</option>
            <option value="openai">OpenAI (gpt-image-1-mini / DALL-E)</option>
            <option value="qwen">Qwen Image (DashScope Wanx)</option>
          </select>
        </div>

        <div style={{ marginTop: "8px" }}>
          <button onClick={() => setShowPromptPreview(!showPromptPreview)} style={{ background: "none", border: "none", color: "var(--accent)", cursor: "pointer", fontSize: "14px", fontWeight: "500", padding: 0 }}>
            {showPromptPreview ? "Hide Prompt Preview" : "Show Prompt Preview"}
          </button>
          {showPromptPreview && (
            <div style={{ marginTop: "12px", padding: "12px", backgroundColor: "var(--bg-tertiary)", borderRadius: "6px", fontSize: "13px", color: "var(--text-secondary)", lineHeight: "1.5" }}>
              {promptPreview}
            </div>
          )}
        </div>

        <button className="btn btn-primary" onClick={handleGenerate} disabled={isGenerating} style={{ width: "100%", marginTop: "16px", padding: "12px", fontSize: "16px", backgroundColor: "var(--accent)" }}>
          {isGenerating ? "Generating..." : "Generate Pin"}
        </button>
      </div>

      {/* Right Panel */}
      <div style={{ flex: 1, padding: "40px", overflowY: "auto", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: isGenerating || !result ? "center" : "flex-start" }}>
        {!isGenerating && !result && (
          <div className="empty-state" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "48px", marginBottom: "16px" }}>🎨</div>
            <h3 className="empty-state-title" style={{ fontFamily: "Space Grotesk, sans-serif", fontSize: "20px", color: "var(--text-primary)", marginBottom: "8px" }}>Generate your first Pinterest image</h3>
            <p className="empty-state-text" style={{ color: "var(--text-secondary)", fontSize: "14px" }}>Fill out the details on the left and click generate to create stunning Pinterest creatives.</p>
          </div>
        )}

        {isGenerating && (
          <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" }}>
            <div style={{ width: "40px", height: "40px", border: "4px solid var(--accent-light)", borderTop: "4px solid var(--accent)", borderRadius: "50%", animation: "spin 1s linear infinite" }}></div>
            <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
            <p style={{ color: "var(--text-secondary)", fontSize: "16px", fontWeight: "500" }}>Generating your Pinterest creative...</p>
          </div>
        )}

        {result && !isGenerating && (
          <div style={{ width: "100%", maxWidth: "800px", display: "flex", flexDirection: "column", gap: "32px", animation: "fadeIn 0.5s ease-out" }}>
            <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }`}</style>
            
            <div style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
              <div style={{ maxWidth: "500px", width: "100%", borderRadius: "12px", overflow: "hidden", boxShadow: "var(--shadow-lg)" }}>
                <img src={result.r2Url ? result.r2Url : `data:image/png;base64,${result.image}`} alt="Generated Pin" style={{ width: "100%", display: "block" }} />
              </div>

              {result.r2Url && (
                <div style={{ display: "flex", alignItems: "center", gap: "8px", backgroundColor: "var(--bg-tertiary)", padding: "8px 16px", borderRadius: "8px", border: "1px solid var(--border-default)", maxWidth: "500px", width: "100%" }}>
                  <span style={{ fontSize: "12px", fontWeight: "600", color: "var(--accent)" }}>R2 Link:</span>
                  <input type="text" readOnly value={result.r2Url} style={{ flex: 1, border: "none", background: "transparent", fontSize: "12px", fontFamily: "monospace" }} />
                  <button className="btn btn-ghost" onClick={() => handleCopy(result.r2Url, 'r2Url')} style={{ fontSize: "12px", padding: "2px 8px" }}>
                    {copyFeedback['r2Url'] ? "✓ Copied!" : "Copy URL"}
                  </button>
                </div>
              )}
            </div>

            <div style={{ display: "flex", justifyContent: "center", gap: "16px" }}>
              <button className="btn btn-primary" onClick={handleDownload} style={{ backgroundColor: "var(--accent)" }}>Download PNG</button>
              <button className="btn btn-secondary" onClick={handleGenerate}>Regenerate</button>
            </div>

            <div className="card" style={{ padding: "24px" }}>
              <h3 style={{ fontFamily: "Space Grotesk, sans-serif", fontSize: "20px", fontWeight: "600", marginBottom: "24px", color: "var(--text-primary)" }}>SEO Metadata & R2 Storage</h3>
              
              <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <label style={{ fontSize: "14px", fontWeight: "600", color: "var(--text-primary)" }}>Pin Title</label>
                    <button className="btn btn-ghost" onClick={() => handleCopy(result.metadata.title, 'title')} style={{ fontSize: "12px", padding: "4px 8px" }}>
                      {copyFeedback['title'] ? "✓ Copied!" : "Copy"}
                    </button>
                  </div>
                  <div style={{ padding: "12px", backgroundColor: "var(--bg-tertiary)", borderRadius: "6px", fontSize: "15px" }}>{result.metadata.title}</div>
                </div>

                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <label style={{ fontSize: "14px", fontWeight: "600", color: "var(--text-primary)" }}>Pin Description</label>
                    <button className="btn btn-ghost" onClick={() => handleCopy(result.metadata.description, 'description')} style={{ fontSize: "12px", padding: "4px 8px" }}>
                      {copyFeedback['description'] ? "✓ Copied!" : "Copy"}
                    </button>
                  </div>
                  <div style={{ padding: "12px", backgroundColor: "var(--bg-tertiary)", borderRadius: "6px", fontSize: "14px", lineHeight: "1.6" }}>{result.metadata.description}</div>
                </div>

                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <label style={{ fontSize: "14px", fontWeight: "600", color: "var(--text-primary)" }}>Tags</label>
                    <button className="btn btn-ghost" onClick={() => handleCopy(result.metadata.tags.join(', '), 'tags')} style={{ fontSize: "12px", padding: "4px 8px" }}>
                      {copyFeedback['tags'] ? "✓ Copied!" : "Copy All"}
                    </button>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                    {result.metadata.tags.map((tag: string, i: number) => (
                      <span key={i} className="badge" style={{ backgroundColor: "var(--accent-light)", color: "var(--accent-hover)", padding: "4px 12px", borderRadius: "16px", fontSize: "13px", fontWeight: "500" }}>#{tag}</span>
                    ))}
                  </div>
                </div>

                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <label style={{ fontSize: "14px", fontWeight: "600", color: "var(--text-primary)" }}>Alt Text</label>
                    <button className="btn btn-ghost" onClick={() => handleCopy(result.metadata.altText, 'altText')} style={{ fontSize: "12px", padding: "4px 8px" }}>
                      {copyFeedback['altText'] ? "✓ Copied!" : "Copy"}
                    </button>
                  </div>
                  <div style={{ padding: "12px", backgroundColor: "var(--bg-tertiary)", borderRadius: "6px", fontSize: "14px", color: "var(--text-secondary)" }}>{result.metadata.altText}</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
