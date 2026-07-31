"use client";

import React, { useState } from "react";

interface AccountChannel {
  id: string;
  name: string;
  niche: string;
  claimedDomain: string;
  dailyPinLimit: number;
  keywords: string;
  themes: string[];
  styles: string[];
  model: string;
}

export default function PinterestAutoPilotManager() {
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://api-worker.justoneteeteam.workers.dev";

  const [channels, setChannels] = useState<AccountChannel[]>([
    {
      id: "account-main",
      name: "Pinterest Account #1 (Main Store)",
      niche: "Home Decor",
      claimedDomain: "https://vulius.com",
      dailyPinLimit: 10,
      keywords: "small apartment decor, cozy aesthetic living room, japandi bedroom, boho kitchen decor, minimalist bathroom ideas",
      themes: ["General", "Summer Refresh", "Cozy Fall"],
      styles: ["Modern Scandinavian", "Boho Chic", "Japandi"],
      model: "flux"
    },
    {
      id: "nailbox",
      name: "Pinterest Account #2 (NfcWest / Niche)",
      niche: "Home Decor",
      claimedDomain: "https://nfcwestjersey.com/",
      dailyPinLimit: 10,
      keywords: "minimalist apartment decor, boho living room, small apartment decor, luxury living room ideas, aesthetic home styling",
      themes: ["Summer Refresh", "General", "Cozy Fall"],
      styles: ["Modern Luxury", "Eclectic Chic", "Modern Scandinavian"],
      model: "flux"
    }
  ]);

  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [generatedResults, setGeneratedResults] = useState<any[]>([]);

  // New Account Modal State
  const [newAccountName, setNewAccountName] = useState("");
  const [newNiche, setNewNiche] = useState("Home Decor");
  const [newDomain, setNewDomain] = useState("https://vulius.com");
  const [newLimit, setNewLimit] = useState(10);
  const [newKeywords, setNewKeywords] = useState("cozy room decor, luxury interior, aesthetic bedroom");

  const getRSSUrl = (ch: AccountChannel) => {
    return `${API_BASE}/api/pinterest/rss/${ch.id}?domain=${encodeURIComponent(ch.claimedDomain)}`;
  };

  const handleAddAccount = () => {
    if (!newAccountName.trim()) {
      alert("Please enter an account name.");
      return;
    }
    const slug = newAccountName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    const newCh: AccountChannel = {
      id: slug || `account-${Date.now()}`,
      name: newAccountName.trim(),
      niche: newNiche,
      claimedDomain: newDomain.trim() || "https://vulius.com",
      dailyPinLimit: newLimit,
      keywords: newKeywords,
      themes: ["General", "Summer Refresh"],
      styles: ["Modern Scandinavian", "Boho Chic"],
      model: "flux"
    };
    setChannels([...channels, newCh]);
    setNewAccountName("");
  };

  const handleDeleteAccount = (id: string) => {
    setChannels(channels.filter(c => c.id !== id));
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleRunAutoPilot = async () => {
    setIsRunning(true);
    setLogs(["⚡ Initiating Multi-Account Auto-Pilot generation..."]);
    setGeneratedResults([]);

    try {
      const payloadChannels = channels.map(c => ({
        id: c.id,
        name: c.name,
        niche: c.niche,
        claimedDomain: c.claimedDomain,
        dailyPinLimit: c.dailyPinLimit,
        keywords: c.keywords.split(",").map(k => k.trim()).filter(Boolean),
        themes: c.themes,
        styles: c.styles,
        model: c.model
      }));

      setLogs(prev => [...prev, `🔄 Processing ${channels.length} account channels in parallel matrix batches...`]);

      const res = await fetch(`${API_BASE}/api/pinterest/autopilot/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channels: payloadChannels })
      });

      const data = await res.json();
      if (data.ok) {
        setLogs(prev => [
          ...prev,
          `🎉 Success! Generated ${data.generatedCount} unique non-duplicate daily Pins across all account channels!`,
          `📡 Dynamic RSS Feeds updated automatically for Pinterest auto-publishing.`
        ]);
        if (data.items) {
          setGeneratedResults(data.items.map((i: any) => i.item));
        }
      } else {
        setLogs(prev => [...prev, `❌ Auto-Pilot Error: ${data.error}`]);
      }
    } catch (err: any) {
      console.error(err);
      setLogs(prev => [...prev, `❌ Connection error: ${err.message}`]);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "32px 24px", fontFamily: "var(--font-sans, system-ui)" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "32px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ backgroundColor: "#E60023", color: "white", padding: "8px 14px", borderRadius: "10px", fontWeight: "700", fontSize: "16px" }}>
            ⚡ AUTO-PILOT
          </div>
          <div>
            <h1 style={{ fontSize: "28px", fontWeight: "800", color: "var(--text-primary)", margin: 0 }}>
              Multi-Account Pinterest Auto-Pilot
            </h1>
            <p style={{ color: "var(--text-secondary)", fontSize: "15px", marginTop: "4px" }}>
              Automate daily Pin creation for multiple Pinterest accounts per niche with 0 content duplication.
            </p>
          </div>
        </div>

        <button
          className="btn btn-primary"
          onClick={handleRunAutoPilot}
          disabled={isRunning}
          style={{ backgroundColor: "#E60023", color: "white", padding: "12px 24px", fontWeight: "700", fontSize: "15px", borderRadius: "10px", display: "flex", alignItems: "center", gap: "8px" }}
        >
          {isRunning ? "🔄 Generating Daily Pins..." : "⚡ Run Auto-Pilot Now (All Accounts)"}
        </button>
      </div>

      {/* Zero-Duplication Guarantee Badge */}
      <div className="card" style={{ padding: "18px 22px", borderRadius: "14px", border: "1px solid var(--accent-light)", backgroundColor: "rgba(13, 148, 136, 0.04)", marginBottom: "32px", display: "flex", alignItems: "center", gap: "16px" }}>
        <div style={{ fontSize: "26px" }}>🛡️</div>
        <div>
          <h3 style={{ fontSize: "15px", fontWeight: "700", color: "var(--text-primary)", margin: "0 0 4px 0" }}>
            Zero-Duplication Multi-Account Architecture Enabled
          </h3>
          <p style={{ fontSize: "13px", color: "var(--text-secondary)", margin: 0, lineHeight: "1.5" }}>
            Each Pinterest Account Channel receives distinct keyword/theme matrix allocations, unique AI image prompts, and isolated RSS feed URLs. Account A and Account B will <strong>never post duplicate images or text</strong>.
          </p>
        </div>
      </div>

      {/* Logs Box */}
      {logs.length > 0 && (
        <div className="card" style={{ padding: "16px 20px", borderRadius: "12px", backgroundColor: "#111827", color: "#10B981", fontFamily: "monospace", fontSize: "13px", marginBottom: "32px", display: "flex", flexDirection: "column", gap: "6px" }}>
          {logs.map((log, i) => (
            <div key={i}>{log}</div>
          ))}
        </div>
      )}

      {/* Create New Account Channel */}
      <div className="card" style={{ padding: "24px", borderRadius: "16px", border: "1px solid var(--border-default)", backgroundColor: "var(--bg-primary)", marginBottom: "32px" }}>
        <h2 style={{ fontSize: "18px", fontWeight: "700", color: "var(--text-primary)", marginTop: 0, marginBottom: "16px" }}>
          ➕ Add Account Channel (Niche / Brand)
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px", alignItems: "end" }}>
          <div>
            <label style={{ fontSize: "13px", fontWeight: "600", color: "var(--text-primary)", display: "block", marginBottom: "6px" }}>
              Account Name / Identifier
            </label>
            <input
              type="text"
              className="input"
              value={newAccountName}
              onChange={(e) => setNewAccountName(e.target.value)}
              placeholder="e.g. Account C - Boho Living"
              style={{ width: "100%" }}
            />
          </div>

          <div>
            <label style={{ fontSize: "13px", fontWeight: "600", color: "var(--text-primary)", display: "block", marginBottom: "6px" }}>
              Niche Category
            </label>
            <select
              className="input"
              value={newNiche}
              onChange={(e) => setNewNiche(e.target.value)}
              style={{ width: "100%" }}
            >
              <option value="Home Decor">🛋️ Home Decor</option>
              <option value="Cake Decorating">🎂 Cake Decorating</option>
              <option value="Cooking Recipes">🍳 Cooking Recipes</option>
              <option value="Fashion & Apparel">👗 Fashion & Apparel</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: "13px", fontWeight: "600", color: "var(--text-primary)", display: "block", marginBottom: "6px" }}>
              Claimed Website Domain
            </label>
            <input
              type="url"
              className="input"
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value)}
              placeholder="https://yourdomain.com"
              style={{ width: "100%" }}
            />
          </div>

          <div>
            <label style={{ fontSize: "13px", fontWeight: "600", color: "var(--text-primary)", display: "block", marginBottom: "6px" }}>
              Daily Target Pins
            </label>
            <select
              className="input"
              value={newLimit}
              onChange={(e) => setNewLimit(parseInt(e.target.value, 10))}
              style={{ width: "100%" }}
            >
              <option value={10}>10 Pins / day</option>
              <option value={20}>20 Pins / day</option>
              <option value={50}>50 Pins / day</option>
              <option value={200}>200 Pins / day (Max)</option>
            </select>
          </div>

          <div>
            <button
              className="btn btn-primary"
              onClick={handleAddAccount}
              style={{ width: "100%", padding: "11px 18px", fontWeight: "600", backgroundColor: "#E60023", color: "white" }}
            >
              Add Channel
            </button>
          </div>
        </div>
      </div>

      {/* Account Channels Grid */}
      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        <h2 style={{ fontSize: "20px", fontWeight: "700", color: "var(--text-primary)", margin: 0 }}>
          📌 Account Channels Configured ({channels.length})
        </h2>

        {channels.map((ch) => {
          const rssUrl = getRSSUrl(ch);
          return (
            <div key={ch.id} className="card" style={{ padding: "24px", borderRadius: "16px", border: "1px solid var(--border-default)", backgroundColor: "var(--bg-primary)", display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <h3 style={{ fontSize: "18px", fontWeight: "700", color: "var(--text-primary)", margin: 0 }}>
                    {ch.name}
                  </h3>
                  <div style={{ display: "flex", gap: "12px", marginTop: "6px", fontSize: "13px", color: "var(--text-secondary)" }}>
                    <span>📁 Niche: <strong>{ch.niche}</strong></span>
                    <span>•</span>
                    <span>🌐 Domain: <strong>{ch.claimedDomain}</strong></span>
                    <span>•</span>
                    <span>⚡ Daily Rate: <strong>{ch.dailyPinLimit} Pins/day</strong></span>
                    <span>•</span>
                    <span>🎨 AI Model: <strong>FLUX.1 Schnell</strong></span>
                  </div>
                </div>

                <button
                  onClick={() => handleDeleteAccount(ch.id)}
                  style={{ background: "none", border: "none", color: "var(--error)", cursor: "pointer", fontSize: "13px", fontWeight: "600" }}
                >
                  Remove Account
                </button>
              </div>

              {/* Keywords Input */}
              <div>
                <label style={{ fontSize: "12px", fontWeight: "700", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: "4px" }}>
                  Channel Keywords (Comma Separated)
                </label>
                <input
                  type="text"
                  className="input"
                  value={ch.keywords}
                  onChange={(e) => {
                    const val = e.target.value;
                    setChannels(channels.map(c => c.id === ch.id ? { ...c, keywords: val } : c));
                  }}
                  style={{ width: "100%", fontSize: "13px" }}
                />
              </div>

              {/* RSS Link Row */}
              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                <input
                  type="text"
                  readOnly
                  value={rssUrl}
                  style={{ flex: 1, padding: "10px 14px", borderRadius: "8px", border: "1px solid var(--border-default)", backgroundColor: "var(--bg-tertiary)", fontSize: "13px", fontFamily: "monospace" }}
                />
                <button
                  className="btn btn-primary"
                  onClick={() => copyToClipboard(rssUrl, ch.id)}
                  style={{ backgroundColor: copiedId === ch.id ? "#10B981" : "#E60023", color: "white", padding: "10px 16px", fontWeight: "600", fontSize: "13px" }}
                >
                  {copiedId === ch.id ? "✓ Copied!" : "📋 Copy RSS Link"}
                </button>
                <a
                  href={rssUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-secondary"
                  style={{ padding: "10px 16px", fontSize: "13px", textDecoration: "none" }}
                >
                  🔍 Test XML Feed
                </a>
              </div>
            </div>
          );
        })}
      </div>

      {/* Live Preview Gallery */}
      {generatedResults.length > 0 && (
        <div style={{ marginTop: "40px" }}>
          <h2 style={{ fontSize: "22px", fontWeight: "700", color: "var(--text-primary)", marginBottom: "16px" }}>
            🎉 Newly Generated Auto-Pilot Creatives ({generatedResults.length})
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "20px" }}>
            {generatedResults.map((item: any) => (
              <div key={item.id} className="card" style={{ padding: "14px", borderRadius: "12px", border: "1px solid var(--border-default)", backgroundColor: "var(--bg-primary)", display: "flex", flexDirection: "column", gap: "10px" }}>
                <div style={{ width: "100%", height: "220px", borderRadius: "8px", overflow: "hidden", backgroundColor: "#F3F4F6" }}>
                  <img
                    src={item.generatedImageUrl}
                    alt={item.seoAltText || item.keyword}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                </div>
                <div style={{ fontSize: "14px", fontWeight: "700", color: "var(--text-primary)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                  {item.seoTitle}
                </div>
                <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                  Channel: <strong>{item.accountChannelId || "Default"}</strong>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
