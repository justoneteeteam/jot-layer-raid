"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";

interface Stats {
  todaysJobs: number;
  completedImages: number;
  failedJobs: number;
  pendingJobs: number;
  imagesThisMonth: number;
}

const ACTION_CARDS = [
  { href: "/pinterest/niches", icon: "📚", title: "Niche Libraries", desc: "AI-generated content libraries by niche (Themes, Styles, Content Types, Recipes)" },
  { href: "/pinterest/batch", icon: "📦", title: "Batch Generate", desc: "Generate multiple pins at once across niches" },
  { href: "/pinterest/generate", icon: "✨", title: "Single Pin Generator", desc: "Create individual Pinterest pins with AI" },
  { href: "/pinterest/prompts", icon: "📝", title: "Style Library", desc: "Manage visual styles and prompt engineering presets" },
  { href: "/pinterest/themes", icon: "🎨", title: "Theme Library", desc: "Manage content themes and angles" },
  { href: "/pinterest/history", icon: "🕰️", title: "History", desc: "View previously generated pins and SEO data" },
  { href: "/pinterest/autopilot", icon: "⚡", title: "Auto-Pilot", desc: "Automated multi-account pin generation" },
  { href: "/pinterest/rss", icon: "📡", title: "RSS Feeds", desc: "Pinterest auto-publishing RSS 2.0 XML feeds" },
];

export default function PinterestDashboard() {
  const [stats, setStats] = useState<Stats>({
    todaysJobs: 0,
    completedImages: 0,
    failedJobs: 0,
    pendingJobs: 0,
    imagesThisMonth: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const token = localStorage.getItem("token");
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "https://api-worker.justoneteeteam.workers.dev";
        const res = await fetch(`${apiUrl}/api/pinterest/stats`, {
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
          }
        });
        
        if (res.ok) {
          const data = await res.json();
          setStats(data);
        }
      } catch (error) {
        console.error("Failed to fetch stats", error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchStats();
  }, []);

  return (
    <div style={{ padding: "2rem", minHeight: "100vh", position: "relative", overflow: "hidden" }}>
      {/* Background decoration */}
      <div style={{
        position: "absolute", top: "-10%", left: "-5%", width: "40%", height: "40%",
        background: "radial-gradient(circle, var(--accent-light) 0%, rgba(255,255,255,0) 70%)",
        opacity: 0.5, zIndex: -1, borderRadius: "50%", filter: "blur(40px)"
      }} />
      <div style={{
        position: "absolute", bottom: "-10%", right: "-5%", width: "50%", height: "50%",
        background: "radial-gradient(circle, var(--accent-light) 0%, rgba(255,255,255,0) 70%)",
        opacity: 0.3, zIndex: -1, borderRadius: "50%", filter: "blur(60px)"
      }} />

      <style dangerouslySetInnerHTML={{__html: `
        .action-card {
          background: rgba(255, 255, 255, 0.7);
          backdrop-filter: blur(10px);
          border: 1px solid var(--border-default);
          border-radius: 12px;
          padding: 1.5rem;
          transition: all 0.3s ease;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          text-decoration: none;
          color: inherit;
          box-shadow: var(--shadow-sm);
        }
        .action-card:hover {
          transform: translateY(-4px);
          box-shadow: var(--shadow-md);
          border-color: var(--accent);
        }
        .action-icon {
          font-size: 2rem;
          margin-bottom: 0.5rem;
        }
        .glass-card {
          background: rgba(255, 255, 255, 0.85);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.2);
        }
      `}} />

      <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "2rem", color: "var(--text-primary)", marginBottom: "2rem" }}>
        Pinterest AI Studio
      </h1>

      <section style={{ marginBottom: "3rem" }}>
        <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "1.25rem", color: "var(--text-secondary)", marginBottom: "1rem" }}>Overview</h2>
        <div className="stats-grid" style={{
          display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1.5rem"
        }}>
          {[
            { label: "Today's Jobs", value: stats.todaysJobs },
            { label: "Completed Images", value: stats.completedImages },
            { label: "Failed Jobs", value: stats.failedJobs, color: "var(--error)" },
            { label: "Pending Jobs", value: stats.pendingJobs, color: "var(--warning)" },
            { label: "Images This Month", value: stats.imagesThisMonth },
          ].map((stat, i) => (
            <div key={i} className="card stat-card glass-card" style={{ padding: "1.5rem", borderRadius: "12px", boxShadow: "var(--shadow-sm)" }}>
              <div className="stat-label" style={{ color: "var(--text-secondary)", fontSize: "0.875rem", fontWeight: 500, marginBottom: "0.5rem" }}>
                {stat.label}
              </div>
              <div className="stat-value" style={{ 
                color: stat.color || "var(--text-primary)", 
                fontSize: "1.75rem", 
                fontWeight: 700,
                fontFamily: "'Space Grotesk', sans-serif" 
              }}>
                {loading ? "..." : stat.value}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "1.25rem", color: "var(--text-secondary)", marginBottom: "1rem" }}>Quick Actions</h2>
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "1.5rem"
        }}>
          {ACTION_CARDS.map((action, i) => (
            <Link key={i} href={action.href} className="action-card">
              <span className="action-icon">{action.icon}</span>
              <h3 style={{ fontSize: "1.125rem", fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>{action.title}</h3>
              <p style={{ fontSize: "0.875rem", color: "var(--text-muted)", margin: 0, lineHeight: 1.5 }}>{action.desc}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
