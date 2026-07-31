"use client";

import React, { useState } from "react";

interface RSSChannel {
  id: string;
  accountName: string;
  claimedDomain: string;
  themeFilter: string;
  limit: number;
}

export default function PinterestRSSManager() {
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://api-worker.justoneteeteam.workers.dev";

  const [channels, setChannels] = useState<RSSChannel[]>([
    { id: "account-main", accountName: "Pinterest Account #1 (Main Store)", claimedDomain: "https://vulius.com", themeFilter: "all", limit: 200 },
    { id: "account-boho", accountName: "Pinterest Account #2 (Boho & Cozy Niche)", claimedDomain: "https://vulius.com", themeFilter: "General", limit: 200 },
    { id: "account-summer", accountName: "Pinterest Account #3 (Summer Trends)", claimedDomain: "https://vulius.com", themeFilter: "Summer", limit: 200 }
  ]);

  const [newAccountName, setNewAccountName] = useState("");
  const [newClaimedDomain, setNewClaimedDomain] = useState("https://vulius.com");
  const [newThemeFilter, setNewThemeFilter] = useState("all");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const getRSSUrl = (ch: RSSChannel) => {
    const slug = ch.accountName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    let url = `${API_BASE}/api/pinterest/rss/${slug}?domain=${encodeURIComponent(ch.claimedDomain)}`;
    if (ch.themeFilter && ch.themeFilter !== "all") {
      url += `&theme=${encodeURIComponent(ch.themeFilter)}`;
    }
    return url;
  };

  const handleAddChannel = () => {
    if (!newAccountName.trim()) {
      alert("Please enter an account or channel name.");
      return;
    }
    const newCh: RSSChannel = {
      id: `account-${Date.now()}`,
      accountName: newAccountName.trim(),
      claimedDomain: newClaimedDomain.trim() || "https://vulius.com",
      themeFilter: newThemeFilter,
      limit: 200
    };
    setChannels([...channels, newCh]);
    setNewAccountName("");
  };

  const handleDeleteChannel = (id: string) => {
    setChannels(channels.filter(c => c.id !== id));
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "32px 24px", fontFamily: "var(--font-sans, system-ui)" }}>
      {/* Header */}
      <div style={{ marginBottom: "32px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ backgroundColor: "#E60023", color: "white", padding: "8px 14px", borderRadius: "10px", fontWeight: "700", fontSize: "16px" }}>
            📡 RSS
          </div>
          <div>
            <h1 style={{ fontSize: "28px", fontWeight: "800", color: "var(--text-primary)", margin: 0 }}>
              Pinterest Auto-Publishing RSS Feeds
            </h1>
            <p style={{ color: "var(--text-secondary)", fontSize: "15px", marginTop: "4px" }}>
              Connect unique RSS 2.0 XML feeds to multiple Pinterest Business Accounts for 100% automated daily Pin creation.
            </p>
          </div>
        </div>
      </div>

      {/* Info Banner */}
      <div className="card" style={{ padding: "20px 24px", borderRadius: "14px", border: "1px solid var(--accent-light)", backgroundColor: "rgba(13, 148, 136, 0.04)", marginBottom: "32px" }}>
        <div style={{ display: "flex", gap: "16px", alignItems: "flex-start" }}>
          <div style={{ fontSize: "24px" }}>💡</div>
          <div>
            <h3 style={{ fontSize: "16px", fontWeight: "700", margin: "0 0 6px 0", color: "var(--text-primary)" }}>
              How Pinterest Auto-Publishing Works via RSS:
            </h3>
            <ul style={{ margin: 0, paddingLeft: "20px", color: "var(--text-secondary)", fontSize: "14px", lineHeight: "1.6" }}>
              <li><strong>Pinterest automatically checks your RSS feed URL</strong> every few hours (up to 200 Pins/day).</li>
              <li><strong>Every feed contains valid RSS 2.0 XML</strong> with <code>&lt;media:content&gt;</code> image tags pointing to your Cloudflare R2 creatives.</li>
              <li><strong>Destination links strictly match your claimed website domain</strong> to pass Pinterest domain verification.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Add New Channel Card */}
      <div className="card" style={{ padding: "24px", borderRadius: "16px", border: "1px solid var(--border-default)", backgroundColor: "var(--bg-primary)", marginBottom: "32px" }}>
        <h2 style={{ fontSize: "18px", fontWeight: "700", color: "var(--text-primary)", marginTop: 0, marginBottom: "16px" }}>
          ➕ Create RSS Feed for New Account / Niche
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "16px", alignItems: "end" }}>
          <div>
            <label style={{ fontSize: "13px", fontWeight: "600", color: "var(--text-primary)", display: "block", marginBottom: "6px" }}>
              Account or Channel Name
            </label>
            <input
              type="text"
              className="input"
              value={newAccountName}
              onChange={(e) => setNewAccountName(e.target.value)}
              placeholder="e.g. Account #4 - Minimalist Decor"
              style={{ width: "100%" }}
            />
          </div>

          <div>
            <label style={{ fontSize: "13px", fontWeight: "600", color: "var(--text-primary)", display: "block", marginBottom: "6px" }}>
              Claimed Website Domain
            </label>
            <input
              type="url"
              className="input"
              value={newClaimedDomain}
              onChange={(e) => setNewClaimedDomain(e.target.value)}
              placeholder="https://yourdomain.com"
              style={{ width: "100%" }}
            />
          </div>

          <div>
            <label style={{ fontSize: "13px", fontWeight: "600", color: "var(--text-primary)", display: "block", marginBottom: "6px" }}>
              Filter Theme / Niche
            </label>
            <select
              className="input"
              value={newThemeFilter}
              onChange={(e) => setNewThemeFilter(e.target.value)}
              style={{ width: "100%" }}
            >
              <option value="all">All Creatives (No Filter)</option>
              <option value="General">General / Aesthetics</option>
              <option value="Summer">Summer Refresh</option>
              <option value="Fall">Cozy Fall</option>
              <option value="Winter">Winter / Christmas</option>
            </select>
          </div>

          <div>
            <button
              className="btn btn-primary"
              onClick={handleAddChannel}
              style={{ width: "100%", padding: "11px 20px", fontWeight: "600", backgroundColor: "#E60023", color: "white" }}
            >
              Generate RSS Feed Link
            </button>
          </div>
        </div>
      </div>

      {/* Active RSS Channels List */}
      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        <h2 style={{ fontSize: "20px", fontWeight: "700", color: "var(--text-primary)", margin: 0 }}>
          📋 Active Pinterest RSS Feeds ({channels.length})
        </h2>

        {channels.map((ch) => {
          const rssUrl = getRSSUrl(ch);
          return (
            <div key={ch.id} className="card" style={{ padding: "20px 24px", borderRadius: "14px", border: "1px solid var(--border-default)", backgroundColor: "var(--bg-primary)", display: "flex", flexDirection: "column", gap: "14px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <h3 style={{ fontSize: "16px", fontWeight: "700", color: "var(--text-primary)", margin: 0 }}>
                    {ch.accountName}
                  </h3>
                  <div style={{ display: "flex", gap: "12px", marginTop: "4px", fontSize: "13px", color: "var(--text-secondary)" }}>
                    <span>🌐 Claimed Domain: <strong>{ch.claimedDomain}</strong></span>
                    <span>•</span>
                    <span>🎨 Filter: <strong>{ch.themeFilter === "all" ? "All Creatives" : ch.themeFilter}</strong></span>
                    <span>•</span>
                    <span>⚡ Limit: <strong>Up to 200 Pins</strong></span>
                  </div>
                </div>

                <button
                  onClick={() => handleDeleteChannel(ch.id)}
                  style={{ background: "none", border: "none", color: "var(--error)", cursor: "pointer", fontSize: "13px", fontWeight: "600" }}
                >
                  Delete
                </button>
              </div>

              {/* RSS Link Box */}
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

      {/* Daily RSS Activity & Image Logs Table */}
      <div className="card" style={{ padding: "24px", borderRadius: "16px", border: "1px solid var(--border-default)", backgroundColor: "var(--bg-primary)", marginTop: "32px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <div>
            <h2 style={{ fontSize: "18px", fontWeight: "700", color: "var(--text-primary)", margin: 0 }}>
              📊 Daily RSS Publication & Image Activity Logs
            </h2>
            <p style={{ color: "var(--text-secondary)", fontSize: "13px", marginTop: "4px" }}>
              Day-by-day record of generated Pins, target account channels, and RSS status.
            </p>
          </div>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border-default)", textAlign: "left", color: "var(--text-secondary)" }}>
                <th style={{ padding: "10px" }}>Date</th>
                <th style={{ padding: "10px" }}>Account Channel</th>
                <th style={{ padding: "10px" }}>Images Generated</th>
                <th style={{ padding: "10px" }}>Claimed Domain</th>
                <th style={{ padding: "10px" }}>RSS Feed Status</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: "1px solid var(--border-default)" }}>
                <td style={{ padding: "12px 10px", fontWeight: "600" }}>2026-07-27 (Today)</td>
                <td style={{ padding: "12px 10px" }}>Account #1 (Main Store)</td>
                <td style={{ padding: "12px 10px", color: "var(--success)", fontWeight: "700" }}>10 Pins</td>
                <td style={{ padding: "12px 10px" }}>https://vulius.com</td>
                <td style={{ padding: "12px 10px" }}>
                  <span style={{ backgroundColor: "#D1FAE5", color: "#065F46", padding: "4px 10px", borderRadius: "20px", fontWeight: "600", fontSize: "12px" }}>
                    ✓ 10 Items Ready for Pinterest
                  </span>
                </td>
              </tr>
              <tr style={{ borderBottom: "1px solid var(--border-default)" }}>
                <td style={{ padding: "12px 10px", fontWeight: "600" }}>2026-07-27 (Today)</td>
                <td style={{ padding: "12px 10px" }}>Account #2 (NfcWest / Niche)</td>
                <td style={{ padding: "12px 10px", color: "var(--success)", fontWeight: "700" }}>10 Pins</td>
                <td style={{ padding: "12px 10px" }}>https://nfcwestjersey.com/</td>
                <td style={{ padding: "12px 10px" }}>
                  <span style={{ backgroundColor: "#D1FAE5", color: "#065F46", padding: "4px 10px", borderRadius: "20px", fontWeight: "600", fontSize: "12px" }}>
                    ✓ 10 Items Ready for Pinterest
                  </span>
                </td>
              </tr>
              <tr>
                <td style={{ padding: "12px 10px", fontWeight: "600" }}>2026-07-26 (Yesterday)</td>
                <td style={{ padding: "12px 10px" }}>Account #1 (Main Store)</td>
                <td style={{ padding: "12px 10px", color: "var(--success)", fontWeight: "700" }}>10 Pins</td>
                <td style={{ padding: "12px 10px" }}>https://vulius.com</td>
                <td style={{ padding: "12px 10px" }}>
                  <span style={{ backgroundColor: "#E0E7FF", color: "#3730A3", padding: "4px 10px", borderRadius: "20px", fontWeight: "600", fontSize: "12px" }}>
                    ✓ Published by Pinterest
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Setup Guide Step-by-Step */}
      <div className="card" style={{ padding: "28px", borderRadius: "16px", border: "1px solid var(--border-default)", backgroundColor: "var(--bg-primary)", marginTop: "40px" }}>
        <h2 style={{ fontSize: "20px", fontWeight: "700", color: "var(--text-primary)", marginTop: 0, marginBottom: "16px" }}>
          📌 How to Connect RSS Feed in Pinterest Business Account:
        </h2>
        <ol style={{ margin: 0, paddingLeft: "20px", color: "var(--text-secondary)", fontSize: "14px", lineHeight: "1.8" }}>
          <li>Log into your <strong>Pinterest Business Account</strong>.</li>
          <li>Click your profile icon at top right → <strong>Settings</strong> → <strong>Auto-publish Pins</strong> (or <strong>Bulk creation</strong>).</li>
          <li>Under <strong>Auto-publish Pins from RSS feed</strong>, click <strong>Connect RSS feed</strong>.</li>
          <li>Paste the copied RSS Feed URL (e.g. <code>{API_BASE}/api/pinterest/rss/account-main?domain=https://vulius.com</code>).</li>
          <li>Choose your target Pinterest board (e.g. <em>Small Apartment Decor</em>) and click <strong>Save</strong>.</li>
          <li>Pinterest will now automatically check your RSS feed and publish your generated AI creatives into Pins every day!</li>
        </ol>
      </div>
    </div>
  );
}
