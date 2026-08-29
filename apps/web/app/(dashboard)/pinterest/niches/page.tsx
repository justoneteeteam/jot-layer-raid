"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";

interface Niche {
  id: number;
  name: string;
  targetAudience?: string | null;
  language?: string | null;
  market?: string | null;
  status: string;
  createdAt?: string | null;
  counts?: {
    themes: number;
    styles: number;
    contentTypes: number;
    recipes: number;
  };
}

export default function NichesPage() {
  const [niches, setNiches] = useState<Niche[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "https://api-worker.justoneteeteam.workers.dev";

  const fetchNiches = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const url = statusFilter !== "all"
        ? `${apiUrl}/api/pinterest/niches?status=${statusFilter}`
        : `${apiUrl}/api/pinterest/niches`;

      const res = await fetch(url, {
        cache: "no-store",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      });

      if (res.ok) {
        const data = await res.json();
        setNiches(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error("Failed to fetch niches:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNiches();
  }, [statusFilter]);

  const handleDeleteNiche = async (id: number, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"? Content types and recipes will be deleted. Themes and styles will be detached.`)) {
      return;
    }

    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${apiUrl}/api/pinterest/niches/${id}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });

      if (res.ok) {
        setNiches((prev) => prev.filter((n) => n.id !== id));
      } else {
        alert("Failed to delete niche.");
      }
    } catch (e) {
      console.error(e);
      alert("Error deleting niche.");
    }
  };

  const filteredNiches = niches.filter((n) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      n.name.toLowerCase().includes(q) ||
      (n.targetAudience && n.targetAudience.toLowerCase().includes(q))
    );
  });

  return (
    <div style={{ padding: "2rem", minHeight: "100vh", maxWidth: "1400px", margin: "0 auto" }}>
      {/* Top Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "2rem", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "1.75rem" }}>📚</span>
            <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "1.875rem", fontWeight: 700, margin: 0 }}>
              Pinterest Niche Libraries
            </h1>
          </div>
          <p style={{ color: "var(--text-secondary)", marginTop: "0.5rem", fontSize: "0.95rem" }}>
            AI-generated content configurations with Themes, Styles, Content Types, and Recipes.
          </p>
        </div>

        <Link
          href="/pinterest/niches/create"
          className="btn btn-primary"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            padding: "0.75rem 1.25rem",
            fontSize: "0.95rem",
            fontWeight: 600,
            borderRadius: "8px"
          }}
        >
          <span>✨</span> Create New Niche Library
        </Link>
      </div>

      {/* Filter and Search Toolbar */}
      <div style={{
        display: "flex",
        gap: "1rem",
        marginBottom: "2rem",
        background: "var(--bg-secondary)",
        padding: "1rem",
        borderRadius: "12px",
        border: "1px solid var(--border-default)",
        alignItems: "center",
        flexWrap: "wrap"
      }}>
        <div style={{ flex: "1 1 300px", position: "relative" }}>
          <input
            type="text"
            placeholder="Search niches by name or target audience..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input"
            style={{ width: "100%", paddingLeft: "2.5rem" }}
          />
          <span style={{ position: "absolute", left: "0.85rem", top: "50%", transform: "translateY(-50%)", opacity: 0.5 }}>
            🔍
          </span>
        </div>

        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <span style={{ fontSize: "0.875rem", color: "var(--text-secondary)", fontWeight: 500 }}>Status:</span>
          {(["all", "approved", "draft"] as const).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`btn btn-sm ${statusFilter === st ? "btn-primary" : "btn-secondary"}`}
              style={{ textTransform: "capitalize" }}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Niche Grid */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "4rem", color: "var(--text-secondary)" }}>
          <div className="spinner" style={{ margin: "0 auto 1rem auto" }}></div>
          <p>Loading Niche Libraries...</p>
        </div>
      ) : filteredNiches.length === 0 ? (
        <div style={{
          textAlign: "center",
          padding: "4rem 2rem",
          background: "var(--bg-secondary)",
          borderRadius: "16px",
          border: "2px dashed var(--border-default)"
        }}>
          <div style={{ fontSize: "3.5rem", marginBottom: "1rem" }}>🪄</div>
          <h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: "0.5rem" }}>
            {search ? "No matching niches found" : "No Niche Libraries Created Yet"}
          </h2>
          <p style={{ color: "var(--text-secondary)", maxWidth: "500px", margin: "0 auto 1.5rem auto", fontSize: "0.95rem" }}>
            Enter a niche keyword like <strong>"ChatGPT Education for Marketers"</strong> or <strong>"Nailbox Trends"</strong> and DeepSeek will automatically structure themes, aesthetic styles, content types, and recipes.
          </p>
          <Link href="/pinterest/niches/create" className="btn btn-primary">
            ✨ Generate Your First Niche Library
          </Link>
        </div>
      ) : (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(380px, 1fr))",
          gap: "1.5rem"
        }}>
          {filteredNiches.map((niche) => {
            const counts = niche.counts || { themes: 0, styles: 0, contentTypes: 0, recipes: 0 };
            return (
              <div
                key={niche.id}
                style={{
                  background: "var(--bg-secondary)",
                  borderRadius: "14px",
                  border: "1px solid var(--border-default)",
                  padding: "1.5rem",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  transition: "all 0.2s ease",
                  boxShadow: "var(--shadow-sm)"
                }}
              >
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.75rem", marginBottom: "0.75rem" }}>
                    <h3 style={{ fontSize: "1.2rem", fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>
                      {niche.name}
                    </h3>
                    <span style={{
                      fontSize: "0.75rem",
                      padding: "3px 8px",
                      borderRadius: "12px",
                      fontWeight: 600,
                      textTransform: "uppercase",
                      background: niche.status === "approved" ? "rgba(16, 185, 129, 0.15)" : "rgba(245, 158, 11, 0.15)",
                      color: niche.status === "approved" ? "#10B981" : "#F59E0B",
                      border: `1px solid ${niche.status === "approved" ? "rgba(16, 185, 129, 0.3)" : "rgba(245, 158, 11, 0.3)"}`
                    }}>
                      {niche.status}
                    </span>
                  </div>

                  {niche.targetAudience && (
                    <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)", margin: "0 0 1rem 0", lineHeight: 1.4 }}>
                      🎯 <strong>Audience:</strong> {niche.targetAudience}
                    </p>
                  )}

                  {/* Metadata Chips */}
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "1.25rem" }}>
                    <span style={{ fontSize: "0.8rem", background: "var(--bg-tertiary)", padding: "3px 8px", borderRadius: "6px", border: "1px solid var(--border-subtle)" }}>
                      🌐 {niche.language || "English"}
                    </span>
                    <span style={{ fontSize: "0.8rem", background: "var(--bg-tertiary)", padding: "3px 8px", borderRadius: "6px", border: "1px solid var(--border-subtle)" }}>
                      📍 {niche.market || "United States"}
                    </span>
                  </div>

                  {/* Metrics Row */}
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(4, 1fr)",
                    gap: "8px",
                    background: "var(--bg-primary)",
                    padding: "0.85rem",
                    borderRadius: "10px",
                    border: "1px solid var(--border-subtle)",
                    marginBottom: "1.25rem",
                    textAlign: "center"
                  }}>
                    <div>
                      <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--accent)" }}>{counts.contentTypes}</div>
                      <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "2px" }}>Types</div>
                    </div>
                    <div>
                      <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--accent)" }}>{counts.themes}</div>
                      <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "2px" }}>Themes</div>
                    </div>
                    <div>
                      <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--accent)" }}>{counts.styles}</div>
                      <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "2px" }}>Styles</div>
                    </div>
                    <div>
                      <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--accent)" }}>{counts.recipes}</div>
                      <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "2px" }}>Recipes</div>
                    </div>
                  </div>
                </div>

                {/* Card Actions */}
                <div style={{ display: "flex", gap: "8px", paddingTop: "0.75rem", borderTop: "1px solid var(--border-subtle)" }}>
                  <Link
                    href={`/pinterest/niches/${niche.id}`}
                    className="btn btn-secondary btn-sm"
                    style={{ flex: 1, justifyContent: "center" }}
                  >
                    📖 View Library
                  </Link>
                  <Link
                    href={`/pinterest/batch?nicheId=${niche.id}`}
                    className="btn btn-primary btn-sm"
                    style={{ flex: 1, justifyContent: "center" }}
                  >
                    ⚡ Batch Gen
                  </Link>
                  <button
                    onClick={() => handleDeleteNiche(niche.id, niche.name)}
                    className="btn btn-ghost btn-sm"
                    title="Delete Niche"
                    style={{ color: "var(--error)", padding: "0 0.5rem" }}
                  >
                    🗑️
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
