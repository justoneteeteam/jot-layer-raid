"use client";

export const runtime = "edge";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

interface ThemeItem {
  id: number;
  name: string;
  description?: string | null;
  season?: string | null;
  decorElements?: string | null;
  colorPalette?: string | null;
  mood?: string | null;
  recommendedStyles?: string | null;
  compatibleStyles?: Array<{ id: number; name: string }>;
  compatibleStyleNames?: string[];
}

interface StyleItem {
  id: number;
  name: string;
  styleDescription?: string | null;
  positivePrompt?: string | null;
  negativePrompt?: string | null;
  colorPalette?: string | null;
  lightingStyle?: string | null;
  cameraStyle?: string | null;
}

interface ContentTypeItem {
  id: number;
  name: string;
  description?: string | null;
}

interface RecipeItem {
  id: number;
  name: string;
  contentTypeId?: number | null;
  description?: string | null;
  promptTemplate?: string | null;
  seoDirection?: string | null;
  visualParams?: string | null;
}

interface NicheDetail {
  id: number;
  name: string;
  targetAudience?: string | null;
  language?: string | null;
  market?: string | null;
  status: string;
  createdAt?: string | null;
  contentTypes: ContentTypeItem[];
  themes: ThemeItem[];
  styles: StyleItem[];
  recipes: RecipeItem[];
}

