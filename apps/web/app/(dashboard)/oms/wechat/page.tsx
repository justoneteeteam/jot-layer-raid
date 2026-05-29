"use client";

import React, { useState, useRef } from "react";
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
  confidence: string; // "high", "unmatched", "none"
}

export default function WeChatSyncPage() {
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [scannedMatches, setScannedMatches] = useState<MatchResult[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const [syncSuccess, setSyncSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Parse & process matched items
  const processScanResults = (data: MatchResult[]) => {
    setScannedMatches(data);
    // Select high confidence matches by default
    const initialSelected = data
      .map((m: MatchResult, index: number) => (m.confidence === "high" ? index : null))
      .filter((val: any) => val !== null) as number[];
    setSelectedIndices(initialSelected);
  };

  // Upload PDFs to backend
  const handleUploadFiles = async (files: FileList) => {
    if (files.length === 0) return;
    setLoading(true);
    setSyncSuccess(null);

    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append("files", files[i]);
    }

    try {
      const res = await fetch(`${API_BASE}/api/oms/wechat/upload`, {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        processScanResults(data);
      } else {
        alert("Failed to extract details from uploaded PDFs. Check backend logs.");
      }
    } catch (err) {
      console.error(err);
      alert("Error contacting the extraction server.");
    } finally {
      setLoading(false);
    }
  };

  // Trigger scan on local folders (Fallback)
  const handleScanLocalPDFs = async () => {
    setLoading(true);
    setSyncSuccess(null);
    try {
      const res = await fetch(`${API_BASE}/api/oms/wechat/scan`, {
        method: "POST",
      });
      if (res.ok) {
        const data = await res.json();
        processScanResults(data);
      } else {
        alert("Failed to scan WeChat folders. Make sure backend is running.");
      }
    } catch (err) {
      console.error(err);
      alert("Error contacting local scanning server.");
    } finally {
      setLoading(false);
    }
  };

  // Perform database tracking sync
  const handleSyncTracking = async () => {
    if (selectedIndices.length === 0) {
      alert("Please select at least one match to sync.");
      return;
    }
    setSyncing(true);
    try {
      const payload = selectedIndices
        .map((idx) => {
          const match = scannedMatches[idx];
          if (!match) return null;
          return {
            order_id: match.matched_order_id,
            tracking_number: match.extracted_tracking,
          };
        })
        .filter((item) => item !== null && item.order_id !== null);

      const res = await fetch(`${API_BASE}/api/oms/wechat/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        setSyncSuccess(data.message);
        // Remove successfully synced rows
        setScannedMatches((prev) => prev.filter((_, idx) => !selectedIndices.includes(idx)));
        setSelectedIndices([]);
      } else {
        alert("Failed to sync tracking numbers to database.");
      }
    } catch (err) {
      console.error(err);
      alert("Error syncing tracking numbers.");
    } finally {
      setSyncing(false);
    }
  };

  // Drag-and-drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleUploadFiles(e.dataTransfer.files);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleUploadFiles(e.target.files);
    }
  };

  const toggleSelect = (index: number) => {
    setSelectedIndices((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
    );
  };

  const selectAllHighConfidence = () => {
    const highConfidenceIndices = scannedMatches
      .map((m, idx) => (m.confidence === "high" ? idx : null))
      .filter((v) => v !== null) as number[];
    setSelectedIndices(highConfidenceIndices);
  };

  const selectAllMatches = () => {
    const validMatches = scannedMatches
      .map((m, idx) => (m.matched_order_id ? idx : null))
      .filter((v) => v !== null) as number[];
    setSelectedIndices(validMatches);
  };

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "12px" }}>
      {/* Header and Title */}
      <div style={{ marginBottom: "28px" }}>
        <h1 style={{ fontSize: "28px", fontWeight: "800", color: "var(--text-primary)", letterSpacing: "-0.02em", margin: 0 }}>
          WeChat Logistics Hub
        </h1>
        <p style={{ fontSize: "15px", color: "var(--text-secondary)", marginTop: "4px" }}>
          Instantly process WeChat PDF shipping labels, extract carrier tracking numbers, and auto-match with orders.
        </p>
      </div>

      {/* Main Drag and Drop Uploader */}
      <div
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        style={{
          background: "linear-gradient(135deg, rgba(255, 255, 255, 0.8) 0%, rgba(243, 244, 246, 0.4) 100%)",
          backdropFilter: "blur(20px)",
          border: dragActive
            ? "2px dashed var(--accent)"
            : "2px dashed rgba(156, 163, 175, 0.4)",
          borderRadius: "16px",
          padding: "48px 24px",
          textAlign: "center",
          cursor: "pointer",
          transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
          boxShadow: dragActive
            ? "0 20px 25px -5px rgba(59, 130, 246, 0.1), 0 0 0 4px rgba(59, 130, 246, 0.1)"
            : "0 10px 15px -3px rgba(0, 0, 0, 0.02), inset 0 2px 4px rgba(255, 255, 255, 0.8)",
          transform: dragActive ? "scale(1.01)" : "scale(1)",
        }}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf"
          style={{ display: "none" }}
          onChange={handleFileInputChange}
        />
        
        {/* Animated Upload Icon */}
        <div style={{ display: "inline-flex", justifyContent: "center", alignItems: "center", width: "72px", height: "72px", borderRadius: "50%", background: dragActive ? "rgba(59, 130, 246, 0.1)" : "rgba(229, 231, 235, 0.5)", color: dragActive ? "var(--accent)" : "var(--text-secondary)", marginBottom: "16px", transition: "all 0.2s" }}>
          <svg style={{ width: "32px", height: "32px" }} fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
          </svg>
        </div>

        <h3 style={{ fontSize: "18px", fontWeight: "700", color: "var(--text-primary)" }}>
          {dragActive ? "Drop WeChat PDFs Here!" : "Drag & Drop WeChat PDF Shipping Labels"}
        </h3>
        <p style={{ fontSize: "13px", color: "var(--text-muted)", marginTop: "6px", maxWidth: "420px", margin: "6px auto 0" }}>
          Upload multiple PDF shipping slips. Our parser will instantly read and match them against your active customer orders.
        </p>
        <div style={{ marginTop: "16px" }}>
          <span className="btn btn-secondary" style={{ background: "white", padding: "8px 18px", borderRadius: "8px", fontWeight: "600", fontSize: "13px", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
            Browse Files
          </span>
        </div>
      </div>

      {/* Local Folder Scanning Fallback Row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "16px", padding: "14px 20px", background: "var(--bg-secondary)", borderRadius: "12px", border: "1px solid var(--border-default)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "18px" }}>📁</span>
          <div>
            <h4 style={{ fontSize: "13px", fontWeight: "700", color: "var(--text-primary)", margin: 0 }}>Scan WeChat Desktop Directories</h4>
            <p style={{ fontSize: "11px", color: "var(--text-muted)", margin: 0 }}>Scans current calendar month folder and local WeChat client path dynamically.</p>
          </div>
        </div>
        <button
          onClick={handleScanLocalPDFs}
          disabled={loading}
          className="btn btn-secondary"
          style={{ fontSize: "12px", fontWeight: "600", padding: "6px 14px", height: "auto" }}
        >
          📂 Scan WeChat Folder
        </button>
      </div>

      {/* Sync Success Alert */}
      {syncSuccess && (
        <div style={{ display: "flex", alignItems: "center", gap: "10px", background: "hsl(142.1, 70.6%, 95.3%)", border: "1px solid hsl(142.1, 76.2%, 80%)", color: "hsl(142.1, 76.2%, 25%)", padding: "12px 18px", borderRadius: "10px", marginTop: "24px", fontSize: "14px", fontWeight: "500", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.01)" }}>
          <span style={{ fontSize: "18px" }}>🎉</span>
          <span>{syncSuccess} Database records are updated and synced successfully to "in transit".</span>
        </div>
      )}

      {/* Results Area */}
      {loading ? (
        <div style={{ marginTop: "40px", padding: "80px 24px", textAlign: "center", background: "white", borderRadius: "16px", border: "1px solid var(--border-default)", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.01)" }}>
          <div className="spinner" style={{ display: "inline-block", width: "32px", height: "32px", border: "3px solid rgba(59, 130, 246, 0.15)", borderTopColor: "var(--accent)", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
          <h4 style={{ fontSize: "16px", fontWeight: "700", color: "var(--text-primary)", marginTop: "16px", marginBottom: "4px" }}>Parsing WeChat Files & Shipping Labels</h4>
          <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>Reading layout data, extracting parcel codes, and matching recipients...</p>
        </div>
      ) : scannedMatches.length > 0 ? (
        <div style={{ marginTop: "32px" }}>
          {/* Action Toolbar */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <h3 style={{ fontSize: "16px", fontWeight: "800", color: "var(--text-primary)", margin: 0 }}>
                Matched Shipments ({scannedMatches.length})
              </h3>
              <div style={{ display: "flex", gap: "6px" }}>
                <button onClick={selectAllHighConfidence} className="btn btn-secondary" style={{ fontSize: "11px", height: "26px", padding: "0 8px", background: "#f3f4f6", border: "none" }}>
                  Select Matches
                </button>
                <button onClick={selectAllMatches} className="btn btn-secondary" style={{ fontSize: "11px", height: "26px", padding: "0 8px", background: "#f3f4f6", border: "none" }}>
                  Select All
                </button>
              </div>
            </div>
            <span style={{ fontSize: "12px", color: "var(--text-secondary)", fontWeight: "500" }}>
              {selectedIndices.length} items checked for database injection
            </span>
          </div>

          {/* Results Table */}
          <div style={{ background: "white", borderRadius: "14px", border: "1px solid var(--border-default)", overflow: "hidden", boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.02)" }}>
            <div style={{ overflowX: "auto" }}>
              <table className="table" style={{ width: "100%", borderCollapse: "collapse", margin: 0 }}>
                <thead>
                  <tr style={{ background: "rgba(243, 244, 246, 0.5)", borderBottom: "1px solid var(--border-default)", fontSize: "11px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-secondary)" }}>
                    <th style={{ width: "50px", padding: "14px", textAlign: "center" }}>
                      <input
                        type="checkbox"
                        checked={selectedIndices.length === scannedMatches.filter(m => m.matched_order_id).length && scannedMatches.filter(m => m.matched_order_id).length > 0}
                        onChange={() => {
                          if (selectedIndices.length > 0) {
                            setSelectedIndices([]);
                          } else {
                            selectAllMatches();
                          }
                        }}
                      />
                    </th>
                    <th style={{ padding: "14px", textAlign: "left" }}>PDF Shipping slip</th>
                    <th style={{ padding: "14px", textAlign: "left" }}>Extracted tracking</th>
                    <th style={{ padding: "14px", textAlign: "left" }}>Recipient name</th>
                    <th style={{ padding: "14px", textAlign: "left" }}>Database order match</th>
                    <th style={{ padding: "14px", textAlign: "center" }}>Confidence</th>
                  </tr>
                </thead>
                <tbody>
                  {scannedMatches.map((match, index) => {
                    const isSelected = selectedIndices.includes(index);
                    const isHigh = match.confidence === "high";
                    const isUnmatched = match.confidence === "unmatched";

                    return (
                      <tr
                        key={index}
                        style={{
                          borderBottom: "1px solid var(--border-default)",
                          background: isSelected ? "rgba(59, 130, 246, 0.02)" : "white",
                          transition: "background 0.2s",
                        }}
                      >
                        <td style={{ padding: "14px", textAlign: "center" }}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            disabled={!match.matched_order_id}
                            onChange={() => toggleSelect(index)}
                          />
                        </td>
                        <td style={{ padding: "14px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span style={{ fontSize: "18px" }}>📄</span>
                            <span style={{ fontWeight: "600", fontSize: "13px", color: "var(--text-primary)" }}>
                              {match.filename}
                            </span>
                          </div>
                        </td>
                        <td style={{ padding: "14px" }}>
                          {match.formatted_tracking ? (
                            <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontFamily: "'Courier New', Courier, monospace", fontWeight: "700", color: "var(--text-primary)", fontSize: "13px", background: "#f3f4f6", padding: "4px 8px", borderRadius: "6px" }}>
                              <span>🚚</span>
                              <span>{match.formatted_tracking}</span>
                            </div>
                          ) : (
                            <span style={{ color: "var(--text-muted)", fontSize: "12px", fontStyle: "italic" }}>Not found</span>
                          )}
                        </td>
                        <td style={{ padding: "14px" }}>
                          <span style={{ fontWeight: "700", fontSize: "13px", color: "var(--text-primary)" }}>
                            {match.extracted_customer || "—"}
                          </span>
                        </td>
                        <td style={{ padding: "14px" }}>
                          {match.matched_order_id ? (
                            <div style={{ display: "inline-flex", flexDirection: "column" }}>
                              <span style={{ fontWeight: "700", fontSize: "13px", color: "var(--accent)" }}>
                                Order {match.matched_order_number}
                              </span>
                              <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>
                                Customer DB ID: #{match.matched_order_id}
                              </span>
                            </div>
                          ) : (
                            <span style={{ color: "var(--text-muted)", fontSize: "12px" }}>
                              No matching pending orders
                            </span>
                          )}
                        </td>
                        <td style={{ padding: "14px", textAlign: "center" }}>
                          <span
                            style={{
                              display: "inline-block",
                              padding: "4px 10px",
                              borderRadius: "999px",
                              fontSize: "11px",
                              fontWeight: "700",
                              background: isHigh
                                ? "hsl(142.1, 70.6%, 90.3%)"
                                : isUnmatched
                                ? "hsl(47.9, 95.8%, 90%)"
                                : "hsl(0, 72.2%, 93%)",
                              color: isHigh
                                ? "hsl(142.1, 76.2%, 20%)"
                                : isUnmatched
                                ? "hsl(47.9, 95.8%, 25%)"
                                : "hsl(0, 72.2%, 25%)",
                            }}
                          >
                            {isHigh ? "PERFECT MATCH" : isUnmatched ? "UNMATCHED NAME" : "SCAN ERROR"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Sync Button Toolbar */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "20px" }}>
            <button onClick={() => setScannedMatches([])} className="btn btn-secondary" style={{ padding: "0 20px" }}>
              Clear Panel
            </button>
            <button
              onClick={handleSyncTracking}
              disabled={syncing || selectedIndices.length === 0}
              className="btn btn-primary"
              style={{
                padding: "0 28px",
                height: "44px",
                fontWeight: "700",
                fontSize: "14px",
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                boxShadow: "0 4px 6px -1px rgba(59, 130, 246, 0.2)"
              }}
            >
              {syncing ? (
                <>
                  <div className="spinner" style={{ width: "16px", height: "16px", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "white", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                  <span>Syncing...</span>
                </>
              ) : (
                <>
                  <span>✔️</span>
                  <span>Sync {selectedIndices.length} Selected Tracking Numbers</span>
                </>
              )}
            </button>
          </div>
        </div>
      ) : null}

      {/* Interactive Walkthrough Details */}
      <div style={{ marginTop: "48px", background: "white", borderRadius: "16px", border: "1px solid var(--border-default)", padding: "24px", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.01)" }}>
        <h3 style={{ fontSize: "16px", fontWeight: "800", color: "var(--text-primary)", marginBottom: "12px" }}>
          How WeChat Logistics Automation Works
        </h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "20px" }}>
          <div>
            <h4 style={{ fontSize: "13px", fontWeight: "700", color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ display: "inline-flex", justifyContent: "center", alignItems: "center", width: "20px", height: "20px", borderRadius: "50%", background: "rgba(59, 130, 246, 0.1)", color: "var(--accent)", fontSize: "11px", fontWeight: "800" }}>1</span>
              Local WeChat Directory Scan
            </h4>
            <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: "4px 0 0 26px" }}>
              Resolves current calendar month folder automatically to scan dynamic paths like `/wxid_i5tyisy8lh9422_a7fc/msg/file/[YYYY-MM]`.
            </p>
          </div>
          <div>
            <h4 style={{ fontSize: "13px", fontWeight: "700", color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ display: "inline-flex", justifyContent: "center", alignItems: "center", width: "20px", height: "20px", borderRadius: "50%", background: "rgba(59, 130, 246, 0.1)", color: "var(--accent)", fontSize: "11px", fontWeight: "800" }}>2</span>
              Yanwen & USPS Extraction
            </h4>
            <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: "4px 0 0 26px" }}>
              Reads PDF formats from various shipping agencies, parsing international parcel codes (like `UL155889460YP`) as well as standard USPS tracking.
            </p>
          </div>
          <div>
            <h4 style={{ fontSize: "13px", fontWeight: "700", color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ display: "inline-flex", justifyContent: "center", alignItems: "center", width: "20px", height: "20px", borderRadius: "50%", background: "rgba(59, 130, 246, 0.1)", color: "var(--accent)", fontSize: "11px", fontWeight: "800" }}>3</span>
              Database Tracking Sync
            </h4>
            <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: "4px 0 0 26px" }}>
              If a shipping label is matched, clicking Sync automatically binds the tracking number and moves the order to "In Transit" stage in your DB.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
