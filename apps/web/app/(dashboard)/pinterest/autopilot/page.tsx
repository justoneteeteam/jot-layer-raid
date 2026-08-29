"use client";

import React, { useState, useEffect, useRef } from "react";

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

interface QueueJob {
  jobId: string;
  type?: string;
  status: string;
  channelId?: string;
  channelName?: string;
  niche?: string;
  nicheId?: number | null;
  claimedDomain?: string;
  keywords?: string[] | string;
  themes?: string[] | string;
  styles?: string[] | string;
  model?: string;
  total: number;
  completed: number;
  failed: number;
  progress?: number;
  createdAt?: string;
  finishedAt?: string;
  elapsedMs?: number;
}

export default function PinterestAutoPilotManager() {
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://api-worker.justoneteeteam.workers.dev";

  const [channels, setChannels] = useState<AccountChannel[]>([]);
  const [niches, setNiches] = useState<Array<{ id: number; name: string }>>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [activeJobs, setActiveJobs] = useState<QueueJob[]>([]);
  const [queueHistory, setQueueHistory] = useState<QueueJob[]>([]);
  const [cancellingJobId, setCancellingJobId] = useState<string | null>(null);
  const [deletingJobId, setDeletingJobId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<"all" | "batch" | "autopilot">("all");
  const [historyFilter, setHistoryFilter] = useState<"all" | "batch" | "autopilot">("all");

  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [generatedResults, setGeneratedResults] = useState<any[]>([]);

  // New Account Modal State
  const [newAccountName, setNewAccountName] = useState("");
  const [newNiche, setNewNiche] = useState("Home Decor");
  const [newNicheId, setNewNicheId] = useState<number | null>(null);
  const [newDomain, setNewDomain] = useState("https://vulius.com");
  const [newLimit, setNewLimit] = useState(10);
  const [newKeywords, setNewKeywords] = useState("cozy room decor, luxury interior, aesthetic bedroom");

  const pollTimerRef = useRef<any>(null);

  useEffect(() => {
    fetchChannelsAndNiches();
    fetchQueueData();

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, []);

  // Poll active queue every 5 seconds if there are running jobs
  useEffect(() => {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);

    const hasRunningJobs = activeJobs.some(j => j.status === "running");
    if (hasRunningJobs || isRunning) {
      pollTimerRef.current = setInterval(() => {
        fetchQueueData();
      }, 5000);
    }

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [activeJobs, isRunning]);

  const fetchChannelsAndNiches = async () => {
    try {
      const [cRes, nRes] = await Promise.all([
        fetch(`${API_BASE}/api/pinterest/channels?_t=${Date.now()}`),
        fetch(`${API_BASE}/api/pinterest/niches?status=approved`)
      ]);

      if (cRes.ok) {
        const data = await cRes.json();
        if (Array.isArray(data)) {
          const mapped: AccountChannel[] = data.map((c: any) => ({
            id: c.id,
            name: c.name || c.accountName || c.id,
            niche: c.niche || "Home Decor",
            claimedDomain: c.claimedDomain || "https://vulius.com",
            dailyPinLimit: c.dailyPinLimit || 10,
            keywords: Array.isArray(c.keywords) ? c.keywords.join(", ") : (c.keywords || "small apartment decor"),
            themes: c.themes || ["General"],
            styles: c.styles || ["Modern Scandinavian"],
            model: c.model || "flux"
          }));
          setChannels(mapped);
        }
      }

      if (nRes.ok) {
        const nData = await nRes.json();
        if (Array.isArray(nData)) {
          setNiches(nData);
        }
      }
    } catch (e) {
      console.error("Error fetching data:", e);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchQueueData = async () => {
    try {
      const [activeRes, historyRes] = await Promise.all([
        fetch(`${API_BASE}/api/pinterest/queue/active?_t=${Date.now()}`),
        fetch(`${API_BASE}/api/pinterest/queue/history?limit=20&_t=${Date.now()}`)
      ]);

      if (activeRes.ok) {
        const data = await activeRes.json();
        if (data.ok && Array.isArray(data.jobs)) {
          setActiveJobs(data.jobs);
        }
      }

      if (historyRes.ok) {
        const hData = await historyRes.json();
        if (hData.ok && Array.isArray(hData.jobs)) {
          setQueueHistory(hData.jobs);
        }
      }
    } catch (e) {
      console.error("Error fetching queue data:", e);
    }
  };

  const getRSSUrl = (ch: AccountChannel) => {
    return `${API_BASE}/api/pinterest/rss/${ch.id}?domain=${encodeURIComponent(ch.claimedDomain)}`;
  };

  const handleAddAccount = async () => {
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
    const updated = [...channels, newCh];
    setChannels(updated);
    setNewAccountName("");

    try {
      await fetch(`${API_BASE}/api/pinterest/channels`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: newCh.id,
          name: newCh.name,
          niche: newCh.niche,
          nicheId: newNicheId,
          claimedDomain: newCh.claimedDomain,
          dailyPinLimit: newCh.dailyPinLimit,
          keywords: newCh.keywords.split(",").map(k => k.trim()).filter(Boolean),
          themes: newCh.themes,
          styles: newCh.styles,
          model: newCh.model
        })
      });
      fetchChannelsAndNiches();
    } catch (e) {
      console.error("Error saving channel:", e);
    }
  };

  const handleDeleteAccount = async (id: string) => {
    const runningForChannel = activeJobs.filter(j => (j.channelId === id || j.jobId.includes(id)) && j.status === "running");
    
    let confirmMsg = `Are you sure you want to remove account channel "${id}"?`;
    if (runningForChannel.length > 0) {
      confirmMsg = `⚠️ This channel has ${runningForChannel.length} active running queue tasks. Deleting this channel will CANCEL all running jobs. Proceed?`;
    }

    if (!confirm(confirmMsg)) return;

    const updated = channels.filter(c => c.id !== id);
    setChannels(updated);

    try {
      const res = await fetch(`${API_BASE}/api/pinterest/autopilot/${encodeURIComponent(id)}`, {
        method: "DELETE"
      });
      const data = await res.json();
      if (data.cancelledJobs > 0) {
        setLogs(prev => [...prev, `🛑 Cancelled ${data.cancelledJobs} active jobs for channel ${id}`]);
      }
      fetchChannelsAndNiches();
      fetchQueueData();
    } catch (e) {
      console.error("Error deleting channel:", e);
    }
  };

  const handleCancelJob = async (jobId: string) => {
    if (!confirm(`Cancel running job "${jobId}"?`)) return;

    setCancellingJobId(jobId);
    try {
      const res = await fetch(`${API_BASE}/api/pinterest/queue/${encodeURIComponent(jobId)}/cancel`, {
        method: "POST"
      });
      const data = await res.json();
      if (data.ok) {
        setLogs(prev => [...prev, `🛑 Successfully cancelled job ${jobId}`]);
        // Optimistically update local active jobs
        setActiveJobs(prev => prev.map(j => j.jobId === jobId ? { ...j, status: "cancelled" } : j));
        setTimeout(fetchQueueData, 1000);
      }
    } catch (e: any) {
      alert(`Error cancelling job: ${e.message}`);
    } finally {
      setCancellingJobId(null);
    }
  };

  const formatDuration = (ms?: number) => {
    if (!ms || ms <= 0) return "< 1s";
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSecs = seconds % 60;
    if (minutes < 60) return `${minutes}m ${remainingSecs}s`;
    const hours = Math.floor(minutes / 60);
    const remainingMins = minutes % 60;
    return `${hours}h ${remainingMins}m`;
  };

  const handleDeleteJob = async (jobId: string, pinsCount?: number) => {
    const pinText = pinsCount ? ` and its ${pinsCount} generated pin(s)` : "";
    if (!confirm(`Are you sure you want to permanently remove job "${jobId}"${pinText}?\n\nThis will delete metadata from KV, records from database, and generated image files.`)) {
      return;
    }

    setDeletingJobId(jobId);
    try {
      const res = await fetch(`${API_BASE}/api/pinterest/queue/${encodeURIComponent(jobId)}`, {
        method: "DELETE"
      });
      const data = await res.json();
      if (data.ok) {
        setLogs(prev => [...prev, `🗑️ Permanently removed job ${jobId} (deleted ${data.deletedPins || 0} pin records)`]);
        setActiveJobs(prev => prev.filter(j => j.jobId !== jobId));
        setQueueHistory(prev => prev.filter(j => j.jobId !== jobId));
        setTimeout(fetchQueueData, 1000);
      } else {
        alert(`Failed to delete job: ${data.error || "Unknown error"}`);
      }
    } catch (e: any) {
      alert(`Error deleting job: ${e.message}`);
    } finally {
      setDeletingJobId(null);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleRunAutoPilot = async () => {
    setIsRunning(true);
    setLogs(["⚡ Initiating Multi-Account Auto-Pilot queue run..."]);

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

      setLogs(prev => [...prev, `🔄 Enqueueing ${channels.length} account channels to unified Pinterest Queue...`]);

      const res = await fetch(`${API_BASE}/api/pinterest/autopilot/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channels: payloadChannels })
      });

      const data = await res.json();
      if (data.ok) {
        setLogs(prev => [
          ...prev,
          `🎉 Enqueued ${data.jobsCount || data.jobs?.length || channels.length} channel jobs into unified Pinterest Queue!`,
          `📡 Processing in background. Watch live progress in the Running Queues panel below.`
        ]);
        fetchQueueData();
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
              Multi-Account Pinterest Auto-Pilot & Queue Manager
            </h1>
            <p style={{ color: "var(--text-secondary)", fontSize: "15px", marginTop: "4px" }}>
              Unified Pinterest automation engine: daily scheduled pins, live queue monitor, and instant cancellation.
            </p>
          </div>
        </div>

        <button
          className="btn btn-primary"
          onClick={handleRunAutoPilot}
          disabled={isRunning}
          style={{ backgroundColor: "#E60023", color: "white", padding: "12px 24px", fontWeight: "700", fontSize: "15px", borderRadius: "10px", display: "flex", alignItems: "center", gap: "8px" }}
        >
          {isRunning ? "🔄 Enqueueing..." : "⚡ Run Auto-Pilot Now (All Accounts)"}
        </button>
      </div>

      {/* Zero-Duplication Guarantee Badge */}
      <div className="card" style={{ padding: "18px 22px", borderRadius: "14px", border: "1px solid var(--accent-light)", backgroundColor: "rgba(13, 148, 136, 0.04)", marginBottom: "32px", display: "flex", alignItems: "center", gap: "16px" }}>
        <div style={{ fontSize: "26px" }}>🛡️</div>
        <div>
          <h3 style={{ fontSize: "15px", fontWeight: "700", color: "var(--text-primary)", margin: "0 0 4px 0" }}>
            Unified Zero-Duplication Queue Architecture
          </h3>
          <p style={{ fontSize: "13px", color: "var(--text-secondary)", margin: 0, lineHeight: "1.5" }}>
            Both Autopilot recipes and Batch matrix permutations feed into the single <strong>pinterest-jobs</strong> queue. Each account receives distinct keyword/theme allocations and isolated RSS feeds.
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

      {/* ── LIVE RUNNING QUEUES & ACTIVE JOBS PANEL ──────────────────────── */}
      <div className="card" style={{ padding: "24px", borderRadius: "16px", border: "1px solid var(--border-default)", backgroundColor: "var(--bg-primary)", marginBottom: "32px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            <span style={{ fontSize: "20px" }}>🔄</span>
            <h2 style={{ fontSize: "18px", fontWeight: "700", color: "var(--text-primary)", margin: 0 }}>
              Live Running Queues & Tasks ({activeJobs.length})
            </h2>
            {activeJobs.length > 0 && (
              <span style={{ backgroundColor: "#FEF3C7", color: "#B45309", padding: "3px 10px", borderRadius: "12px", fontSize: "12px", fontWeight: "700", animation: "pulse 2s infinite" }}>
                ● Active Processing
              </span>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {/* Active Queue Filter Pills */}
            <div style={{ display: "flex", backgroundColor: "var(--bg-secondary)", padding: "3px", borderRadius: "8px", border: "1px solid var(--border-default)", gap: "2px" }}>
              {(["all", "batch", "autopilot"] as const).map((filterKey) => {
                const count = filterKey === "all"
                  ? activeJobs.length
                  : activeJobs.filter(j => (j.type || "batch") === filterKey).length;
                const isSel = activeFilter === filterKey;
                return (
                  <button
                    key={filterKey}
                    onClick={() => setActiveFilter(filterKey)}
                    style={{
                      padding: "4px 10px",
                      fontSize: "11px",
                      fontWeight: isSel ? "700" : "500",
                      borderRadius: "6px",
                      border: "none",
                      backgroundColor: isSel ? "var(--bg-primary)" : "transparent",
                      color: isSel ? "var(--text-primary)" : "var(--text-secondary)",
                      cursor: "pointer",
                      boxShadow: isSel ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                      textTransform: "capitalize"
                    }}
                  >
                    {filterKey} ({count})
                  </button>
                );
              })}
            </div>

            <button
              onClick={fetchQueueData}
              className="btn btn-secondary"
              style={{ fontSize: "12px", padding: "6px 12px" }}
            >
              🔄 Refresh Queue
            </button>
          </div>
        </div>

        {activeJobs.length === 0 ? (
          <div style={{ padding: "24px", textAlign: "center", borderRadius: "10px", backgroundColor: "var(--bg-secondary)", color: "var(--text-secondary)", fontSize: "13px" }}>
            ✅ No active Pinterest queues currently running. All automated and batch tasks are completed.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {activeJobs
              .filter(j => activeFilter === "all" || (j.type || "batch") === activeFilter)
              .map((job) => {
                const progress = job.total > 0 ? Math.round(((job.completed || 0) + (job.failed || 0)) / job.total * 100) : 0;
                const isCancelling = cancellingJobId === job.jobId;
                const isDeleting = deletingJobId === job.jobId;
                const elapsed = job.elapsedMs || (job.createdAt ? Math.max(0, Date.now() - new Date(job.createdAt).getTime()) : 0);

                // Format keywords as array
                const kwList = Array.isArray(job.keywords)
                  ? job.keywords
                  : (typeof job.keywords === "string" ? job.keywords.split(",").map(k => k.trim()) : []);

                const thList = Array.isArray(job.themes) ? job.themes : [];
                const stList = Array.isArray(job.styles) ? job.styles : [];

                return (
                  <div
                    key={job.jobId}
                    style={{
                      padding: "20px",
                      borderRadius: "14px",
                      border: "1px solid var(--border-default)",
                      backgroundColor: "var(--bg-secondary)",
                      display: "flex",
                      flexDirection: "column",
                      gap: "14px",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.03)"
                    }}
                  >
                    {/* Row 1: Header + Badges + Actions */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "10px" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                          <span
                            style={{
                              backgroundColor: job.type === "autopilot" ? "#FEE2E2" : "#DBEAFE",
                              color: job.type === "autopilot" ? "#DC2626" : "#2563EB",
                              padding: "4px 9px",
                              borderRadius: "6px",
                              fontSize: "11px",
                              fontWeight: "800",
                              letterSpacing: "0.5px",
                              textTransform: "uppercase"
                            }}
                          >
                            {job.type || "BATCH"}
                          </span>

                          <span style={{ fontSize: "16px", fontWeight: "700", color: "var(--text-primary)" }}>
                            🏢 {job.channelName || (job.channelId ? `Account: ${job.channelId}` : "Ad-Hoc Batch")}
                          </span>

                          {job.channelId && (
                            <span style={{ fontSize: "12px", color: "var(--text-secondary)", fontFamily: "monospace", backgroundColor: "var(--bg-primary)", padding: "2px 8px", borderRadius: "6px", border: "1px solid var(--border-default)" }}>
                              #{job.channelId}
                            </span>
                          )}

                          {job.claimedDomain && (
                            <span style={{ fontSize: "12px", color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: "4px" }}>
                              🌐 {job.claimedDomain}
                            </span>
                          )}

                          {/* Elapsed Running Time Badge */}
                          <span
                            style={{
                              fontSize: "11px",
                              fontWeight: "700",
                              padding: "2px 8px",
                              borderRadius: "6px",
                              backgroundColor: "rgba(245, 158, 11, 0.15)",
                              color: "#B45309",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px"
                            }}
                          >
                            ⏱ Running: {formatDuration(elapsed)}
                          </span>
                        </div>

                        <div style={{ fontSize: "12px", color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                          <span>Job ID: <code style={{ fontSize: "11px" }}>{job.jobId}</code></span>
                          {job.createdAt && (
                            <span>• Started: {new Date(job.createdAt).toLocaleTimeString()}</span>
                          )}
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <div style={{ textAlign: "right" }}>
                          <span style={{ fontSize: "14px", fontWeight: "700", color: "var(--text-primary)" }}>
                            {job.completed || 0} / {job.total} pins
                          </span>
                          <span style={{ fontSize: "12px", color: "var(--text-secondary)", marginLeft: "6px" }}>
                            ({progress}%)
                          </span>
                        </div>

                        <button
                          onClick={() => handleCancelJob(job.jobId)}
                          disabled={isCancelling || isDeleting}
                          className="btn"
                          style={{
                            backgroundColor: "#EF4444",
                            color: "white",
                            padding: "8px 14px",
                            fontSize: "12px",
                            fontWeight: "700",
                            borderRadius: "8px",
                            border: "none",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: "6px"
                          }}
                        >
                          {isCancelling ? "Cancelling..." : "🛑 Cancel"}
                        </button>

                        <button
                          onClick={() => handleDeleteJob(job.jobId, job.completed)}
                          disabled={isCancelling || isDeleting}
                          className="btn"
                          title="Permanently remove job, clear queue metadata and delete generated pins"
                          style={{
                            backgroundColor: "transparent",
                            border: "1px solid #DC2626",
                            color: "#DC2626",
                            padding: "8px 12px",
                            fontSize: "12px",
                            fontWeight: "700",
                            borderRadius: "8px",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: "4px"
                          }}
                        >
                          {isDeleting ? "Deleting..." : "🗑️ Delete"}
                        </button>
                      </div>
                    </div>

                  {/* Row 2: Niche Library & Prompts Context Box */}
                  <div
                    style={{
                      padding: "12px 16px",
                      borderRadius: "10px",
                      backgroundColor: "var(--bg-primary)",
                      border: "1px solid var(--border-default)",
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                      fontSize: "12px"
                    }}
                  >
                    {/* Niche Library Tag */}
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                      <span style={{ fontWeight: "700", color: "var(--text-secondary)" }}>📚 Niche Library:</span>
                      <span
                        style={{
                          backgroundColor: "rgba(13, 148, 136, 0.1)",
                          color: "#0F766E",
                          padding: "3px 10px",
                          borderRadius: "6px",
                          fontWeight: "700"
                        }}
                      >
                        ✨ {job.niche || "Home Decor"}
                      </span>

                      <span style={{ fontWeight: "700", color: "var(--text-secondary)", marginLeft: "8px" }}>🤖 AI Model:</span>
                      <span
                        style={{
                          backgroundColor: "rgba(99, 102, 241, 0.1)",
                          color: "#4338CA",
                          padding: "3px 8px",
                          borderRadius: "6px",
                          fontWeight: "700"
                        }}
                      >
                        {(job.model || "flux").toUpperCase()}
                      </span>
                    </div>

                    {/* Keywords Chips */}
                    {kwList.length > 0 && (
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                        <span style={{ fontWeight: "700", color: "var(--text-secondary)" }}>🏷️ Keywords:</span>
                        {kwList.slice(0, 6).map((kw, i) => (
                          <span
                            key={i}
                            style={{
                              backgroundColor: "var(--bg-secondary)",
                              color: "var(--text-primary)",
                              padding: "2px 8px",
                              borderRadius: "6px",
                              border: "1px solid var(--border-default)",
                              fontSize: "11px"
                            }}
                          >
                            {kw}
                          </span>
                        ))}
                        {kwList.length > 6 && (
                          <span style={{ color: "var(--text-secondary)", fontSize: "11px" }}>
                            +{kwList.length - 6} more
                          </span>
                        )}
                      </div>
                    )}

                    {/* Themes & Styles Chips */}
                    {(thList.length > 0 || stList.length > 0) && (
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                        {thList.length > 0 && (
                          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                            <span style={{ fontWeight: "700", color: "var(--text-secondary)" }}>🎨 Themes:</span>
                            <span style={{ color: "var(--text-primary)" }}>{thList.slice(0, 3).join(", ")}</span>
                          </div>
                        )}
                        {stList.length > 0 && (
                          <div style={{ display: "flex", alignItems: "center", gap: "4px", marginLeft: thList.length > 0 ? "8px" : "0" }}>
                            <span style={{ fontWeight: "700", color: "var(--text-secondary)" }}>✨ Styles:</span>
                            <span style={{ color: "var(--text-primary)" }}>{stList.slice(0, 3).join(", ")}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Row 3: Progress Bar */}
                  <div style={{ width: "100%", height: "8px", borderRadius: "4px", backgroundColor: "#E5E7EB", overflow: "hidden" }}>
                    <div
                      style={{
                        width: `${progress}%`,
                        height: "100%",
                        backgroundColor: "#E60023",
                        transition: "width 0.3s ease"
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

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
              Niche Category / AI Library
            </label>
            <select
              className="input"
              value={newNiche}
              onChange={(e) => {
                const val = e.target.value;
                setNewNiche(val);
                const match = niches.find(n => n.name === val);
                setNewNicheId(match ? match.id : null);
              }}
              style={{ width: "100%" }}
            >
              {niches.length > 0 && (
                <optgroup label="📚 AI Niche Libraries">
                  {niches.map((n) => (
                    <option key={n.id} value={n.name}>
                      ✨ {n.name}
                    </option>
                  ))}
                </optgroup>
              )}
              <optgroup label="Standard Categories">
                <option value="Home Decor">🛋️ Home Decor</option>
                <option value="Cake Decorating">🎂 Cake Decorating</option>
                <option value="Cooking Recipes">🍳 Cooking Recipes</option>
                <option value="Fashion & Apparel">👗 Fashion & Apparel</option>
              </optgroup>
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
              <option value={5}>5 Pins / day</option>
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
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ fontSize: "20px", fontWeight: "700", color: "var(--text-primary)", margin: 0 }}>
            📌 Account Channels Configured ({channels.length})
          </h2>
          {isLoading && (
            <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
              🔄 Syncing with Cloudflare...
            </span>
          )}
        </div>

        {channels.length === 0 && !isLoading && (
          <div className="card" style={{ padding: "32px", textAlign: "center", borderRadius: "14px", border: "1px dashed var(--border-default)", color: "var(--text-secondary)" }}>
            <p style={{ margin: 0, fontSize: "14px" }}>
              No account channels configured yet. Add an account channel above to configure daily pin generation!
            </p>
          </div>
        )}

        {channels.map((ch) => {
          const rssUrl = getRSSUrl(ch);
          const activeJob = activeJobs.find(j => (j.channelId === ch.id || j.jobId.includes(ch.id)) && j.status === "running");

          return (
            <div key={ch.id} className="card" style={{ padding: "24px", borderRadius: "16px", border: "1px solid var(--border-default)", backgroundColor: "var(--bg-primary)", display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ color: activeJob ? "#F59E0B" : "#10B981", fontSize: "14px" }}>
                      {activeJob ? "🟠" : "🟢"}
                    </span>
                    <h3 style={{ fontSize: "18px", fontWeight: "700", color: "var(--text-primary)", margin: 0 }}>
                      {ch.name}
                    </h3>
                    {activeJob && (
                      <span style={{ backgroundColor: "#FEF3C7", color: "#B45309", padding: "2px 8px", borderRadius: "10px", fontSize: "11px", fontWeight: "700" }}>
                        Queue Running ({activeJob.completed || 0}/{activeJob.total})
                      </span>
                    )}
                  </div>

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
                  {activeJob ? "🛑 Stop & Delete Recipe" : "Remove Account"}
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

      {/* ── QUEUE EXECUTION HISTORY TABLE ─────────────────────────────────── */}
      <div className="card" style={{ padding: "24px", borderRadius: "16px", border: "1px solid var(--border-default)", backgroundColor: "var(--bg-primary)", marginTop: "40px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <h2 style={{ fontSize: "18px", fontWeight: "700", color: "var(--text-primary)", margin: 0 }}>
              📊 Recent Automation & Queue History
            </h2>
            <p style={{ color: "var(--text-secondary)", fontSize: "13px", marginTop: "4px" }}>
              Audit log of daily autopilot triggers, batch jobs, progress, duration, and completion states.
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {/* History Filter Pills */}
            <div style={{ display: "flex", backgroundColor: "var(--bg-secondary)", padding: "3px", borderRadius: "8px", border: "1px solid var(--border-default)", gap: "2px" }}>
              {(["all", "batch", "autopilot"] as const).map((filterKey) => {
                const count = filterKey === "all"
                  ? queueHistory.length
                  : queueHistory.filter(j => (j.type || "batch") === filterKey).length;
                const isSel = historyFilter === filterKey;
                return (
                  <button
                    key={filterKey}
                    onClick={() => setHistoryFilter(filterKey)}
                    style={{
                      padding: "4px 10px",
                      fontSize: "11px",
                      fontWeight: isSel ? "700" : "500",
                      borderRadius: "6px",
                      border: "none",
                      backgroundColor: isSel ? "var(--bg-primary)" : "transparent",
                      color: isSel ? "var(--text-primary)" : "var(--text-secondary)",
                      cursor: "pointer",
                      boxShadow: isSel ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                      textTransform: "capitalize"
                    }}
                  >
                    {filterKey} ({count})
                  </button>
                );
              })}
            </div>

            <button
              onClick={fetchQueueData}
              className="btn btn-secondary"
              style={{ fontSize: "12px", padding: "6px 12px" }}
            >
              🔄 Refresh History
            </button>
          </div>
        </div>

        {queueHistory.length === 0 ? (
          <div style={{ padding: "20px", textAlign: "center", color: "var(--text-secondary)", fontSize: "13px" }}>
            No previous queue execution history logged yet.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border-default)", textAlign: "left", color: "var(--text-secondary)" }}>
                  <th style={{ padding: "10px" }}>Job ID / Type</th>
                  <th style={{ padding: "10px" }}>Channel / Target</th>
                  <th style={{ padding: "10px" }}>Status</th>
                  <th style={{ padding: "10px" }}>Progress</th>
                  <th style={{ padding: "10px" }}>Created & Duration</th>
                  <th style={{ padding: "10px", textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {queueHistory
                  .filter(j => historyFilter === "all" || (j.type || "batch") === historyFilter)
                  .map((job) => {
                    let statusBg = "#D1FAE5";
                    let statusColor = "#065F46";
                    let statusLabel = "Completed";

                    if (job.status === "running") {
                      statusBg = "#FEF3C7";
                      statusColor = "#B45309";
                      statusLabel = "Running";
                    } else if (job.status === "cancelled") {
                      statusBg = "#FEE2E2";
                      statusColor = "#DC2626";
                      statusLabel = "Cancelled";
                    } else if (job.status === "failed") {
                      statusBg = "#FEE2E2";
                      statusColor = "#DC2626";
                      statusLabel = "Failed";
                    }

                    const isDeleting = deletingJobId === job.jobId;
                    const isCancelling = cancellingJobId === job.jobId;

                    return (
                      <tr key={job.jobId} style={{ borderBottom: "1px solid var(--border-default)" }}>
                        <td style={{ padding: "12px 10px", fontWeight: "600" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <span
                              style={{
                                fontSize: "10px",
                                padding: "2px 6px",
                                borderRadius: "4px",
                                backgroundColor: job.type === "autopilot" ? "#FEE2E2" : "#DBEAFE",
                                color: job.type === "autopilot" ? "#DC2626" : "#2563EB",
                                fontWeight: "700"
                              }}
                            >
                              {(job.type || "batch").toUpperCase()}
                            </span>
                            <span style={{ fontFamily: "monospace", fontSize: "12px" }}>
                              {job.jobId.length > 20 ? `${job.jobId.slice(0, 18)}...` : job.jobId}
                            </span>
                          </div>
                        </td>
                        <td style={{ padding: "12px 10px" }}>
                          <div style={{ fontWeight: "600", color: "var(--text-primary)" }}>
                            {job.channelName || (job.channelId ? `Account: ${job.channelId}` : "Ad-Hoc Batch")}
                          </div>
                          <div style={{ fontSize: "11px", color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: "6px", marginTop: "2px" }}>
                            <span style={{ color: "#0F766E", fontWeight: "600" }}>✨ {job.niche || "Home Decor"}</span>
                            {job.claimedDomain && <span>• 🌐 {job.claimedDomain.replace(/^https?:\/\//, "")}</span>}
                          </div>
                        </td>
                        <td style={{ padding: "12px 10px" }}>
                          <span style={{ backgroundColor: statusBg, color: statusColor, padding: "3px 10px", borderRadius: "12px", fontWeight: "700", fontSize: "11px" }}>
                            {statusLabel}
                          </span>
                        </td>
                        <td style={{ padding: "12px 10px" }}>
                          <span style={{ fontWeight: "600" }}>{job.completed || 0}</span> / {job.total} pins
                          {job.failed ? <span style={{ color: "#DC2626", fontSize: "11px", marginLeft: "4px" }}>({job.failed} failed)</span> : null}
                        </td>
                        <td style={{ padding: "12px 10px", color: "var(--text-secondary)", fontSize: "12px" }}>
                          <div>{job.createdAt ? new Date(job.createdAt).toLocaleString() : "—"}</div>
                          {job.elapsedMs ? (
                            <div style={{ fontSize: "11px", color: "#6B7280", marginTop: "2px", display: "flex", alignItems: "center", gap: "3px" }}>
                              <span>⏱ Duration:</span>
                              <span style={{ fontWeight: "600", color: "var(--text-primary)" }}>{formatDuration(job.elapsedMs)}</span>
                            </div>
                          ) : null}
                        </td>
                        <td style={{ padding: "12px 10px", textAlign: "right" }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "6px" }}>
                            {job.status === "running" && (
                              <button
                                onClick={() => handleCancelJob(job.jobId)}
                                disabled={isCancelling || isDeleting}
                                style={{
                                  background: "none",
                                  border: "1px solid #DC2626",
                                  color: "#DC2626",
                                  padding: "4px 8px",
                                  borderRadius: "6px",
                                  fontSize: "11px",
                                  fontWeight: "700",
                                  cursor: "pointer"
                                }}
                              >
                                {isCancelling ? "Cancelling..." : "🛑 Cancel"}
                              </button>
                            )}

                            <button
                              onClick={() => handleDeleteJob(job.jobId, job.completed)}
                              disabled={isCancelling || isDeleting}
                              title="Permanently remove job and purge generated pins"
                              style={{
                                background: "none",
                                border: "1px solid var(--border-default)",
                                color: "#DC2626",
                                padding: "4px 8px",
                                borderRadius: "6px",
                                fontSize: "11px",
                                fontWeight: "600",
                                cursor: "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "3px"
                              }}
                            >
                              {isDeleting ? "Deleting..." : "🗑️ Delete"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
