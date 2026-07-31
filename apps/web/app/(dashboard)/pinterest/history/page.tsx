"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { formatR2ImageUrl } from "../../../lib/api";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function PinterestHistoryPage() {
  const [history, setHistory] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [modelFilter, setModelFilter] = useState("");
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/api/pinterest/history`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setHistory(data.items || data || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleExport = async () => {
    try {
      const token = localStorage.getItem("token");
      const url = new URL(`${API_BASE}/api/pinterest/export/csv`);
      if (fromDate) url.searchParams.append("from", fromDate);
      if (toDate) url.searchParams.append("to", toDate);
      
      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const blob = await res.blob();
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `pinterest-trends-${new Date().toLocaleDateString().replace(/\//g, '-')}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const token = localStorage.getItem("token");
      await fetch(`${API_BASE}/api/pinterest/history/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchHistory();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDownloadImage = async (item: any) => {
    // If the image data is not stored, might need to re-trigger or fetch image. 
    // Assuming backend might just return the image based on ID or we generate it again.
    // The requirement says "Download: re-triggers the generate endpoint to get the image"
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/api/pinterest/generate`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ keyword: item.keyword, theme: item.theme, style: item.style, product: item.product, model: item.model })
      });
      const data = await res.json();
      if (data.success && data.image) {
        const link = document.createElement("a");
        link.href = `data:image/png;base64,${data.image}`;
        link.download = `pinterest-re-gen-${item.id}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleRegenerate = (item: any) => {
    // Ideally we pass params via query string or state management to /generate
    // For simplicity, redirecting to /generate. A real impl might use context or query params.
    router.push(`/pinterest/generate?keyword=${encodeURIComponent(item.keyword)}&theme=${encodeURIComponent(item.theme)}&style=${encodeURIComponent(item.style)}`);
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  let filteredHistory = history.filter((h: any) => {
    if (search && !h.keyword.toLowerCase().includes(search.toLowerCase())) return false;
    if (modelFilter && h.model !== modelFilter) return false;
    if (fromDate && new Date(h.createdAt) < new Date(fromDate)) return false;
    if (toDate && new Date(h.createdAt) > new Date(toDate)) return false;
    return true;
  });

  return (
    <div style={{ padding: "32px", height: "100%", backgroundColor: "var(--bg-secondary)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <h1 style={{ fontFamily: "Space Grotesk, sans-serif", fontSize: "28px", fontWeight: "700", color: "var(--text-primary)", margin: 0 }}>Generation History</h1>
        <button className="btn btn-primary" onClick={handleExport} style={{ backgroundColor: "var(--accent)" }}>Export CSV</button>
      </div>

      <div className="card" style={{ padding: "20px", marginBottom: "24px", display: "flex", gap: "16px", flexWrap: "wrap", alignItems: "center" }}>
        <input type="text" className="input" placeholder="Search keyword..." value={search} onChange={e => setSearch(e.target.value)} style={{ flex: 1, minWidth: "200px" }} />
        
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <label style={{ fontSize: "14px", color: "var(--text-secondary)" }}>From</label>
          <input type="date" className="input" value={fromDate} onChange={e => setFromDate(e.target.value)} />
        </div>
        
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <label style={{ fontSize: "14px", color: "var(--text-secondary)" }}>To</label>
          <input type="date" className="input" value={toDate} onChange={e => setToDate(e.target.value)} />
        </div>

        <select className="input" value={modelFilter} onChange={e => setModelFilter(e.target.value)}>
          <option value="">All Models</option>
          <option value="qwen">Qwen</option>
          <option value="openai">OpenAI</option>
        </select>
      </div>

      <div className="table-wrapper card">
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border-default)", backgroundColor: "var(--bg-tertiary)" }}>
              <th style={{ padding: "16px", textAlign: "left", fontSize: "14px", fontWeight: "600", color: "var(--text-secondary)" }}>#</th>
              <th style={{ padding: "16px", textAlign: "left", fontSize: "14px", fontWeight: "600", color: "var(--text-secondary)" }}>Keyword</th>
              <th style={{ padding: "16px", textAlign: "left", fontSize: "14px", fontWeight: "600", color: "var(--text-secondary)" }}>Theme / Style</th>
              <th style={{ padding: "16px", textAlign: "left", fontSize: "14px", fontWeight: "600", color: "var(--text-secondary)" }}>SEO Title</th>
              <th style={{ padding: "16px", textAlign: "left", fontSize: "14px", fontWeight: "600", color: "var(--text-secondary)" }}>Model</th>
              <th style={{ padding: "16px", textAlign: "left", fontSize: "14px", fontWeight: "600", color: "var(--text-secondary)" }}>Created Date</th>
              <th style={{ padding: "16px", textAlign: "right", fontSize: "14px", fontWeight: "600", color: "var(--text-secondary)" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredHistory.map((item: any, idx: number) => (
              <React.Fragment key={item.id}>
                <tr style={{ borderBottom: "1px solid var(--border-default)" }}>
                  <td style={{ padding: "16px", fontSize: "14px", color: "var(--text-secondary)" }}>{idx + 1}</td>
                  <td style={{ padding: "16px", fontSize: "14px", fontWeight: "500", color: "var(--text-primary)" }}>{item.keyword}</td>
                  <td style={{ padding: "16px", fontSize: "14px", color: "var(--text-secondary)" }}>
                    {item.theme} <br/> <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>{item.style}</span>
                  </td>
                  <td style={{ padding: "16px", fontSize: "14px", color: "var(--text-secondary)", maxWidth: "200px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {item.seoTitle || item.metadata?.title || "N/A"}
                  </td>
                  <td style={{ padding: "16px" }}>
                    <span className="badge" style={{ backgroundColor: "var(--bg-tertiary)", color: "var(--text-secondary)", padding: "4px 8px", borderRadius: "12px", fontSize: "12px", textTransform: "capitalize" }}>{item.modelUsed || item.model || 'qwen'}</span>
                  </td>
                  <td style={{ padding: "16px", fontSize: "14px", color: "var(--text-secondary)" }}>
                    {item.createdAt ? new Date(item.createdAt).toLocaleString() : "N/A"}
                  </td>
                  <td style={{ padding: "16px", textAlign: "right" }}>
                    <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                      <button className="btn btn-ghost" onClick={() => setExpandedRow(expandedRow === item.id ? null : item.id)} style={{ fontSize: "13px" }}>View</button>
                      {item.generatedImageUrl && (
                        <button className="btn btn-ghost" onClick={() => handleCopy(item.generatedImageUrl)} style={{ fontSize: "13px", color: "var(--accent)" }}>Copy R2 Link</button>
                      )}
                      <button className="btn btn-ghost" onClick={() => handleDownloadImage(item)} style={{ fontSize: "13px" }}>Download</button>
                      <button className="btn btn-ghost" onClick={() => handleDelete(item.id)} style={{ fontSize: "13px", color: "var(--error)" }}>Delete</button>
                    </div>
                  </td>
                </tr>
                {expandedRow === item.id && (
                  <tr style={{ backgroundColor: "var(--bg-tertiary)" }}>
                    <td colSpan={7} style={{ padding: "24px" }}>
                      <div style={{ display: "grid", gridTemplateColumns: "200px 1fr 1fr", gap: "24px" }}>
                        {/* R2 Image Thumbnail */}
                        <div>
                          <p style={{ fontWeight: "600", fontSize: "13px", marginBottom: "8px" }}>Generated R2 Image</p>
                          {item.generatedImageUrl ? (
                            <img src={formatR2ImageUrl(item.generatedImageUrl)} alt="R2 Creative" style={{ width: "100%", borderRadius: "8px", border: "1px solid var(--border-default)" }} />
                          ) : (
                            <div style={{ padding: "16px", backgroundColor: "var(--bg-primary)", borderRadius: "8px", fontSize: "12px", textAlign: "center" }}>No R2 preview</div>
                          )}
                        </div>

                        <div>
                          <p style={{ fontWeight: "600", fontSize: "14px", marginBottom: "8px" }}>SEO Title <button onClick={() => handleCopy(item.seoTitle || item.metadata?.title)} style={{border:'none',background:'none',color:'var(--accent)',cursor:'pointer',fontSize:'12px'}}>Copy</button></p>
                          <p style={{ fontSize: "14px", color: "var(--text-secondary)", marginBottom: "16px" }}>{item.seoTitle || item.metadata?.title}</p>

                          <p style={{ fontWeight: "600", fontSize: "14px", marginBottom: "8px" }}>SEO Description <button onClick={() => handleCopy(item.seoDescription || item.metadata?.description)} style={{border:'none',background:'none',color:'var(--accent)',cursor:'pointer',fontSize:'12px'}}>Copy</button></p>
                          <p style={{ fontSize: "14px", color: "var(--text-secondary)" }}>{item.seoDescription || item.metadata?.description}</p>
                        </div>

                        <div>
                          <p style={{ fontWeight: "600", fontSize: "14px", marginBottom: "8px" }}>R2 Public URL <button onClick={() => handleCopy(item.generatedImageUrl)} style={{border:'none',background:'none',color:'var(--accent)',cursor:'pointer',fontSize:'12px'}}>Copy</button></p>
                          <p style={{ fontSize: "12px", fontFamily: "monospace", color: "var(--accent)", marginBottom: "16px", wordBreak: "break-all" }}>{item.generatedImageUrl || "N/A"}</p>

                          <p style={{ fontWeight: "600", fontSize: "14px", marginBottom: "8px" }}>Alt Text <button onClick={() => handleCopy(item.seoAltText || item.metadata?.altText)} style={{border:'none',background:'none',color:'var(--accent)',cursor:'pointer',fontSize:'12px'}}>Copy</button></p>
                          <p style={{ fontSize: "14px", color: "var(--text-secondary)" }}>{item.seoAltText || item.metadata?.altText}</p>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
            {filteredHistory.length === 0 && (
              <tr>
                <td colSpan={7} style={{ padding: "40px", textAlign: "center", color: "var(--text-secondary)" }}>No history found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
