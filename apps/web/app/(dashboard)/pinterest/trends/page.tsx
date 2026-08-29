"use client";

import React, { useState, useEffect } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://api-worker.justoneteeteam.workers.dev";

export default function PinterestTrendsPage() {
  const [trends, setTrends] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [themeFilter, setThemeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [styleFilter, setStyleFilter] = useState("");
  const [themes, setThemes] = useState<any[]>([]);
  const [styles, setStyles] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTrend, setNewTrend] = useState({ keyword: "", theme: "", style: "", product: "", imageUrl: "" });
  const [sortDate, setSortDate] = useState("desc");

  useEffect(() => {
    fetchDropdowns();
    fetchTrends();
  }, []);

  const fetchDropdowns = async () => {
    try {
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };
      const [themesRes, stylesRes] = await Promise.all([
        fetch(`${API_BASE}/api/pinterest/themes`, { headers }),
        fetch(`${API_BASE}/api/pinterest/prompts`, { headers })
      ]);
      if (themesRes.ok) setThemes(await themesRes.json());
      if (stylesRes.ok) setStyles(await stylesRes.json());
    } catch (e) {
      console.error(e);
    }
  };

  const fetchTrends = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/api/pinterest/trends`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setTrends(data.items || data || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddTrend = async () => {
    try {
      const token = localStorage.getItem("token");
      await fetch(`${API_BASE}/api/pinterest/trends`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(newTrend)
      });
      setIsModalOpen(false);
      setNewTrend({ keyword: "", theme: "", style: "", product: "", imageUrl: "" });
      fetchTrends();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const token = localStorage.getItem("token");
      await fetch(`${API_BASE}/api/pinterest/trends/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchTrends();
    } catch (e) {
      console.error(e);
    }
  };

  const handleGenerateSingle = async (trend: any) => {
    try {
      const token = localStorage.getItem("token");
      await fetch(`${API_BASE}/api/pinterest/generate`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(trend)
      });
      fetchTrends();
    } catch (e) {
      console.error(e);
    }
  };

  const handleBulkGenerate = async () => {
    if (selectedIds.size === 0) return;
    try {
      const token = localStorage.getItem("token");
      const trendsToGenerate = trends.filter((t: any) => selectedIds.has(t.id));
      await fetch(`${API_BASE}/api/pinterest/batch`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ trends: trendsToGenerate, generateImages: true, generateSeo: true, variants: 1 })
      });
      setSelectedIds(new Set());
      fetchTrends();
    } catch (e) {
      console.error(e);
    }
  };

  const handleImportCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const token = localStorage.getItem("token");
      const formData = new FormData();
      formData.append("file", file);
      await fetch(`${API_BASE}/api/pinterest/trends/import`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });
      fetchTrends();
    } catch (error) {
      console.error(error);
    }
  };

  const toggleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(new Set(filteredTrends.map((t: any) => t.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const toggleSelect = (id: number) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  let filteredTrends = trends.filter((t: any) => {
    if (search && !t.keyword.toLowerCase().includes(search.toLowerCase())) return false;
    if (themeFilter && t.theme !== themeFilter) return false;
    if (styleFilter && t.style !== styleFilter) return false;
    if (statusFilter !== "all" && t.status !== statusFilter) return false;
    return true;
  });

  filteredTrends.sort((a: any, b: any) => {
    const d1 = new Date(a.createdAt || 0).getTime();
    const d2 = new Date(b.createdAt || 0).getTime();
    return sortDate === "desc" ? d2 - d1 : d1 - d2;
  });

  return (
    <div style={{ padding: "32px", height: "100%", backgroundColor: "var(--bg-secondary)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <h1 style={{ fontFamily: "Space Grotesk, sans-serif", fontSize: "28px", fontWeight: "700", color: "var(--text-primary)", margin: 0 }}>Trend Queue</h1>
        <div style={{ display: "flex", gap: "12px" }}>
          <button className="btn btn-secondary" onClick={() => document.getElementById("csv-upload")?.click()}>Import CSV</button>
          <input type="file" id="csv-upload" style={{ display: "none" }} accept=".csv" onChange={handleImportCSV} />
          <button className="btn btn-primary" onClick={() => setIsModalOpen(true)} style={{ backgroundColor: "var(--accent)" }}>Add Trend</button>
        </div>
      </div>

      <div className="card" style={{ padding: "20px", marginBottom: "24px", display: "flex", gap: "16px", flexWrap: "wrap", alignItems: "center" }}>
        <input type="text" className="input" placeholder="Search keyword..." value={search} onChange={e => setSearch(e.target.value)} style={{ flex: 1, minWidth: "200px" }} />
        
        <select className="input" value={themeFilter} onChange={e => setThemeFilter(e.target.value)}>
          <option value="">All Themes</option>
          {themes.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        
        <select className="input" value={styleFilter} onChange={e => setStyleFilter(e.target.value)}>
          <option value="">All Styles</option>
          {styles.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>

        <select className="input" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="all">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="generating">Generating</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
        </select>

        <button className="btn btn-secondary" onClick={() => setSortDate(d => d === "desc" ? "asc" : "desc")}>
          Sort Date {sortDate === "desc" ? "↓" : "↑"}
        </button>
      </div>

      {selectedIds.size > 0 && (
        <div style={{ marginBottom: "16px", padding: "12px 16px", backgroundColor: "var(--accent-light)", borderRadius: "8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ color: "var(--accent-hover)", fontWeight: "600" }}>{selectedIds.size} items selected</span>
          <button className="btn btn-primary" onClick={handleBulkGenerate} style={{ backgroundColor: "var(--accent)" }}>Bulk Generate</button>
        </div>
      )}

      <div className="table-wrapper card">
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border-default)", backgroundColor: "var(--bg-tertiary)" }}>
              <th style={{ padding: "16px", textAlign: "left", width: "40px" }}>
                <input type="checkbox" onChange={toggleSelectAll} checked={filteredTrends.length > 0 && selectedIds.size === filteredTrends.length} />
              </th>
              <th style={{ padding: "16px", textAlign: "left", fontSize: "14px", fontWeight: "600", color: "var(--text-secondary)" }}>Preview</th>
              <th style={{ padding: "16px", textAlign: "left", fontSize: "14px", fontWeight: "600", color: "var(--text-secondary)" }}>Keyword</th>
              <th style={{ padding: "16px", textAlign: "left", fontSize: "14px", fontWeight: "600", color: "var(--text-secondary)" }}>Theme / Style</th>
              <th style={{ padding: "16px", textAlign: "left", fontSize: "14px", fontWeight: "600", color: "var(--text-secondary)" }}>Status</th>
              <th style={{ padding: "16px", textAlign: "left", fontSize: "14px", fontWeight: "600", color: "var(--text-secondary)" }}>Created Date</th>
              <th style={{ padding: "16px", textAlign: "right", fontSize: "14px", fontWeight: "600", color: "var(--text-secondary)" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredTrends.map((trend: any) => (
              <tr key={trend.id} style={{ borderBottom: "1px solid var(--border-default)", ':hover': { backgroundColor: "var(--bg-tertiary)" } } as any}>
                <td style={{ padding: "16px" }}>
                  <input type="checkbox" checked={selectedIds.has(trend.id)} onChange={() => toggleSelect(trend.id)} />
                </td>
                <td style={{ padding: "16px" }}>
                  {trend.imageUrl ? <img src={trend.imageUrl} alt="preview" style={{ width: "48px", height: "48px", borderRadius: "6px", objectFit: "cover" }} /> : <div style={{ width: "48px", height: "48px", borderRadius: "6px", backgroundColor: "var(--bg-tertiary)" }} />}
                </td>
                <td style={{ padding: "16px", fontSize: "14px", fontWeight: "500", color: "var(--text-primary)" }}>{trend.keyword}</td>
                <td style={{ padding: "16px", fontSize: "14px", color: "var(--text-secondary)" }}>
                  <div>{trend.theme}</div>
                  <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>{trend.style}</div>
                </td>
                <td style={{ padding: "16px" }}>
                  <span className="badge" style={{ 
                    backgroundColor: trend.status === 'completed' ? 'var(--success)' : trend.status === 'failed' ? 'var(--error)' : trend.status === 'generating' ? 'var(--info)' : 'var(--warning)',
                    color: "white", padding: "4px 10px", borderRadius: "12px", fontSize: "12px", fontWeight: "500", textTransform: "capitalize"
                  }}>{trend.status || 'pending'}</span>
                </td>
                <td style={{ padding: "16px", fontSize: "14px", color: "var(--text-secondary)" }}>
                  {new Date(trend.createdAt).toLocaleDateString()}
                </td>
                <td style={{ padding: "16px", textAlign: "right" }}>
                  <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                    <button className="btn btn-ghost" onClick={() => handleGenerateSingle(trend)} style={{ fontSize: "13px", color: "var(--accent)" }}>Generate</button>
                    <button className="btn btn-ghost" onClick={() => handleDelete(trend.id)} style={{ fontSize: "13px", color: "var(--error)" }}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredTrends.length === 0 && (
              <tr>
                <td colSpan={7} style={{ padding: "40px", textAlign: "center", color: "var(--text-secondary)" }}>No trends found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add Trend Modal */}
      {isModalOpen && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div className="card" style={{ width: "100%", maxWidth: "500px", padding: "32px", display: "flex", flexDirection: "column", gap: "16px" }}>
            <h2 style={{ fontFamily: "Space Grotesk, sans-serif", fontSize: "24px", margin: "0 0 16px 0" }}>Add New Trend</h2>
            
            <input type="text" className="input" placeholder="Keyword" value={newTrend.keyword} onChange={e => setNewTrend({...newTrend, keyword: e.target.value})} />
            
            <select className="input" value={newTrend.theme} onChange={e => setNewTrend({...newTrend, theme: e.target.value})}>
              <option value="">Select Theme</option>
              {themes.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            
            <select className="input" value={newTrend.style} onChange={e => setNewTrend({...newTrend, style: e.target.value})}>
              <option value="">Select Style</option>
              {styles.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>

            <input type="text" className="input" placeholder="Product" value={newTrend.product} onChange={e => setNewTrend({...newTrend, product: e.target.value})} />
            <input type="text" className="input" placeholder="Image URL (optional)" value={newTrend.imageUrl} onChange={e => setNewTrend({...newTrend, imageUrl: e.target.value})} />

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "16px" }}>
              <button className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleAddTrend} style={{ backgroundColor: "var(--accent)" }}>Add</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
