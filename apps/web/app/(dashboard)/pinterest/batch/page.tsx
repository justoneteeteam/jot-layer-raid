"use client";

import React, { useState, useEffect } from "react";
import { formatR2ImageUrl } from "../../../lib/api";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface CombinationItem {
  imageUrl: string;
  keyword: string;
  theme: string;
  style: string;
  product: string;
}

const DEFAULT_THEMES = ["General", "Summer", "Fall", "Christmas", "Japandi", "Spring", "Modern Living"];
const DEFAULT_STYLES = ["Modern Scandinavian", "Luxury Interior", "Boho Chic", "Minimalist", "Cozy Warm", "Industrial Minimal"];

export default function PinterestBatchPage() {
  const [step, setStep] = useState(1);

  // Flow Step 1: Input image links (1 URL per line)
  const [imageUrlsText, setImageUrlsText] = useState("");

  // Flow Step 2 & 3: Multi-select Theme, Style (Checkboxes) & Keywords
  const [availableThemes, setAvailableThemes] = useState<string[]>(DEFAULT_THEMES);
  const [availableStyles, setAvailableStyles] = useState<string[]>(DEFAULT_STYLES);
  const [selectedThemes, setSelectedThemes] = useState<string[]>(["General", "Summer"]);
  const [selectedStyles, setSelectedStyles] = useState<string[]>(["Modern Scandinavian", "Luxury Interior"]);
  const [keywordsText, setKeywordsText] = useState("small apartment decor, cozy aesthetic living room");
  const [product, setProduct] = useState("Interior & Decor");
  const [model, setModel] = useState("flux");
  const [destinationLink, setDestinationLink] = useState("");

  // Custom Prompt Template
  const [customPromptPrefix, setCustomPromptPrefix] = useState("Design a completely new interior creative with");

  // Flow Step 4: Combination Matrix
  const [combinations, setCombinations] = useState<CombinationItem[]>([]);

  // Execution & Progress
  const [jobId, setJobId] = useState("");
  const [progress, setProgress] = useState(0);
  const [completed, setCompleted] = useState(0);
  const [failed, setFailed] = useState(0);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState("");

  // Flow Step 5: Live Preview of Generated Images from R2
  const [generatedResults, setGeneratedResults] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  useEffect(() => {
    fetchThemesAndStyles();
  }, []);

  const fetchThemesAndStyles = async () => {
    try {
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };
      const [tRes, sRes] = await Promise.all([
        fetch(`${API_BASE}/api/pinterest/themes`, { headers }),
        fetch(`${API_BASE}/api/pinterest/prompts`, { headers })
      ]);
      const tData = await tRes.json();
      const sData = await sRes.json();

      if (Array.isArray(tData) && tData.length > 0) {
        const names = Array.from(new Set([...tData.map((t: any) => t.name), ...DEFAULT_THEMES]));
        setAvailableThemes(names);
      }
      if (Array.isArray(sData) && sData.length > 0) {
        const names = Array.from(new Set([...sData.map((s: any) => s.name), ...DEFAULT_STYLES]));
        setAvailableStyles(names);
      }
    } catch (e) {
      console.error("Failed to load themes/styles", e);
    }
  };

  // Step 1 -> Step 2
  const handleParseImages = () => {
    const urls = imageUrlsText.split("\n").map(u => u.trim()).filter(u => u.startsWith("http"));
    if (urls.length === 0) {
      alert("Please enter at least one valid image URL starting with http:// or https://");
      return;
    }
    setStep(2);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        setImageUrlsText(text);
      };
      reader.readAsText(file);
    }
  };

  const toggleThemeCheckbox = (name: string) => {
    setSelectedThemes(prev =>
      prev.includes(name) ? prev.filter(t => t !== name) : [...prev, name]
    );
  };

  const toggleStyleCheckbox = (name: string) => {
    setSelectedStyles(prev =>
      prev.includes(name) ? prev.filter(s => s !== name) : [...prev, name]
    );
  };

  // Step 2 & 3 -> Step 4 Matrix Review
  const buildCombinationMatrix = () => {
    const urls = imageUrlsText.split("\n").map(u => u.trim()).filter(u => u.startsWith("http"));
    const keywords = keywordsText.split(",").map(k => k.trim()).filter(Boolean);
    const themes = selectedThemes.length > 0 ? selectedThemes : ["General"];
    const styles = selectedStyles.length > 0 ? selectedStyles : ["Modern"];

    if (urls.length === 0) {
      alert("No image URLs provided.");
      return;
    }
    if (keywords.length === 0) {
      alert("Please enter at least one keyword.");
      return;
    }

    const items: CombinationItem[] = [];
    for (const url of urls) {
      for (const kw of keywords) {
        for (const th of themes) {
          for (const st of styles) {
            items.push({
              imageUrl: url,
              keyword: kw,
              theme: th,
              style: st,
              product: product || "Interior Decor"
            });
          }
        }
      }
    }

    setCombinations(items);
    setTotal(items.length);
    setStep(3);
  };

  // Step 4: Execute Batch Generation
  const startBatch = async () => {
    const urls = imageUrlsText.split("\n").map(u => u.trim()).filter(u => u.startsWith("http"));
    const keywords = keywordsText.split(",").map(k => k.trim()).filter(Boolean);
    const themes = selectedThemes.length > 0 ? selectedThemes : ["General"];
    const styles = selectedStyles.length > 0 ? selectedStyles : ["Modern"];

    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/api/pinterest/batch`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          imageUrls: urls,
          keywords,
          themes,
          styles,
          product,
          generateImages: true,
          generateSeo: true,
          model
        })
      });
      const data = await res.json();
      if (data.jobId) {
        setJobId(data.jobId);
        setStep(4);
        setStatus("running");
        pollStatus(data.jobId);
      }
    } catch (e) {
      console.error("Failed to start batch", e);
      alert("Error starting batch job.");
    }
  };

  const pollStatus = (id: string) => {
    const interval = setInterval(async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(`${API_BASE}/api/pinterest/batch/${id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();

        const comp = data.completed || 0;
        const fail = data.failed || 0;
        const tot = data.total || total || 1;

        setCompleted(comp);
        setFailed(fail);
        setProgress(((comp + fail) / tot) * 100);

        if (data.status === "completed" || data.status === "failed") {
          clearInterval(interval);
          setStatus(data.status);
          fetchGeneratedHistory();
          setStep(5);
        }
      } catch (e) {
        console.error("Polling error", e);
      }
    }, 3000);
  };

  const fetchGeneratedHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/api/pinterest/history`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setGeneratedResults(data);
      }
    } catch (e) {
      console.error("Failed to fetch generated history", e);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Step 6: Export (.txt / TSV and .csv formats)
  const exportPinterestTXT = async () => {
    try {
      const token = localStorage.getItem("token");
      const linkParam = destinationLink.trim() ? `?link=${encodeURIComponent(destinationLink.trim())}` : "";
      const res = await fetch(`${API_BASE}/api/pinterest/export/pinterest-txt${linkParam}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to export Pinterest TXT");
      const blob = await res.blob();
      const now = new Date();
      const dd = String(now.getDate()).padStart(2, "0");
      const mm = String(now.getMonth() + 1).padStart(2, "0");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `pinterest-bulk-upload-${dd}-${mm}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert("Failed to download Pinterest TXT export.");
    }
  };

  const exportPinterestCSV = async () => {
    try {
      const token = localStorage.getItem("token");
      const linkParam = destinationLink.trim() ? `?link=${encodeURIComponent(destinationLink.trim())}` : "";
      const res = await fetch(`${API_BASE}/api/pinterest/export/pinterest-csv${linkParam}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to export Pinterest CSV");
      const blob = await res.blob();
      const now = new Date();
      const dd = String(now.getDate()).padStart(2, "0");
      const mm = String(now.getMonth() + 1).padStart(2, "0");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `pinterest-bulk-upload-${dd}-${mm}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert("Failed to download Pinterest CSV export.");
    }
  };

  const exportCSV = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/api/pinterest/export/csv`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to export CSV");
      const blob = await res.blob();
      const now = new Date();
      const dd = String(now.getDate()).padStart(2, "0");
      const mm = String(now.getMonth() + 1).padStart(2, "0");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `pinterest-trends-${dd}-${mm}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert("Failed to download CSV export.");
    }
  };

  const [selectedAccountChannel, setSelectedAccountChannel] = useState("account-main");
  const [accountChannels, setAccountChannels] = useState([
    { id: "account-main", name: "Pinterest Account #1 (Main Store)", domain: "https://vulius.com" },
    { id: "nailbox", name: "Pinterest Account #2 (NfcWest / Niche)", domain: "https://nfcwestjersey.com/" }
  ]);

  const steps = [
    "1. Account & RSS",
    "2. Image Links",
    "3. Themes & Styles",
    "4. Generating",
    "5. Preview & Export"
  ];

  return (
    <div style={{ padding: "32px", minHeight: "100vh", backgroundColor: "var(--bg-secondary)", display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ width: "100%", maxWidth: "1000px" }}>
        
        {/* Header Title */}
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <h1 style={{ fontFamily: "Space Grotesk, sans-serif", fontSize: "32px", fontWeight: "700", color: "var(--text-primary)", marginBottom: "8px" }}>
            Pinterest Creative Studio & Batch Generator
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "14px" }}>
            Transform reference image URLs into original AI creatives stored on R2 with complete SEO metadata
          </p>
        </div>

        {/* Step Indicators */}
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "32px", position: "relative" }}>
          <div style={{ position: "absolute", top: "14px", left: "0", right: "0", height: "2px", backgroundColor: "var(--border-default)", zIndex: 0 }}></div>
          <div style={{ position: "absolute", top: "14px", left: "0", width: `${((step - 1) / (steps.length - 1)) * 100}%`, height: "2px", backgroundColor: "var(--accent)", zIndex: 0, transition: "width 0.3s ease" }}></div>

          {steps.map((label, idx) => (
            <div key={idx} style={{ display: "flex", flexDirection: "column", alignItems: "center", zIndex: 1, gap: "6px" }}>
              <div style={{ width: "30px", height: "30px", borderRadius: "50%", backgroundColor: step > idx ? "var(--accent)" : "var(--bg-primary)", border: step > idx ? "2px solid var(--accent)" : "2px solid var(--border-default)", color: step > idx ? "white" : "var(--text-muted)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "600", fontSize: "13px", transition: "all 0.3s ease" }}>
                {idx + 1}
              </div>
              <span style={{ fontSize: "12px", fontWeight: "500", color: step > idx ? "var(--text-primary)" : "var(--text-muted)" }}>{label}</span>
            </div>
          ))}
        </div>

        {/* Step Cards */}
        <div className="card" style={{ padding: "32px", borderRadius: "16px", border: "1px solid var(--border-default)", backgroundColor: "var(--bg-primary)" }}>
          
          {/* STEP 1: Select Target Pinterest Account Channel */}
          {step === 1 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
              <div>
                <h2 style={{ fontSize: "20px", fontWeight: "700", color: "var(--text-primary)", margin: 0 }}>
                  1. Select Pinterest Account Channel & Reconfirm RSS
                </h2>
                <p style={{ color: "var(--text-secondary)", fontSize: "14px", marginTop: "4px" }}>
                  Choose which Pinterest Account Channel will receive this generated batch.
                </p>
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontWeight: "600", fontSize: "14px" }}>
                  Target Pinterest Account Channel
                </label>
                <select
                  className="input"
                  value={selectedAccountChannel}
                  onChange={(e) => {
                    setSelectedAccountChannel(e.target.value);
                    const found = accountChannels.find(c => c.id === e.target.value);
                    if (found) setDestinationLink(found.domain);
                  }}
                  style={{ width: "100%", padding: "12px", fontSize: "15px" }}
                >
                  {accountChannels.map(ch => (
                    <option key={ch.id} value={ch.id}>{ch.name} ({ch.domain})</option>
                  ))}
                </select>
              </div>

              {/* Reconfirm RSS Link & Domain Card */}
              <div className="card" style={{ padding: "16px 20px", borderRadius: "12px", border: "1px solid var(--accent-light)", backgroundColor: "rgba(13, 148, 136, 0.03)", display: "flex", flexDirection: "column", gap: "10px" }}>
                <div style={{ fontSize: "14px", fontWeight: "700", color: "var(--text-primary)" }}>
                  📡 Active Target RSS Feed URL for this Batch:
                </div>
                <div style={{ fontSize: "13px", fontFamily: "monospace", color: "var(--accent)", backgroundColor: "var(--bg-tertiary)", padding: "10px 14px", borderRadius: "8px", border: "1px solid var(--border-default)", wordBreak: "break-all" }}>
                  {`${API_BASE}/api/pinterest/rss/${selectedAccountChannel}?domain=${encodeURIComponent(destinationLink || "https://vulius.com")}`}
                </div>
                <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                  Claimed Domain: <strong>{destinationLink || "https://vulius.com"}</strong> — Generates zero-duplication Pins specifically for this account channel.
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "12px" }}>
                <button
                  className="btn btn-primary"
                  onClick={() => setStep(2)}
                  style={{ backgroundColor: "#E60023", color: "white", fontWeight: "600", padding: "12px 28px", borderRadius: "10px" }}
                >
                  Next: Paste Image Links →
                </button>
              </div>
            </div>
          )}

          {/* ──────────────────────────────────────────────────────────── */}
          {/* STEP 2: Input Pinterest Image Links                          */}
          {/* ──────────────────────────────────────────────────────────── */}
          {step === 2 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              <div>
                <h2 style={{ fontSize: "20px", fontWeight: "600", color: "var(--text-primary)", marginBottom: "6px" }}>
                  2. Input Reference Image URLs
                </h2>
                <p style={{ color: "var(--text-secondary)", fontSize: "13px" }}>
                  Enter reference image URLs (one URL per line) or upload a plain text/CSV file. Each image link will be processed as a separate creative base.
                </p>
              </div>

              <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                <label className="btn btn-secondary" style={{ cursor: "pointer" }}>
                  📁 Upload File / CSV
                  <input type="file" accept=".csv,.txt" onChange={handleFileUpload} style={{ display: "none" }} />
                </label>
                <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>Accepts .txt or .csv containing image URLs</span>
              </div>

              <div className="form-group">
                <label className="form-label">Pinterest Image URLs (1 link per line)</label>
                <textarea
                  className="input"
                  rows={8}
                  value={imageUrlsText}
                  onChange={(e) => setImageUrlsText(e.target.value)}
                  placeholder="https://images.unsplash.com/photo-1586023492125-27b2c045efd7&#10;https://images.unsplash.com/photo-1618221195710-dd6b41faaea6"
                  style={{ width: "100%", fontFamily: "monospace", fontSize: "13px", lineHeight: "1.5" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", marginTop: "12px" }}>
                <button
                  className="btn btn-secondary"
                  onClick={() => setStep(1)}
                >
                  ← Back to Account Setup
                </button>
                <button
                  className="btn btn-primary"
                  onClick={handleParseImages}
                  style={{ backgroundColor: "var(--accent)", color: "white", padding: "10px 24px", fontSize: "14px", fontWeight: "600" }}
                >
                  Next: Choose Themes & Styles →
                </button>
              </div>
            </div>
          )}

          {/* ──────────────────────────────────────────────────────────── */}
          {/* STEP 3: Choose Theme + Style (Checkboxes) & Prompt Design    */}
          {/* ──────────────────────────────────────────────────────────── */}
          {step === 3 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
              <div>
                <h2 style={{ fontSize: "20px", fontWeight: "600", color: "var(--text-primary)", marginBottom: "6px" }}>
                  3. Select Themes, Styles & Combine Design Prompts
                </h2>
                <p style={{ color: "var(--text-secondary)", fontSize: "13px" }}>
                  Tick the checkboxes for the themes and visual styles to combine. Each reference image will generate a creative for every checked combination.
                </p>
              </div>

              {/* Checkboxes for Themes */}
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: "600", fontSize: "14px" }}>
                  Select Themes (Tick Checkboxes)
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "10px", marginTop: "8px" }}>
                  {availableThemes.map((themeName) => {
                    const isChecked = selectedThemes.includes(themeName);
                    return (
                      <label
                        key={themeName}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "10px",
                          padding: "10px 14px",
                          borderRadius: "10px",
                          border: isChecked ? "2px solid var(--accent)" : "1px solid var(--border-default)",
                          backgroundColor: isChecked ? "var(--accent-light)" : "var(--bg-primary)",
                          cursor: "pointer",
                          transition: "all 0.2s ease"
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleThemeCheckbox(themeName)}
                          style={{ accentColor: "var(--accent)", width: "16px", height: "16px", cursor: "pointer" }}
                        />
                        <span style={{ fontSize: "13px", fontWeight: isChecked ? "600" : "500", color: isChecked ? "var(--accent)" : "var(--text-primary)" }}>
                          {themeName}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Checkboxes for Styles */}
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: "600", fontSize: "14px" }}>
                  Select Visual Styles (Tick Checkboxes)
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "10px", marginTop: "8px" }}>
                  {availableStyles.map((styleName) => {
                    const isChecked = selectedStyles.includes(styleName);
                    return (
                      <label
                        key={styleName}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "10px",
                          padding: "10px 14px",
                          borderRadius: "10px",
                          border: isChecked ? "2px solid var(--accent)" : "1px solid var(--border-default)",
                          backgroundColor: isChecked ? "var(--accent-light)" : "var(--bg-primary)",
                          cursor: "pointer",
                          transition: "all 0.2s ease"
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleStyleCheckbox(styleName)}
                          style={{ accentColor: "var(--accent)", width: "16px", height: "16px", cursor: "pointer" }}
                        />
                        <span style={{ fontSize: "13px", fontWeight: isChecked ? "600" : "500", color: isChecked ? "var(--accent)" : "var(--text-primary)" }}>
                          {styleName}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Prompt Design Template Box */}
              <div className="card" style={{ padding: "16px", borderRadius: "12px", border: "1px solid var(--accent)", backgroundColor: "rgba(13, 148, 136, 0.04)" }}>
                <label style={{ fontSize: "13px", fontWeight: "700", color: "var(--accent)", display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
                  🎨 Prompt Design Template Combination
                </label>
                <div style={{ fontSize: "13px", color: "var(--text-primary)", fontFamily: "monospace", lineHeight: "1.6", backgroundColor: "white", padding: "12px", borderRadius: "8px", border: "1px dashed var(--border-default)" }}>
                  "{customPromptPrefix} <strong>[{selectedThemes.join(" & ") || "Theme"}]</strong> theme & <strong>[{selectedStyles.join(" & ") || "Style"}]</strong> style based on reference image link, optimized for keyword: <em>"{keywordsText.split(',')[0] || 'keyword'}"</em>."
                </div>
              </div>

              {/* Keywords Input */}
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: "600" }}>
                  Input Keywords (Comma-separated for multi-keyword generation)
                </label>
                <input
                  type="text"
                  className="input"
                  value={keywordsText}
                  onChange={(e) => setKeywordsText(e.target.value)}
                  placeholder="small apartment decor, cozy aesthetic living room"
                  style={{ width: "100%" }}
                />
              </div>

              {/* Product Subject & Model */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <div className="form-group">
                  <label className="form-label">Subject / Product Type</label>
                  <input
                    type="text"
                    className="input"
                    value={product}
                    onChange={(e) => setProduct(e.target.value)}
                    placeholder="Interior & Decor"
                    style={{ width: "100%" }}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">AI Generation Model</label>
                  <select
                    className="input"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    style={{ width: "100%" }}
                  >
                    <option value="flux">⚡ FLUX.1 Schnell (Cloudflare Workers AI - Free 120/day)</option>
                    <option value="openai">OpenAI (gpt-image-1-mini / DALL-E)</option>
                    <option value="qwen">Qwen Image (DashScope Wanx)</option>
                  </select>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", marginTop: "12px" }}>
                <button className="btn btn-secondary" onClick={() => setStep(1)}>
                  ← Back to Links
                </button>
                <button
                  className="btn btn-primary"
                  onClick={buildCombinationMatrix}
                  style={{ backgroundColor: "var(--accent)", color: "white", padding: "10px 24px", fontSize: "14px", fontWeight: "600" }}
                >
                  Next: Review Matrix ({imageUrlsText.split("\n").filter(u => u.trim().startsWith("http")).length * (keywordsText.split(",").filter(Boolean).length || 1) * (selectedThemes.length || 1) * (selectedStyles.length || 1)} items) →
                </button>
              </div>
            </div>
          )}

          {/* ──────────────────────────────────────────────────────────── */}
          {/* STEP 3: Matrix Review & Confirmation                        */}
          {/* ──────────────────────────────────────────────────────────── */}
          {step === 3 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <h2 style={{ fontSize: "20px", fontWeight: "600", color: "var(--text-primary)" }}>
                    Step 4: Review Combination Matrix ({combinations.length} Creatives)
                  </h2>
                  <p style={{ color: "var(--text-secondary)", fontSize: "13px" }}>
                    The system combined your image URLs with all checked keywords, themes, and styles. Each item will be uploaded directly to Cloudflare R2 storage.
                  </p>
                </div>
                <span className="badge" style={{ backgroundColor: "var(--accent-light)", color: "var(--accent)", padding: "6px 14px", fontSize: "13px", fontWeight: "600" }}>
                  {combinations.length} Total Jobs
                </span>
              </div>

              <div className="table-wrapper" style={{ maxHeight: "350px", overflowY: "auto", border: "1px solid var(--border-default)", borderRadius: "8px" }}>
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: "40px" }}>#</th>
                      <th>Reference Image URL</th>
                      <th>Keyword</th>
                      <th>Theme</th>
                      <th>Style</th>
                    </tr>
                  </thead>
                  <tbody>
                    {combinations.map((c, i) => (
                      <tr key={i}>
                        <td style={{ color: "var(--text-muted)", fontSize: "12px" }}>{i + 1}</td>
                        <td style={{ fontSize: "12px", fontFamily: "monospace", maxWidth: "250px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {c.imageUrl}
                        </td>
                        <td style={{ fontWeight: "500" }}>{c.keyword}</td>
                        <td><span className="badge" style={{ backgroundColor: "#F3F4F6", color: "var(--text-primary)" }}>{c.theme}</span></td>
                        <td><span className="badge" style={{ backgroundColor: "var(--accent-light)", color: "var(--accent)" }}>{c.style}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", marginTop: "12px" }}>
                <button className="btn btn-secondary" onClick={() => setStep(2)}>
                  ← Back to Options
                </button>
                <button
                  className="btn btn-primary"
                  onClick={startBatch}
                  style={{ backgroundColor: "var(--accent)", color: "white", padding: "10px 28px", fontSize: "14px", fontWeight: "600" }}
                >
                  🚀 Start Batch Generation ({combinations.length} Creatives)
                </button>
              </div>
            </div>
          )}

          {/* ──────────────────────────────────────────────────────────── */}
          {/* STEP 4: Execution Progress Bar                               */}
          {/* ──────────────────────────────────────────────────────────── */}
          {step === 4 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "32px", alignItems: "center", justifyContent: "center", padding: "40px 0" }}>
              <h2 style={{ fontSize: "24px", fontWeight: "600", margin: 0, color: "var(--text-primary)" }}>
                Generating Pinterest Creatives & Uploading to R2...
              </h2>

              <div style={{ width: "100%", maxWidth: "500px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", fontSize: "14px", fontWeight: "600" }}>
                  <span>{completed + failed} / {total} Completed</span>
                  <span>{Math.round(progress)}%</span>
                </div>
                <div style={{ width: "100%", height: "14px", backgroundColor: "var(--bg-tertiary)", borderRadius: "7px", overflow: "hidden" }}>
                  <div style={{ width: `${progress}%`, height: "100%", backgroundColor: "var(--accent)", transition: "width 0.5s ease" }}></div>
                </div>
              </div>

              <div style={{ display: "flex", gap: "32px" }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "28px", fontWeight: "700", color: "var(--success)" }}>{completed}</div>
                  <div style={{ fontSize: "12px", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "1px" }}>Success</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "28px", fontWeight: "700", color: "var(--error)" }}>{failed}</div>
                  <div style={{ fontSize: "12px", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "1px" }}>Failed</div>
                </div>
              </div>

              <div style={{ width: "40px", height: "40px", border: "4px solid var(--accent-light)", borderTop: "4px solid var(--accent)", borderRadius: "50%", animation: "spin 1s linear infinite" }}></div>
              <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
            </div>
          )}

          {/* ──────────────────────────────────────────────────────────── */}
          {/* STEP 5: Preview Generated Images from R2 & Export CSV        */}
          {/* ──────────────────────────────────────────────────────────── */}
          {step === 5 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <h2 style={{ fontSize: "24px", fontWeight: "700", color: "var(--text-primary)", margin: 0 }}>
                    🎉 Generation Complete! Live R2 Image Gallery
                  </h2>
                  <p style={{ color: "var(--text-secondary)", fontSize: "14px", marginTop: "4px" }}>
                    Generated creatives stored on Cloudflare R2 with full DeepSeek SEO metadata.
                  </p>
                </div>
                <div style={{ display: "flex", gap: "10px" }}>
                  <button
                    className="btn btn-secondary"
                    onClick={() => { setStep(1); setImageUrlsText(""); setCombinations([]); }}
                  >
                    Start New Batch
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={exportPinterestTXT}
                    style={{ backgroundColor: "#E60023", color: "white", fontWeight: "600", padding: "10px 18px", display: "flex", alignItems: "center", gap: "6px" }}
                  >
                    📌 Export Pinterest Bulk Upload (.txt)
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={exportPinterestCSV}
                    style={{ fontWeight: "600", padding: "10px 14px" }}
                  >
                    📄 Pinterest CSV
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={exportCSV}
                    style={{ fontWeight: "600", padding: "10px 14px" }}
                  >
                    📊 Full Data CSV
                  </button>
                </div>
              </div>

              {/* Target Destination Website Link Input Card */}
              <div className="card" style={{ padding: "16px 20px", borderRadius: "12px", border: "1px solid var(--accent-light)", backgroundColor: "rgba(13, 148, 136, 0.03)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "20px" }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: "14px", fontWeight: "700", color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
                    🌐 Target Destination Website Link (Populates into 'Link' column in Pinterest CSV Export)
                  </label>
                  <input
                    type="url"
                    className="input"
                    value={destinationLink}
                    onChange={(e) => setDestinationLink(e.target.value)}
                    placeholder="https://yourwebsite.com/product-landing-page"
                    style={{ width: "100%", backgroundColor: "white" }}
                  />
                </div>
                <div style={{ fontSize: "12px", color: "var(--text-secondary)", maxWidth: "260px", lineHeight: "1.4" }}>
                  💡 Enter your store or website destination link here. It will automatically populate the <strong>Link</strong> column in your exported <strong>Pinterest Bulk Upload CSV</strong>.
                </div>
              </div>

              {/* Generated Images Grid Preview */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "20px", marginTop: "12px" }}>
                {generatedResults.map((item: any) => (
                  <div key={item.id} className="card" style={{ padding: "16px", borderRadius: "12px", border: "1px solid var(--border-default)", backgroundColor: "var(--bg-primary)", display: "flex", flexDirection: "column", gap: "12px" }}>
                    
                    {/* R2 Generated Image Preview */}
                    <div style={{ width: "100%", height: "240px", borderRadius: "8px", overflow: "hidden", backgroundColor: "#F3F4F6", position: "relative" }}>
                      {item.generatedImageUrl ? (
                        <img
                          src={formatR2ImageUrl(item.generatedImageUrl)}
                          alt={item.seoAltText || item.keyword}
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            if (item.generatedImageUrl && !target.dataset.retried) {
                              target.dataset.retried = "true";
                              target.src = item.generatedImageUrl;
                            }
                          }}
                        />
                      ) : (
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-muted)", fontSize: "13px" }}>
                          🖼️ R2 Image Link Saved
                        </div>
                      )}
                    </div>

                    {/* SEO Pin Metadata */}
                    <div>
                      <span className="badge" style={{ backgroundColor: "var(--accent-light)", color: "var(--accent)", fontSize: "11px", marginBottom: "4px" }}>
                        {item.theme || "General"} • {item.style || "Modern"}
                      </span>
                      <h4 style={{ fontSize: "14px", fontWeight: "600", color: "var(--text-primary)", margin: "4px 0" }}>
                        {item.seoTitle || item.keyword}
                      </h4>
                      <p style={{ fontSize: "12px", color: "var(--text-secondary)", lineHeight: "1.4", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                        {item.seoDescription || "Pinterest optimized description..."}
                      </p>
                    </div>

                    {/* Direct R2 Link Copy Button */}
                    <div style={{ marginTop: "auto", paddingTop: "8px", borderTop: "1px solid var(--border-default)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "monospace" }}>
                        R2 Stored
                      </span>
                      {item.generatedImageUrl && (
                        <button
                          className="btn btn-ghost"
                          style={{ fontSize: "12px", padding: "4px 8px", color: "var(--accent)" }}
                          onClick={() => {
                            navigator.clipboard.writeText(item.generatedImageUrl);
                            alert("R2 Image Link copied to clipboard!");
                          }}
                        >
                          🔗 Copy R2 Link
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {generatedResults.length === 0 && (
                <div style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)", fontSize: "14px" }}>
                  No previous entries found. Run your first batch to see generated R2 images here!
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
