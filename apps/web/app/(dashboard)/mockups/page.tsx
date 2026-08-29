"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Template, Team, fetchTemplates, fetchTeams } from "../../lib/api";

export default function MockupsPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetchTemplates().catch(() => []),
      fetchTeams().catch(() => []),
    ]).then(([tplData, teamData]) => {
      setTemplates(tplData);
      setTeams(teamData);
      setLoading(false);
    });
  }, []);

  const getTeamName = (teamId?: number) => {
    if (!teamId) return "Generic / Custom";
    const team = teams.find((t) => t.id === teamId);
    return team ? team.name : `Team #${teamId}`;
  };

  const getTemplateImageUrl = (tpl: Template) => {
    if (!tpl.original_image_url) {
      return "https://placehold.co/600x600?text=No+Background+Uploaded";
    }
    const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://api-worker.justoneteeteam.workers.dev";
    return `${API_BASE}/api/mockups/templates/${tpl.id}/background/download`;
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Are you sure you want to delete this template?")) return;
    const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://api-worker.justoneteeteam.workers.dev";
    try {
      const res = await fetch(`${API_BASE}/api/mockups/templates/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setTemplates((prev) => prev.filter((t) => t.id !== id));
      } else {
        alert("Failed to delete template");
      }
    } catch (e) {
      console.error(e);
      alert("Error deleting template");
    }
  };

  if (loading) {
    return (
      <div className="card" style={{ padding: 48, textAlign: "center", color: "var(--text-secondary)" }}>
        Loading Mockup Templates...
      </div>
    );
  }

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Mockup Templates</h2>
          <a href="/mockups/create" className="btn btn-primary">➕ Create Template</a>
        </div>
        
        {templates.length === 0 ? (
          <div style={{ textAlign: "center", padding: "64px 24px" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🎽</div>
            <h3 style={{ fontWeight: 600, fontSize: 18, marginBottom: 8 }}>No Mockup Templates Yet</h3>
            <p style={{ color: "var(--text-secondary)", marginBottom: 24, maxWidth: 400, marginLeft: "auto", marginRight: "auto" }}>
              Create a custom mockup template by uploading a jersey image.
            </p>
            <a href="/mockups/create" className="btn btn-primary">Create First Template</a>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 24 }}>
            {templates.map((tpl) => (
              <div 
                key={tpl.id} 
                className="mockup-card"
                style={{ 
                  border: "1px solid var(--border-default)", 
                  borderRadius: 12, 
                  overflow: "hidden",
                  backgroundColor: "var(--bg-card)",
                  transition: "transform 0.2s, box-shadow 0.2s",
                }}
              >
                <div style={{ position: "relative", height: 320, backgroundColor: "#f3f4f6" }}>
                  <img 
                    src={getTemplateImageUrl(tpl)} 
                    alt={tpl.name} 
                    style={{ width: "100%", height: "100%", objectFit: "contain", padding: 12 }} 
                    onError={(e) => {
                      e.currentTarget.src = "https://placehold.co/600x600?text=Image+Load+Error";
                    }}
                  />
                  {tpl.color_variant && (
                    <span 
                      style={{ 
                        position: "absolute", 
                        top: 12, 
                        right: 12, 
                        backgroundColor: "rgba(0, 0, 0, 0.6)", 
                        color: "white", 
                        padding: "4px 8px", 
                        borderRadius: 6, 
                        fontSize: 11,
                        fontWeight: 500
                      }}
                    >
                      {tpl.color_variant}
                    </span>
                  )}
                </div>
                <div style={{ padding: 20 }}>
                  <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={tpl.name}>
                    {tpl.name}
                  </div>
                  <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 16 }}>
                    🏈 {getTeamName(tpl.team_id)}
                  </div>
                  <div style={{ display: "flex", gap: 12 }}>
                    <button
                      className="btn btn-primary"
                      style={{ flex: 1, padding: "8px 12px", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                      onClick={() => router.push(`/mockups/${tpl.id}/edit`)}
                    >
                      ✏️ Edit Template
                    </button>
                    <button 
                      className="btn btn-ghost" 
                      style={{ padding: "8px 12px", border: "1px solid var(--border-default)" }}
                      onClick={() => handleDelete(tpl.id)}
                      title="Delete Mockup Template"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
