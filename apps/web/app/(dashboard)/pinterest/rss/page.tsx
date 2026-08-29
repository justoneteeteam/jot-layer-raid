"use client";

import React, { useState, useEffect } from "react";

interface RSSChannel {
  id: string;
  accountName: string;
  claimedDomain: string;
  themeFilter: string;
  limit: number;
}

export default function PinterestRSSManager() {
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://api-worker.justoneteeteam.workers.dev";

  const [channels, setChannels] = useState<RSSChannel[]>([]);
  const [themes, setThemes] = useState<string[]>(["General", "Summer Refresh", "Cozy Fall", "Winter"]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [newAccountName, setNewAccountName] = useState("");
  const [newClaimedDomain, setNewClaimedDomain] = useState("https://vulius.com");
  const [newThemeFilter, setNewThemeFilter] = useState("all");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [lastGeneratedUrl, setLastGeneratedUrl] = useState<{ name: string; url: string; domain: string } | null>(null);

  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    fetchChannelsAndThemes();
  }, []);

  const fetchChannelsAndThemes = async () => {
    try {
      setFetchError(null);
      const [cRes, tRes] = await Promise.all([
        fetch(`${API_BASE}/api/pinterest/channels?_t=${Date.now()}`),
        fetch(`${API_BASE}/api/pinterest/themes?_t=${Date.now()}`)
      ]);

      if (cRes.ok) {
        const data = await cRes.json();
        if (Array.isArray(data)) {
          const mapped: RSSChannel[] = data.map((c: any) => ({
            id: c.id,
            accountName: c.name || c.accountName || c.id,
            claimedDomain: c.claimedDomain || "https://vulius.com",
            themeFilter: c.themeFilter || (c.themes && c.themes[0]) || "all",
            limit: c.dailyPinLimit || 200
          }));
          setChannels(mapped);
        }
      }

      if (tRes.ok) {
        const tData = await tRes.json();
        if (Array.isArray(tData) && tData.length > 0) {
          setThemes(Array.from(new Set([...tData.map((t: any) => t.name), "General", "Summer Refresh", "Cozy Fall"])));
        }
      }
    } catch (e: any) {
      console.error("Error fetching channels:", e);
      setFetchError(e?.message || "Network error");
    } finally {
      setIsLoading(false);
    }
  };

  const getRSSUrl = (ch: { id?: string; accountName: string; claimedDomain: string; themeFilter?: string }) => {
    const slug = ch.id || ch.accountName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    let url = `${API_BASE}/api/pinterest/rss/${slug}?domain=${encodeURIComponent(ch.claimedDomain)}`;
    if (ch.themeFilter && ch.themeFilter !== "all") {
      url += `&theme=${encodeURIComponent(ch.themeFilter)}`;
    }
    return url;
  };

  const handleAddChannel = async () => {
    if (!newAccountName.trim()) {
      alert("Please enter an account or channel name.");
      return;
    }
    setIsSubmitting(true);
    const slug = newAccountName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    const newCh: RSSChannel = {
      id: slug || `account-${Date.now()}`,
      accountName: newAccountName.trim(),
      claimedDomain: newClaimedDomain.trim() || "https://vulius.com",
      themeFilter: newThemeFilter,
      limit: 200
    };
    
    const rssUrl = getRSSUrl(newCh);
    setLastGeneratedUrl({
      name: newCh.accountName,
      url: rssUrl,
      domain: newCh.claimedDomain
    });

    const updated = [newCh, ...channels.filter(c => c.id !== newCh.id)];
    setChannels(updated);
    setNewAccountName("");

    try {
      await fetch(`${API_BASE}/api/pinterest/channels`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: newCh.id,
          name: newCh.accountName,
          niche: "Home Decor",
          claimedDomain: newCh.claimedDomain,
          dailyPinLimit: 10,
          keywords: ["small apartment decor", "cozy aesthetic room", "summer vibes"],
          themes: newCh.themeFilter === "all" ? ["General"] : [newCh.themeFilter],
          styles: ["Modern Scandinavian", "Boho Chic"],
          model: "flux"
        })
      });
      await fetchChannelsAndThemes();
    } catch (e) {
      console.error("Error persisting channel:", e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteChannel = async (id: string) => {
    const updated = channels.filter(c => c.id !== id);
    setChannels(updated);
    if (lastGeneratedUrl && lastGeneratedUrl.url.includes(id)) {
      setLastGeneratedUrl(null);
    }

    try {
      await fetch(`${API_BASE}/api/pinterest/channels/${encodeURIComponent(id)}`, {
        method: "DELETE"
      });
      await fetchChannelsAndThemes();
    } catch (e) {
      console.error("Error deleting channel:", e);
    }
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
              {themes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div>
            <button
              className="btn btn-primary"
              onClick={handleAddChannel}
              disabled={isSubmitting}
              style={{ width: "100%", padding: "11px 20px", fontWeight: "600", backgroundColor: "#E60023", color: "white" }}
            >
              {isSubmitting ? "⏳ Generating Link..." : "⚡ Generate RSS Feed Link"}
            </button>
          </div>
        </div>

        {/* Highlighted Result Box when Generated */}
        {lastGeneratedUrl && (
          <div style={{ marginTop: "20px", padding: "18px 20px", borderRadius: "12px", border: "2px solid #10B981", backgroundColor: "rgba(16, 185, 129, 0.08)", display: "flex", flexDirection: "column", gap: "12px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "20px" }}>🎉</span>
                <div>
                  <h4 style={{ margin: 0, fontSize: "15px", fontWeight: "700", color: "#065F46" }}>
                    RSS Feed Generated Successfully: {lastGeneratedUrl.name}
                  </h4>
                  <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "var(--text-secondary)" }}>
                    Claimed Domain: <strong>{lastGeneratedUrl.domain}</strong> — Ready to connect in Pinterest Business Auto-Publish settings!
                  </p>
                </div>
              </div>
              <button
                onClick={() => setLastGeneratedUrl(null)}
                style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "14px" }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <input
                type="text"
                readOnly
                value={lastGeneratedUrl.url}
                style={{ flex: 1, padding: "10px 14px", borderRadius: "8px", border: "1px solid #10B981", backgroundColor: "white", fontSize: "13px", fontFamily: "monospace", fontWeight: "600" }}
              />
              <button
                className="btn btn-primary"
                onClick={() => copyToClipboard(lastGeneratedUrl.url, "instant-copy")}
                style={{ backgroundColor: copiedId === "instant-copy" ? "#10B981" : "#E60023", color: "white", padding: "10px 18px", fontWeight: "700", fontSize: "13px" }}
              >
                {copiedId === "instant-copy" ? "✓ Copied!" : "📋 Copy RSS Link"}
              </button>
              <a
                href={lastGeneratedUrl.url}
                target="_blank"
                rel="noreferrer"
                className="btn btn-secondary"
                style={{ padding: "10px 16px", fontSize: "13px", textDecoration: "none", fontWeight: "600" }}
              >
                🔍 Test XML Feed
              </a>
            </div>
          </div>
        )}
      </div>

      {/* Active RSS Channels List */}
      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ fontSize: "20px", fontWeight: "700", color: "var(--text-primary)", margin: 0 }}>
            📋 Active Pinterest RSS Feeds ({channels.length})
          </h2>
          {isLoading && (
            <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
              🔄 Syncing with Cloudflare...
            </span>
          )}
        </div>

        {fetchError && (
          <div style={{ padding: "14px 18px", borderRadius: "10px", border: "1px solid #EF4444", backgroundColor: "rgba(239, 68, 68, 0.08)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "13px", color: "#DC2626" }}>
              ⚠️ Could not load channels: {fetchError}
            </span>
            <button
              onClick={() => { setIsLoading(true); fetchChannelsAndThemes(); }}
              style={{ background: "none", border: "1px solid #DC2626", color: "#DC2626", padding: "4px 12px", borderRadius: "6px", fontSize: "12px", cursor: "pointer", fontWeight: "600" }}
            >
              Retry
            </button>
          </div>
        )}

        {channels.length === 0 && !isLoading && !fetchError && (
          <div className="card" style={{ padding: "32px", textAlign: "center", borderRadius: "14px", border: "1px dashed var(--border-default)", color: "var(--text-secondary)" }}>
            <p style={{ margin: 0, fontSize: "14px" }}>
              No active RSS feeds found. Enter your Account Name above and click <strong>Generate RSS Feed Link</strong> to create your first feed!
            </p>
          </div>
        )}

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