export default function NicheDetailPage() {
  const params = useParams();
  const router = useRouter();
  const nicheId = params.id as string;

  const [niche, setNiche] = useState<NicheDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"themes" | "styles" | "contentTypes" | "recipes">("themes");
  const [isRegenerating, setIsRegenerating] = useState(false);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "https://api-worker.justoneteeteam.workers.dev";

  const fetchNiche = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const res = await fetch(`${apiUrl}/api/pinterest/niches/${nicheId}`, {
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      });

      if (res.ok) {
        const data = await res.json();
        setNiche(data);
      }
    } catch (err) {
      console.error("Failed to fetch niche detail:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (nicheId) {
      fetchNiche();
    }
  }, [nicheId]);

  const handleRegenerate = async () => {
    if (!confirm("Regenerating will call DeepSeek to generate a fresh draft library for this niche topic. Proceed?")) return;
    setIsRegenerating(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${apiUrl}/api/pinterest/niches/${nicheId}/regenerate`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        alert("New draft library generated! Redirecting to preview...");
        router.push("/pinterest/niches/create");
      } else {
        alert(data.error || "Regeneration failed.");
      }
    } catch (e) {
      console.error(e);
      alert("Error regenerating niche library.");
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleDeleteNiche = async () => {
    if (!confirm("Are you sure you want to delete this niche library?")) return;
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${apiUrl}/api/pinterest/niches/${nicheId}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        router.push("/pinterest/niches");
      } else {
        alert("Failed to delete niche.");
      }
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "5rem 2rem", color: "var(--text-secondary)" }}>
        <div className="spinner" style={{ margin: "0 auto 1rem auto" }}></div>
        <p>Loading Niche Library...</p>
      </div>
    );
  }

  if (!niche) {
    return (
      <div style={{ padding: "3rem", textAlign: "center" }}>
        <h2>Niche Library not found</h2>
        <Link href="/pinterest/niches" className="btn btn-secondary" style={{ marginTop: "1rem" }}>
          Back to Niche Libraries
        </Link>
      </div>
    );
  }

  return (
    <div style={{ padding: "2rem", minHeight: "100vh", maxWidth: "1300px", margin: "0 auto" }}>
      {/* Breadcrumbs */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "1.5rem", fontSize: "0.875rem", color: "var(--text-secondary)" }}>
        <Link href="/pinterest/niches" style={{ color: "inherit", textDecoration: "none" }}>
          Niche Libraries
        </Link>
        <span>/</span>
        <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>{niche.name}</span>
      </div>

      {/* Header Profile Box */}
      <div style={{
        background: "var(--bg-secondary)",
        borderRadius: "16px",
        border: "1px solid var(--border-default)",
        padding: "2rem",
        marginBottom: "2rem",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        flexWrap: "wrap",
        gap: "1.5rem",
        boxShadow: "var(--shadow-sm)"
      }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "0.5rem" }}>
            <span style={{ fontSize: "1.75rem" }}>📚</span>
            <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "1.75rem", fontWeight: 700, margin: 0 }}>
              {niche.name}
            </h1>
            <span style={{
              fontSize: "0.75rem",
              padding: "3px 8px",
              borderRadius: "12px",
              fontWeight: 600,
              textTransform: "uppercase",
              background: "rgba(16, 185, 129, 0.15)",
              color: "#10B981",
              border: "1px solid rgba(16, 185, 129, 0.3)"
            }}>
              {niche.status}
            </span>
          </div>

          {niche.targetAudience && (
            <p style={{ color: "var(--text-secondary)", margin: "0 0 1rem 0", fontSize: "1rem" }}>
              🎯 <strong>Target Audience:</strong> {niche.targetAudience}
            </p>
          )}

          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <span style={{ fontSize: "0.85rem", background: "var(--bg-tertiary)", padding: "4px 10px", borderRadius: "6px" }}>
              🌐 {niche.language || "English"}
            </span>
            <span style={{ fontSize: "0.85rem", background: "var(--bg-tertiary)", padding: "4px 10px", borderRadius: "6px" }}>
              📍 {niche.market || "United States"}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
          <Link
            href={`/pinterest/batch?nicheId=${niche.id}`}
            className="btn btn-primary"
            style={{ display: "inline-flex", alignItems: "center", gap: "8px", fontWeight: 600 }}
          >
            <span>⚡</span> Batch Generate Pins
          </Link>
          <button
            onClick={handleRegenerate}
            disabled={isRegenerating}
            className="btn btn-secondary"
            style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
          >
            <span>🔄</span> {isRegenerating ? "Regenerating..." : "Regenerate AI Library"}
          </button>
          <button
            onClick={handleDeleteNiche}
            className="btn btn-ghost"
            style={{ color: "var(--error)" }}
            title="Delete Niche Library"
          >
            🗑️
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
          🎨 Themes ({niche.themes?.length || 0})
        </button>
        <button
          onClick={() => setActiveTab("styles")}
          className={`btn btn-sm ${activeTab === "styles" ? "btn-primary" : "btn-ghost"}`}
          style={{ borderRadius: "8px 8px 0 0" }}
        >
          🖌️ Styles ({niche.styles?.length || 0})
        </button>
        <button
          onClick={() => setActiveTab("contentTypes")}
          className={`btn btn-sm ${activeTab === "contentTypes" ? "btn-primary" : "btn-ghost"}`}
          style={{ borderRadius: "8px 8px 0 0" }}
        >
          📂 Content Types ({niche.contentTypes?.length || 0})
        </button>
        <button
          onClick={() => setActiveTab("recipes")}
          className={`btn btn-sm ${activeTab === "recipes" ? "btn-primary" : "btn-ghost"}`}
          style={{ borderRadius: "8px 8px 0 0" }}
        >
          📋 Recipes ({niche.recipes?.length || 0})
        </button>
      </div>

      {/* Tab 1: Themes */}
      {activeTab === "themes" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {niche.themes?.map((t, idx) => (
            <div
              key={t.id}
              style={{
                background: "var(--bg-secondary)",
                borderRadius: "12px",
                border: "1px solid var(--border-default)",
                padding: "1.5rem",
                boxShadow: "var(--shadow-sm)"
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.5rem" }}>
                <div>
                  <h3 style={{ fontSize: "1.15rem", fontWeight: 700, margin: "0 0 4px 0" }}>
                    {idx + 1}. {t.name}
                  </h3>
                  {t.description && (
                    <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem", margin: 0, lineHeight: 1.4 }}>
                      {t.description}
                    </p>
                  )}
                </div>
              </div>

              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "0.75rem", fontSize: "0.85rem" }}>
                {t.mood && (
                  <span style={{ background: "var(--bg-tertiary)", padding: "3px 8px", borderRadius: "6px" }}>
                    🎭 <strong>Mood:</strong> {t.mood}
                  </span>
                )}
                {t.colorPalette && (
                  <span style={{ background: "var(--bg-tertiary)", padding: "3px 8px", borderRadius: "6px" }}>
                    🎨 <strong>Palette:</strong> {t.colorPalette}
                  </span>
                )}
              </div>

              {/* Compatible Styles Badges */}
              <div style={{ marginTop: "1rem" }}>
                <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: "6px", textTransform: "uppercase" }}>
                  Compatible Aesthetic Styles:
                </div>
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                  {t.compatibleStyles && t.compatibleStyles.length > 0 ? (
                    t.compatibleStyles.map((cs) => (
                      <span
                        key={cs.id}
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
                        {cs.name}
                      </span>
                    ))
                  ) : t.recommendedStyles ? (
                    t.recommendedStyles.split(",").map((s, i) => (
                      <span
                        key={i}
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
                        {s.trim()}
                      </span>
                    ))
                  ) : (
                    <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>All styles compatible</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab 2: Styles */}
      {activeTab === "styles" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: "1rem" }}>
          {niche.styles?.map((s) => (
            <div
              key={s.id}
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
                {s.styleDescription && (
                  <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)", margin: "0 0 10px 0", lineHeight: 1.4 }}>
                    {s.styleDescription}
                  </p>
                )}
                {s.positivePrompt && (
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
                    {s.positivePrompt}
                  </div>
                )}
              </div>

              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "8px" }}>
                {s.lightingStyle && <span>💡 {s.lightingStyle}</span>}
                {s.cameraStyle && <span>📷 {s.cameraStyle}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab 3: Content Types */}
      {activeTab === "contentTypes" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "1rem" }}>
          {niche.contentTypes?.map((ct) => (
            <div
              key={ct.id}
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
                {ct.description || "Pinterest content presentation format"}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Tab 4: Recipes */}
      {activeTab === "recipes" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {niche.recipes?.map((r) => {
            const ctName = niche.contentTypes?.find(ct => ct.id === r.contentTypeId)?.name || "General";
            return (
              <div
                key={r.id}
                style={{
                  background: "var(--bg-secondary)",
                  borderRadius: "12px",
                  border: "1px solid var(--border-default)",
                  padding: "1.5rem"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                  <h4 style={{ fontSize: "1.15rem", fontWeight: 700, margin: 0 }}>{r.name}</h4>
                  <span style={{
                    fontSize: "0.75rem",
                    background: "var(--bg-tertiary)",
                    padding: "2px 8px",
                    borderRadius: "12px",
                    color: "var(--accent)",
                    fontWeight: 600
                  }}>
                    {ctName}
                  </span>
                </div>
                {r.description && (
                  <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", margin: "4px 0 0 0" }}>
                    {r.description}
                  </p>
                )}

                {r.promptTemplate && (
                  <div style={{ marginTop: "1rem" }}>
                    <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: "4px", textTransform: "uppercase" }}>
                      Construction Formula:
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
                      {r.promptTemplate}
                    </div>
                  </div>
                )}

                {r.seoDirection && (
                  <div style={{ marginTop: "0.75rem", fontSize: "0.85rem", color: "var(--text-muted)" }}>
                    🔍 <strong>SEO Direction:</strong> {r.seoDirection}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
