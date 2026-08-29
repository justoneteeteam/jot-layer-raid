"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface NicheThemeDraft {
  name: string;
  description: string;
  mood?: string;
  color_palette?: string;
  season?: string;
  decor_elements?: string;
  compatible_style_names: string[];
}

interface NicheStyleDraft {
  name: string;
  style_description: string;
  positive_prompt?: string;
  negative_prompt?: string;
  color_palette?: string;
  lighting_style?: string;
  camera_style?: string;
}

interface NicheContentTypeDraft {
  name: string;
  description?: string;
}

interface NicheRecipeDraft {
  name: string;
  content_type_name: string;
  description?: string;
  prompt_template: string;
  seo_direction?: string;
  visual_params?: Record<string, any>;
}

interface NicheLibraryDraft {
  draftId: string;
  input: {
    niche: string;
    audience?: string;
    language?: string;
    market?: string;
  };
  niche_analysis: {
    target_audience: string;
    content_pillars: string[];
    seo_keywords: string[];
  };
  content_types: NicheContentTypeDraft[];
  themes: NicheThemeDraft[];
  styles: NicheStyleDraft[];
  recipes: NicheRecipeDraft[];
  createdAt: string;
}

export default function CreateNichePage() {
  const router = useRouter();

  // Wizard state: "input" | "generating" | "preview"
  const [step, setStep] = useState<"input" | "generating" | "preview">("input");

  // Form input fields
  const [nicheName, setNicheName] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [language, setLanguage] = useState("English");
  const [market, setMarket] = useState("United States");

  // Generated draft state
  const [draft, setDraft] = useState<NicheLibraryDraft | null>(null);
  const [activeTab, setActiveTab] = useState<"themes" | "styles" | "contentTypes" | "recipes" | "analysis">("themes");
  const [isApproving, setIsApproving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // JSON Raw Editor Modal
  const [isJsonModalOpen, setIsJsonModalOpen] = useState(false);
  const [jsonText, setJsonText] = useState("");

  // Warn user before navigating away with an unapproved draft
  React.useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (draft && step === "preview") {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [draft, step]);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "https://api-worker.justoneteeteam.workers.dev";

  // Trigger DeepSeek generation
  const handleGenerate = async () => {
    if (!nicheName.trim()) {
      setErrorMsg("Please enter a target niche name.");
      return;
    }

    setErrorMsg("");
    setStep("generating");

    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${apiUrl}/api/pinterest/niches/generate`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          niche: nicheName.trim(),
          audience: targetAudience.trim() || undefined,
          language,
          market
        })
      });

      const data = await res.json();
      if (res.ok && data.ok && data.draft) {
        setDraft(data.draft);
        setJsonText(JSON.stringify(data.draft, null, 2));
        setStep("preview");
      } else {
        setErrorMsg(data.error || "Generation failed. Please try again.");
        setStep("input");
      }
    } catch (e: any) {
      console.error(e);
      setErrorMsg(e.message || "Network error while calling DeepSeek.");
      setStep("input");
    }
  };

  // Approve Draft and Persist to Database
  const handleApprove = async () => {
    if (!draft) return;
    setIsApproving(true);
    setErrorMsg("");

    try {
      const token = localStorage.getItem("token");
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      // Sync local draft edits to KV before approving
      // This ensures JSON editor changes, removed themes/recipes are persisted
      const syncRes = await fetch(`${apiUrl}/api/pinterest/niches/draft/${draft.draftId}`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ draft })
      });
      if (!syncRes.ok) {
        const syncData = await syncRes.json().catch(() => ({ error: "Failed to sync draft" }));
        setErrorMsg(syncData.error || "Failed to sync draft edits before approval.");
        setIsApproving(false);
        return;
      }

      // Now approve the synced draft
      const res = await fetch(`${apiUrl}/api/pinterest/niches/draft/${draft.draftId}/approve`, {
        method: "POST",
        headers
      });

      const data = await res.json().catch(() => ({ error: "Invalid server response" }));
      if (res.ok && data.ok && data.nicheId) {
        router.push(`/pinterest/niches/${data.nicheId}`);
      } else {
        setErrorMsg(data.error || "Failed to approve and save niche.");
        setIsApproving(false);
      }
    } catch (e: any) {
      console.error(e);
      setErrorMsg(e.message || "Error saving niche to database.");
      setIsApproving(false);
    }
  };

  // Remove individual theme from draft
  const handleRemoveTheme = (index: number) => {
    if (!draft) return;
    const updatedThemes = draft.themes.filter((_, i) => i !== index);
    setDraft({ ...draft, themes: updatedThemes });
  };

  // Remove individual recipe from draft
  const handleRemoveRecipe = (index: number) => {
    if (!draft) return;
    const updatedRecipes = draft.recipes.filter((_, i) => i !== index);
    setDraft({ ...draft, recipes: updatedRecipes });
  };

  // Apply JSON edits
  const handleApplyJsonEdit = () => {
    try {
      const parsed = JSON.parse(jsonText);
      setDraft(parsed);
      setIsJsonModalOpen(false);
    } catch (err: any) {
      alert("Invalid JSON format: " + err.message);
    }
  };

  return (
    <div style={{ padding: "2rem", minHeight: "100vh", maxWidth: "1200px", margin: "0 auto" }}>
      {/* Top Breadcrumb */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "1.5rem", fontSize: "0.875rem", color: "var(--text-secondary)" }}>
        <Link href="/pinterest/niches" style={{ color: "inherit", textDecoration: "none" }}>
          Niche Libraries
        </Link>
        <span>/</span>
        <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>Create New Library</span>
      </div>

      {errorMsg && (
        <div style={{
          background: "rgba(239, 68, 68, 0.1)",
          border: "1px solid rgba(239, 68, 68, 0.3)",
          color: "#EF4444",
          padding: "1rem",
          borderRadius: "8px",
          marginBottom: "1.5rem",
          fontSize: "0.95rem"
        }}>
          ⚠️ {errorMsg}
        </div>
      )}

      {/* ── STEP 1: INPUT FORM ────────────────────────────────────────────── */}
      {step === "input" && (
        <div style={{
          background: "var(--bg-secondary)",
          borderRadius: "16px",
          border: "1px solid var(--border-default)",
          padding: "2.5rem",
          boxShadow: "var(--shadow-sm)"
        }}>
          <div style={{ marginBottom: "2rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "0.5rem" }}>
              <span style={{ fontSize: "2rem" }}>✨</span>
              <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "1.75rem", fontWeight: 700, margin: 0 }}>
                Create New Niche Library
              </h1>
            </div>
            <p style={{ color: "var(--text-secondary)", margin: 0, fontSize: "1rem" }}>
              Enter your target Pinterest niche. DeepSeek will generate themes, compatible styles, content types, and recipes automatically.
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            {/* Niche Input */}
            <div>
              <label style={{ display: "block", fontSize: "0.95rem", fontWeight: 600, marginBottom: "0.5rem" }}>
                What Pinterest niche do you want to target? <span style={{ color: "var(--accent)" }}>*</span>
              </label>
              <input
                type="text"
                className="input"
                placeholder="e.g. ChatGPT Education for Marketers, Nailbox Trends, Boho Home Decor, NFL Jersey Outfits"
                value={nicheName}
                onChange={(e) => setNicheName(e.target.value)}
                style={{ width: "100%", fontSize: "1.05rem", padding: "0.85rem 1rem" }}
                autoFocus
              />
              <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "4px", display: "block" }}>
                Tip: Be as specific as possible (e.g. "ChatGPT Prompts for Real Estate" rather than just "Real Estate").
              </span>
            </div>

            {/* Target Audience */}
            <div>
              <label style={{ display: "block", fontSize: "0.95rem", fontWeight: 600, marginBottom: "0.5rem" }}>
                Target Audience (Optional)
              </label>
              <input
                type="text"
                className="input"
                placeholder="Auto detect (or e.g. Digital marketers, freelance copywriters, agency owners)"
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
                style={{ width: "100%", padding: "0.75rem 1rem" }}
              />
            </div>

            {/* Language & Market Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.95rem", fontWeight: 600, marginBottom: "0.5rem" }}>
                  Language
                </label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="input"
                  style={{ width: "100%", padding: "0.75rem 1rem" }}
                >
                  <option value="English">English</option>
                  <option value="Spanish">Spanish (Español)</option>
                  <option value="French">French (Français)</option>
                  <option value="German">German (Deutsch)</option>
                  <option value="Italian">Italian (Italiano)</option>
                  <option value="Portuguese">Portuguese (Português)</option>
                  <option value="Vietnamese">Vietnamese (Tiếng Việt)</option>
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.95rem", fontWeight: 600, marginBottom: "0.5rem" }}>
                  Target Market / Region
                </label>
                <select
                  value={market}
                  onChange={(e) => setMarket(e.target.value)}
                  className="input"
                  style={{ width: "100%", padding: "0.75rem 1rem" }}
                >
                  <option value="United States">United States (US)</option>
                  <option value="United Kingdom">United Kingdom (UK)</option>
                  <option value="Canada">Canada (CA)</option>
                  <option value="Australia">Australia (AU)</option>
                  <option value="Global">Global / International</option>
                  <option value="European Union">European Union (EU)</option>
                </select>
              </div>
            </div>

            {/* Action Button */}
            <div style={{ paddingTop: "1.5rem", borderTop: "1px solid var(--border-subtle)", display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={handleGenerate}
                className="btn btn-primary"
                style={{
                  padding: "0.85rem 2rem",
                  fontSize: "1.05rem",
                  fontWeight: 600,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "10px"
                }}
              >
                <span>🤖</span> Generate AI Library
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── STEP 2: GENERATING LOADING STATE ─────────────────────────────── */}
      {step === "generating" && (
        <div style={{
          textAlign: "center",
          padding: "5rem 2rem",
          background: "var(--bg-secondary)",
          borderRadius: "16px",
          border: "1px solid var(--border-default)"
        }}>
          <style dangerouslySetInnerHTML={{__html: `
            @keyframes pulseProgress {
              0% { width: 10%; }
              50% { width: 75%; }
              100% { width: 95%; }
            }
          `}} />
          <div style={{ fontSize: "4rem", marginBottom: "1rem", animation: "spin 3s linear infinite" }}>🤖</div>
          <h2 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "0.75rem" }}>
            DeepSeek is analyzing "{nicheName}"...
          </h2>
          <p style={{ color: "var(--text-secondary)", maxWidth: "550px", margin: "0 auto 2rem auto", lineHeight: 1.5 }}>
            Synthesizing 5 high-impact themes, 15+ aesthetic styles, content types, and Pinterest recipes with visual prompt engineering guidelines.
          </p>

          <div style={{
            width: "350px",
            height: "8px",
            background: "var(--bg-tertiary)",
            borderRadius: "999px",
            margin: "0 auto",
            overflow: "hidden",
            border: "1px solid var(--border-subtle)"
          }}>
            <div style={{
              height: "100%",
              background: "var(--accent)",
              borderRadius: "999px",
              animation: "pulseProgress 8s ease-in-out infinite"
            }} />
          </div>
        </div>
      )}

      {/* ── STEP 3: PREVIEW & APPROVAL ───────────────────────────────────── */}
      {step === "preview" && draft && (
        <div>
          {/* Header Card */}
          <div style={{
            background: "var(--bg-secondary)",
            borderRadius: "16px",
            border: "1px solid var(--border-default)",
            padding: "1.5rem 2rem",
            marginBottom: "1.5rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "1rem"
          }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                <span style={{ fontSize: "1.25rem" }}>📋</span>
                <span style={{ fontSize: "0.85rem", textTransform: "uppercase", fontWeight: 600, color: "var(--accent)" }}>AI Generated Draft</span>
              </div>
              <h2 style={{ fontSize: "1.5rem", fontWeight: 700, margin: 0 }}>
                {draft.input.niche}
              </h2>
              <div style={{ display: "flex", gap: "12px", marginTop: "6px", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                <span>🎯 {draft.niche_analysis.target_audience}</span>
                <span>•</span>
                <span>🌐 {draft.input.language}</span>
                <span>•</span>
                <span>📍 {draft.input.market}</span>
              </div>
            </div>

            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <button
                onClick={handleGenerate}
                className="btn btn-secondary"
                style={{ display: "flex", alignItems: "center", gap: "6px" }}
              >
                <span>🔄</span> Regenerate
              </button>
              <button
                onClick={() => setIsJsonModalOpen(true)}
                className="btn btn-secondary"
                style={{ display: "flex", alignItems: "center", gap: "6px" }}
              >
                <span>✏️</span> Edit JSON
              </button>
              <button
                onClick={handleApprove}
                disabled={isApproving}
                className="btn btn-primary"
                style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 600 }}
              >
                <span>{isApproving ? "⏳" : "✅"}</span> {isApproving ? "Approving..." : "Approve Library"}
              </button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div style={{ display: "flex", gap: "8px", borderBottom: "1px solid var(--border-default)", marginBottom: "1.5rem" }}>
            <button
              onClick={() => setActiveTab("themes")}
              className={`btn btn-sm ${activeTab === "themes" ? "btn-primary" : "btn-ghost"}`}
              style={{ borderRadius: "8px 8px 0 0" }}
            >
              🎨 Themes ({draft.themes.length})
            </button>
            <button
              onClick={() => setActiveTab("styles")}
              className={`btn btn-sm ${activeTab === "styles" ? "btn-primary" : "btn-ghost"}`}
              style={{ borderRadius: "8px 8px 0 0" }}
            >
              🖌️ Styles ({draft.styles.length})
            </button>
            <button
              onClick={() => setActiveTab("contentTypes")}
              className={`btn btn-sm ${activeTab === "contentTypes" ? "btn-primary" : "btn-ghost"}`}
              style={{ borderRadius: "8px 8px 0 0" }}
            >
              📂 Content Types ({draft.content_types.length})
            </button>
            <button
              onClick={() => setActiveTab("recipes")}
              className={`btn btn-sm ${activeTab === "recipes" ? "btn-primary" : "btn-ghost"}`}
              style={{ borderRadius: "8px 8px 0 0" }}
            >
              📋 Recipes ({draft.recipes.length})
            </button>
            <button
              onClick={() => setActiveTab("analysis")}
              className={`btn btn-sm ${activeTab === "analysis" ? "btn-primary" : "btn-ghost"}`}
              style={{ borderRadius: "8px 8px 0 0" }}
            >
              📊 SEO & Pillars
            </button>
          </div>

          {/* Tab 1: Themes */}
          {activeTab === "themes" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {draft.themes.map((t, idx) => (
                <div
                  key={idx}
                  style={{
                    background: "var(--bg-secondary)",
                    borderRadius: "12px",
                    border: "1px solid var(--border-default)",
                    padding: "1.5rem"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.5rem" }}>
                    <div>
                      <h3 style={{ fontSize: "1.15rem", fontWeight: 700, margin: "0 0 4px 0" }}>
                        {idx + 1}. {t.name}
                      </h3>
                      <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem", margin: 0, lineHeight: 1.4 }}>
                        {t.description}
                      </p>
                    </div>
                    <button
                      onClick={() => handleRemoveTheme(idx)}
                      className="btn btn-ghost btn-sm"
                      style={{ color: "var(--error)" }}
                      title="Remove theme"
                    >
                      ✕
                    </button>
                  </div>

                  <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginTop: "1rem", fontSize: "0.85rem" }}>
                    {t.mood && (
                      <span style={{ background: "var(--bg-tertiary)", padding: "3px 8px", borderRadius: "6px" }}>
                        🎭 <strong>Mood:</strong> {t.mood}
                      </span>
                    )}
                    {t.color_palette && (
                      <span style={{ background: "var(--bg-tertiary)", padding: "3px 8px", borderRadius: "6px" }}>
                        🎨 <strong>Palette:</strong> {t.color_palette}
                      </span>
                    )}
                  </div>

                  {/* Compatible Styles Badges */}
                  <div style={{ marginTop: "1rem" }}>
                    <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: "6px", textTransform: "uppercase" }}>
                      Compatible Aesthetic Styles:
                    </div>
                    <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                      {t.compatible_style_names?.map((sName, sIdx) => (
                        <span
                          key={sIdx}
                          style={{
                            fontSize: "0.8rem",
                            background: "rgba(13, 148, 136, 0.1)",
                            color: "var(--accent)",
                            border: "1px solid rgba(13, 148, 136, 0.25)",
                            padding: "3px 10px",
                            borderRadius: "14px",
                            fontWeight: 500
                          }}
                        >
                          {sName}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Tab 2: Styles */}
          {activeTab === "styles" && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: "1rem" }}>
              {draft.styles.map((s, idx) => (
                <div
                  key={idx}
                  style={{
                    background: "var(--bg-secondary)",
                    borderRadius: "12px",
                    border: "1px solid var(--border-default)",
                    padding: "1.25rem",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between"
                  }}
                >
                  <div>
                    <h4 style={{ fontSize: "1.05rem", fontWeight: 700, margin: "0 0 6px 0" }}>{s.name}</h4>
                    <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)", margin: "0 0 10px 0", lineHeight: 1.4 }}>
                      {s.style_description}
                    </p>

                    {s.positive_prompt && (
                      <div style={{
                        background: "var(--bg-primary)",
                        padding: "8px",
                        borderRadius: "6px",
                        fontSize: "0.8rem",
                        color: "var(--text-muted)",
                        fontFamily: "monospace",
                        marginBottom: "8px",
                        maxHeight: "80px",
                        overflowY: "auto"
                      }}>
                        {s.positive_prompt}
                      </div>
                    )}
                  </div>

                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "8px" }}>
                    {s.lighting_style && <span>💡 {s.lighting_style}</span>}
                    {s.camera_style && <span>📷 {s.camera_style}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Tab 3: Content Types */}
          {activeTab === "contentTypes" && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "1rem" }}>
              {draft.content_types.map((ct, idx) => (
                <div
                  key={idx}
                  style={{
                    background: "var(--bg-secondary)",
                    borderRadius: "12px",
                    border: "1px solid var(--border-default)",
                    padding: "1.25rem"
                  }}
                >
                  <div style={{ fontSize: "1.5rem", marginBottom: "4px" }}>📂</div>
                  <h4 style={{ fontSize: "1.1rem", fontWeight: 700, margin: "0 0 4px 0" }}>{ct.name}</h4>
                  <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)", margin: 0 }}>
                    {ct.description || "Standard Pinterest content format"}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Tab 4: Recipes */}
          {activeTab === "recipes" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {draft.recipes.map((r, idx) => (
                <div
                  key={idx}
                  style={{
                    background: "var(--bg-secondary)",
                    borderRadius: "12px",
                    border: "1px solid var(--border-default)",
                    padding: "1.5rem"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.5rem" }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <h4 style={{ fontSize: "1.15rem", fontWeight: 700, margin: 0 }}>{r.name}</h4>
                        <span style={{
                          fontSize: "0.75rem",
                          background: "var(--bg-tertiary)",
                          padding: "2px 8px",
                          borderRadius: "12px",
                          color: "var(--accent)",
                          fontWeight: 600
                        }}>
                          {r.content_type_name}
                        </span>
                      </div>
                      <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", margin: "4px 0 0 0" }}>
                        {r.description}
                      </p>
                    </div>
                    <button
                      onClick={() => handleRemoveRecipe(idx)}
                      className="btn btn-ghost btn-sm"
                      style={{ color: "var(--error)" }}
                      title="Remove recipe"
                    >
                      ✕
                    </button>
                  </div>

                  {r.prompt_template && (
                    <div style={{ marginTop: "1rem" }}>
                      <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: "4px", textTransform: "uppercase" }}>
                        Prompt Construction Formula:
                      </div>
                      <div style={{
                        background: "var(--bg-primary)",
                        padding: "10px",
                        borderRadius: "8px",
                        fontSize: "0.85rem",
                        color: "var(--text-secondary)",
                        fontFamily: "monospace",
                        lineHeight: 1.4
                      }}>
                        {r.prompt_template}
                      </div>
                    </div>
                  )}

                  {r.seo_direction && (
                    <div style={{ marginTop: "0.75rem", fontSize: "0.85rem", color: "var(--text-muted)" }}>
                      🔍 <strong>SEO Direction:</strong> {r.seo_direction}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Tab 5: SEO Analysis & Pillars */}
          {activeTab === "analysis" && (
            <div style={{
              background: "var(--bg-secondary)",
              borderRadius: "14px",
              border: "1px solid var(--border-default)",
              padding: "1.75rem",
              display: "flex",
              flexDirection: "column",
              gap: "1.5rem"
            }}>
              <div>
                <h4 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "0.5rem" }}>🎯 Content Pillars</h4>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  {draft.niche_analysis.content_pillars?.map((pillar, i) => (
                    <span
                      key={i}
                      style={{
                        background: "var(--bg-tertiary)",
                        padding: "6px 14px",
                        borderRadius: "8px",
                        fontSize: "0.9rem",
                        fontWeight: 500
                      }}
                    >
                      {pillar}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <h4 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "0.5rem" }}>🔍 Recommended SEO Keywords</h4>
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                  {draft.niche_analysis.seo_keywords?.map((kw, i) => (
                    <span
                      key={i}
                      style={{
                        background: "rgba(13, 148, 136, 0.1)",
                        color: "var(--accent)",
                        padding: "4px 10px",
                        borderRadius: "14px",
                        fontSize: "0.85rem"
                      }}
                    >
                      #{kw}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── JSON RAW EDITOR MODAL ────────────────────────────────────────── */}
      {isJsonModalOpen && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(0, 0, 0, 0.7)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000,
          padding: "2rem"
        }}>
          <div style={{
            background: "var(--bg-primary)",
            borderRadius: "16px",
            width: "100%",
            maxWidth: "800px",
            maxHeight: "85vh",
            display: "flex",
            flexDirection: "column",
            boxShadow: "var(--shadow-lg)",
            border: "1px solid var(--border-default)"
          }}>
            <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--border-default)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 700 }}>✏️ Edit Draft JSON</h3>
              <button onClick={() => setIsJsonModalOpen(false)} className="btn btn-ghost btn-sm">✕</button>
            </div>
            <div style={{ padding: "1rem 1.5rem", flex: 1, overflow: "hidden" }}>
              <textarea
                value={jsonText}
                onChange={(e) => setJsonText(e.target.value)}
                style={{
                  width: "100%",
                  height: "450px",
                  background: "var(--bg-secondary)",
                  color: "var(--text-primary)",
                  fontFamily: "monospace",
                  fontSize: "0.85rem",
                  padding: "1rem",
                  borderRadius: "8px",
                  border: "1px solid var(--border-default)",
                  resize: "none"
                }}
              />
            </div>
            <div style={{ padding: "1rem 1.5rem", borderTop: "1px solid var(--border-default)", display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button onClick={() => setIsJsonModalOpen(false)} className="btn btn-secondary">
                Cancel
              </button>
              <button onClick={handleApplyJsonEdit} className="btn btn-primary">
                Apply JSON Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
