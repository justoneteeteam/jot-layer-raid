"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface MatchResult {
  filename: string;
  filepath: string;
  extracted_tracking: string;
  formatted_tracking: string;
  extracted_customer: string;
  matched_order_id: number | null;
  matched_order_number: string | null;
  confidence: string; // "high", "fuzzy", "none", "unmatched"
}

export default function WeChatSyncPage() {
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [scannedMatches, setScannedMatches] = useState<MatchResult[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const [syncSuccess, setSyncSuccess] = useState<string | null>(null);

  // Trigger scan
  const handleScanPDFs = async () => {
    setLoading(true);
    setSyncSuccess(null);
    try {
      const res = await fetch(`${API_BASE}/api/oms/wechat/scan`, {
        method: "POST",
      });
      if (res.ok) {
        const data = await res.json();
        setScannedMatches(data);
        // Select high confidence matches by default
        const initialSelected = data
          .map((m: MatchResult, index: number) => (m.confidence === "high" ? index : null))
          .filter((val: any) => val !== null);
        setSelectedIndices(initialSelected);
      } else {
        alert("Failed to scan WeChat folders. Make sure backend is running.");
      }
    } catch (err) {
      console.error(err);
      alert("Error contacting server.");
    } finally {
      setLoading(false);
    }
  };

  // Perform sync
  const handleSyncTracking = async () => {
    if (selectedIndices.length === 0) {
      alert("Please select at least one match to sync.");
      return;
    }
    setSyncing(true);
    try {
      const payload = selectedIndices.map((idx) => {
        const match = scannedMatches[idx];
        if (!match) return null;
        return {
          order_id: match.matched_order_id,
          tracking_number: match.extracted_tracking,
        };
      }).filter((item) => item !== null);

      const res = await fetch(`${API_BASE}/api/oms/wechat/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        setSyncSuccess(data.message);
        // Remove successfully synced rows from the list
        setScannedMatches((prev) => prev.filter((_, idx) => !selectedIndices.includes(idx)));
        setSelectedIndices([]);
      } else {
        alert("Failed to sync tracking numbers.");
      }
    } catch (err) {
      console.error(err);
      alert("Error syncing tracking numbers.");
    } finally {
      setSyncing(false);
    }
  };

  const toggleSelect = (index: number) => {
    setSelectedIndices((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
    );
  };

  return (
    <div className="card" style={{ padding: "24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <div>
          <h2 style={{ fontSize: "20px", fontWeight: "bold", margin: 0, color: "var(--text-primary)" }}>WeChat PDF Tracking Sync</h2>
          <p style={{ margin: "4px 0 0 0", fontSize: "14px", color: "var(--text-secondary)" }}>
            Scan WeChat PDF files, extract USPS tracking numbers, and match customer recipient names automatically.
          </p>
        </div>
        <button
          onClick={handleScanPDFs}
          disabled={loading}
          className="btn btn-primary"
          style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
        >
          {loading ? "🔍 Scanning Folders..." : "📂 Scan WeChat PDFs"}
        </button>
      </div>

      {syncSuccess && (
        <div style={{ background: "#e0f2fe", border: "1px solid #bae6fd", color: "#0369a1", padding: "12px 16px", borderRadius: "8px", marginBottom: "20px", fontSize: "14px" }}>
          ✅ {syncSuccess} Corresponding orders are now updated as "shipped" in the database.
        </div>
      )}

      {loading ? (
        <div style={{ padding: "60px", textAlign: "center", color: "var(--text-secondary)" }}>
          <div className="spinner" style={{ display: "inline-block", width: "24px", height: "24px", border: "3px solid #ccc", borderTopColor: "var(--accent)", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
          <p style={{ marginTop: "12px" }}>Scanning local WeChat and workspace folders for delivery PDFs...</p>
        </div>
      ) : scannedMatches.length === 0 ? (
        <div style={{ padding: "60px", textAlign: "center", border: "1px dashed var(--border-default)", borderRadius: "8px" }}>
          <p style={{ color: "var(--text-secondary)", margin: 0, fontSize: "15px", fontWeight: "bold" }}>No delivery PDFs found or scanned yet.</p>
          <p style={{ color: "var(--text-muted)", margin: "4px 0 16px 0", fontSize: "13px" }}>
            Make sure your WeChat label PDF files are inside the `wechat` folder of your project root.
          </p>
          <button onClick={handleScanPDFs} className="btn btn-secondary">📂 Scan PDFs Now</button>
        </div>
      ) : (
        <div>
          <div style={{ overflowX: "auto" }}>
            <table className="table" style={{ width: "100%", borderCollapse: "collapse", marginBottom: "20px" }}>
              <thead>
                <tr style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border-default)", textTransform: "uppercase", fontSize: "11px", fontWeight: "bold", color: "var(--text-secondary)" }}>
                  <th style={{ width: "40px", padding: "12px", textAlign: "center" }}>Select</th>
                  <th style={{ padding: "12px", textAlign: "left" }}>PDF Filename</th>
                  <th style={{ padding: "12px", textAlign: "left" }}>Extracted Tracking Number</th>
                  <th style={{ padding: "12px", textAlign: "left" }}>Extracted Customer Name</th>
                  <th style={{ padding: "12px", textAlign: "left" }}>Database Order Match</th>
                  <th style={{ padding: "12px", textAlign: "center" }}>Confidence</th>
                </tr>
              </thead>
              <tbody>
                {scannedMatches.map((match, index) => {
                  const isSelected = selectedIndices.includes(index);
                  const isHigh = match.confidence === "high";
                  const isUnmatched = match.confidence === "unmatched";

                  return (
                    <tr key={index} style={{ borderBottom: "1px solid var(--border-default)", background: isSelected ? "var(--bg-tertiary)" : "white" }}>
                      <td style={{ padding: "12px", textAlign: "center" }}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          disabled={!match.matched_order_id}
                          onChange={() => toggleSelect(index)}
                        />
                      </td>
                      <td style={{ padding: "12px", fontWeight: "500", color: "var(--text-primary)" }}>📄 {match.filename}</td>
                      <td style={{ padding: "12px", fontFamily: "monospace", fontWeight: "bold", color: "var(--text-primary)", fontSize: "13px" }}>
                        {match.formatted_tracking ? `🚚 ${match.formatted_tracking}` : "—"}
                      </td>
                      <td style={{ padding: "12px", fontWeight: "bold", color: "var(--text-primary)" }}>{match.extracted_customer || "—"}</td>
                      <td style={{ padding: "12px" }}>
                        {match.matched_order_id ? (
                          <div>
                            <span style={{ fontWeight: "bold", color: "var(--accent)" }}>Order {match.matched_order_number}</span>
                            <span style={{ fontSize: "11px", color: "var(--text-secondary)", marginLeft: "8px" }}>(ID: {match.matched_order_id})</span>
                          </div>
                        ) : (
                          <span style={{ color: "var(--text-muted)", fontSize: "12px" }}>No unfulfilled order matches this name</span>
                        )}
                      </td>
                      <td style={{ padding: "12px", textAlign: "center" }}>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "3px 10px",
                            borderRadius: "999px",
                            fontSize: "11px",
                            fontWeight: "bold",
                            background: isHigh ? "#d1fae5" : isUnmatched ? "#fef3c7" : "#fee2e2",
                            color: isHigh ? "#065f46" : isUnmatched ? "#92400e" : "#991b1b",
                          }}
                        >
                          {isHigh ? "PERFECT MATCH" : isUnmatched ? "UNMATCHED RECIPIENT" : "NO TRACKING FOUND"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
            <button onClick={() => setScannedMatches([])} className="btn btn-secondary">Clear Results</button>
            <button
              onClick={handleSyncTracking}
              disabled={syncing || selectedIndices.length === 0}
              className="btn btn-primary"
              style={{ padding: "0 24px", height: "42px", fontWeight: "bold" }}
            >
              {syncing ? "⏳ Saving Tracking..." : `✔️ Sync ${selectedIndices.length} Selected Tracking Numbers`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
