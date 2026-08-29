"use client";

import React, { useState, useRef } from "react";
import Link from "next/link";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://api-worker.justoneteeteam.workers.dev";

interface CandidateOrderOption {
  id: number;
  order_id: string;
  product_name: string;
  quantity: number;
  created_at: string;
  score: number;
  reason?: string;
}

interface MatchResult {
  filename: string;
  filepath: string;
  extracted_tracking: string;
  formatted_tracking: string;
  carrier_key?: string;
  carrier_name?: string;
  extracted_customer: string;
  matched_order_id: number | null;
  matched_order_number: string | null;
  confidence: string; // "high", "unmatched", "none", "duplicate"
  existing_tracking?: string | null;
  candidate_orders?: CandidateOrderOption[];
}

export default function WeChatSyncPage() {
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [scannedMatches, setScannedMatches] = useState<MatchResult[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const [syncSuccess, setSyncSuccess] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"success" | "duplicate" | "failed">("success");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Switch target order when multiple candidate orders exist for the same customer (Case 4)
  const handleSelectCandidateOrder = (matchIndex: number, candidateId: number) => {
    setScannedMatches((prev) =>
      prev.map((item, idx) => {
        if (idx !== matchIndex) return item;
        const candidate = item.candidate_orders?.find((c) => c.id === candidateId);
        if (!candidate) return item;
        return {
          ...item,
          matched_order_id: candidate.id,
          matched_order_number: candidate.order_id,
        };
      })
    );
  };

  // Derive filtered matching subsets
  const successMatches = scannedMatches.filter((m) => m.confidence === "high");
  const duplicateMatches = scannedMatches.filter((m) => m.confidence === "duplicate");
  const failedMatches = scannedMatches.filter((m) => m.confidence === "unmatched" || m.confidence === "none");

  // Parse & process matched items
  const processScanResults = (data: MatchResult[]) => {
    setScannedMatches(data);
    // Select high confidence success matches by default
    const initialSelected = data
      .map((m: MatchResult, index: number) => (m.confidence === "high" ? index : null))
      .filter((val: any) => val !== null) as number[];
    setSelectedIndices(initialSelected);

    // Auto-switch to the first tab with records
    const hasSuccess = data.some((m) => m.confidence === "high");
    const hasDuplicate = data.some((m) => m.confidence === "duplicate");
    if (hasSuccess) {
      setActiveTab("success");
    } else if (hasDuplicate) {
      setActiveTab("duplicate");
    } else {
      setActiveTab("failed");
    }
  };

  // Upload PDFs to backend
  const handleUploadFiles = async (files: FileList) => {
    if (files.length === 0) return;
    setLoading(true);
    setSyncSuccess(null);

    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file) {
        formData.append("files", file);
      }
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
          <span>{syncSuccess}</span>
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
          
          {/* Announcements Status Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "16px", marginBottom: "28px" }}>
            
            {/* Card 1: Successful Matches */}
            <div 
              onClick={() => setActiveTab("success")}
              style={{
                background: activeTab === "success" 
                  ? "linear-gradient(135deg, hsl(142, 76%, 97%) 0%, hsl(142, 70%, 98%) 100%)" 
                  : "rgba(255, 255, 255, 0.8)",
                border: activeTab === "success" 
                  ? "2px solid hsl(142, 76%, 40%)" 
                  : "1px solid rgba(229, 231, 235, 0.5)",
                borderRadius: "16px",
                padding: "20px",
                cursor: "pointer",
                transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                boxShadow: activeTab === "success" 
                  ? "0 10px 15px -3px rgba(16, 185, 129, 0.08), inset 0 2px 4px rgba(255, 255, 255, 0.8)" 
                  : "0 4px 6px -1px rgba(0,0,0,0.01)",
                display: "flex",
                alignItems: "center",
                gap: "16px",
                transform: activeTab === "success" ? "translateY(-2px)" : "translateY(0)"
              }}
            >
              <div style={{
                width: "48px",
                height: "48px",
                borderRadius: "12px",
                background: "hsl(142, 70%, 90%)",
                color: "hsl(142, 76%, 30%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "20px"
              }}>
                ✔️
              </div>
              <div>
                <h3 style={{ fontSize: "14px", fontWeight: "700", color: "var(--text-secondary)", margin: 0 }}>
                  Successful Matches
                </h3>
                <p style={{ fontSize: "22px", fontWeight: "800", color: "hsl(142, 76%, 20%)", margin: "2px 0 0" }}>
                  {successMatches.length} <span style={{ fontSize: "11px", fontWeight: "500", color: "hsl(142, 76%, 30%)" }}>ready to sync</span>
                </p>
              </div>
            </div>

            {/* Card 2: Duplicate Matches */}
            <div 
              onClick={() => setActiveTab("duplicate")}
              style={{
                background: activeTab === "duplicate" 
                  ? "linear-gradient(135deg, hsl(47, 95%, 97%) 0%, hsl(47, 90%, 98%) 100%)" 
                  : "rgba(255, 255, 255, 0.8)",
                border: activeTab === "duplicate" 
                  ? "2px solid hsl(47, 95%, 35%)" 
                  : "1px solid rgba(229, 231, 235, 0.5)",
                borderRadius: "16px",
                padding: "20px",
                cursor: "pointer",
                transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                boxShadow: activeTab === "duplicate" 
                  ? "0 10px 15px -3px rgba(245, 158, 11, 0.08), inset 0 2px 4px rgba(255, 255, 255, 0.8)" 
                  : "0 4px 6px -1px rgba(0,0,0,0.01)",
                display: "flex",
                alignItems: "center",
                gap: "16px",
                transform: activeTab === "duplicate" ? "translateY(-2px)" : "translateY(0)"
              }}
            >
              <div style={{
                width: "48px",
                height: "48px",
                borderRadius: "12px",
                background: "hsl(47, 90%, 90%)",
                color: "hsl(47, 95%, 25%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "20px"
              }}>
                ⚠️
              </div>
              <div>
                <h3 style={{ fontSize: "14px", fontWeight: "700", color: "var(--text-secondary)", margin: 0 }}>
                  Duplicate Slips
                </h3>
                <p style={{ fontSize: "22px", fontWeight: "800", color: "hsl(47, 95%, 20%)", margin: "2px 0 0" }}>
                  {duplicateMatches.length} <span style={{ fontSize: "11px", fontWeight: "500", color: "hsl(47, 95%, 30%)" }}>already tracked</span>
                </p>
              </div>
            </div>

            {/* Card 3: Failed Matches */}
            <div 
              onClick={() => setActiveTab("failed")}
              style={{
                background: activeTab === "failed" 
                  ? "linear-gradient(135deg, hsl(0, 72%, 97%) 0%, hsl(0, 60%, 98%) 100%)" 
                  : "rgba(255, 255, 255, 0.8)",
                border: activeTab === "failed" 
                  ? "2px solid hsl(0, 72%, 40%)" 
                  : "1px solid rgba(229, 231, 235, 0.5)",
                borderRadius: "16px",
                padding: "20px",
                cursor: "pointer",
                transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                boxShadow: activeTab === "failed" 
                  ? "0 10px 15px -3px rgba(239, 68, 68, 0.08), inset 0 2px 4px rgba(255, 255, 255, 0.8)" 
                  : "0 4px 6px -1px rgba(0,0,0,0.01)",
                display: "flex",
                alignItems: "center",
                gap: "16px",
                transform: activeTab === "failed" ? "translateY(-2px)" : "translateY(0)"
              }}
            >
              <div style={{
                width: "48px",
                height: "48px",
                borderRadius: "12px",
                background: "hsl(0, 72%, 90%)",
                color: "hsl(0, 72%, 30%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "20px"
              }}>
                ❌
              </div>
              <div>
                <h3 style={{ fontSize: "14px", fontWeight: "700", color: "var(--text-secondary)", margin: 0 }}>
                  Unmatched Slips
                </h3>
                <p style={{ fontSize: "22px", fontWeight: "800", color: "hsl(0, 72%, 20%)", margin: "2px 0 0" }}>
                  {failedMatches.length} <span style={{ fontSize: "11px", fontWeight: "500", color: "hsl(0, 72%, 30%)" }}>order not found</span>
                </p>
              </div>
            </div>

          </div>

          {/* Action Toolbar */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <h3 style={{ fontSize: "16px", fontWeight: "800", color: "var(--text-primary)", margin: 0, textTransform: "capitalize" }}>
                {activeTab === "success" ? "Ready for Database Sync" : activeTab === "duplicate" ? "Duplicate Warnings Ledger" : "Failed Name Matches"} ({
                  activeTab === "success" ? successMatches.length : activeTab === "duplicate" ? duplicateMatches.length : failedMatches.length
                })
              </h3>
              
              {activeTab === "success" && successMatches.length > 0 && (
                <div style={{ display: "flex", gap: "6px" }}>
                  <button onClick={selectAllHighConfidence} className="btn btn-secondary" style={{ fontSize: "11px", height: "26px", padding: "0 8px", background: "#f3f4f6", border: "none" }}>
                    Select High Confidence
                  </button>
                  <button onClick={selectAllMatches} className="btn btn-secondary" style={{ fontSize: "11px", height: "26px", padding: "0 8px", background: "#f3f4f6", border: "none" }}>
                    Select All Matched
                  </button>
                </div>
              )}

              {activeTab === "duplicate" && duplicateMatches.length > 0 && (
                <button onClick={selectAllMatches} className="btn btn-secondary" style={{ fontSize: "11px", height: "26px", padding: "0 8px", background: "#f3f4f6", border: "none" }}>
                  Select All Duplicates
                </button>
              )}
            </div>
            
            {activeTab !== "failed" && (
              <span style={{ fontSize: "12px", color: "var(--text-secondary)", fontWeight: "500" }}>
                {selectedIndices.filter(idx => {
                  const conf = scannedMatches[idx]?.confidence;
                  return activeTab === "success" ? conf === "high" : conf === "duplicate";
                }).length} items checked in this category
              </span>
            )}
          </div>

          {/* Ledger Table */}
          <div style={{ background: "white", borderRadius: "14px", border: "1px solid var(--border-default)", overflow: "hidden", boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.02)" }}>
            <div style={{ overflowX: "auto" }}>
              
              {activeTab === "success" ? (
                successMatches.length === 0 ? (
                  <div style={{ padding: "48px 24px", textAlign: "center", color: "var(--text-muted)" }}>
                    <span style={{ fontSize: "28px" }}>🎉</span>
                    <h4 style={{ fontSize: "14px", fontWeight: "700", color: "var(--text-primary)", marginTop: "8px", marginBottom: "2px" }}>No Successful Pending Matches</h4>
                    <p style={{ fontSize: "12px", margin: 0 }}>All uploaded files have been matched and synchronized, or are duplicates/unmatched.</p>
                  </div>
                ) : (
                  <table className="table" style={{ width: "100%", borderCollapse: "collapse", margin: 0 }}>
                    <thead>
                      <tr style={{ background: "rgba(243, 244, 246, 0.5)", borderBottom: "1px solid var(--border-default)", fontSize: "11px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-secondary)" }}>
                        <th style={{ width: "50px", padding: "14px", textAlign: "center" }}>
                          <input
                            type="checkbox"
                            checked={successMatches.every(m => selectedIndices.includes(scannedMatches.indexOf(m)))}
                            onChange={() => {
                              const successIndices = successMatches.map(m => scannedMatches.indexOf(m));
                              const allChecked = successIndices.every(idx => selectedIndices.includes(idx));
                              if (allChecked) {
                                setSelectedIndices(prev => prev.filter(idx => !successIndices.includes(idx)));
                              } else {
                                setSelectedIndices(prev => Array.from(new Set([...prev, ...successIndices])));
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
                        if (match.confidence !== "high") return null;
                        const isSelected = selectedIndices.includes(index);
                        return (
                          <tr key={index} style={{ borderBottom: "1px solid var(--border-default)", background: isSelected ? "rgba(59, 130, 246, 0.02)" : "white", transition: "background 0.2s" }}>
                            <td style={{ padding: "14px", textAlign: "center" }}>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleSelect(index)}
                              />
                            </td>
                            <td style={{ padding: "14px" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <span style={{ fontSize: "18px" }}>📄</span>
                                <span style={{ fontWeight: "600", fontSize: "13px", color: "var(--text-primary)" }}>{match.filename}</span>
                              </div>
                            </td>
                            <td style={{ padding: "14px" }}>
                              <div style={{ display: "inline-flex", flexDirection: "column", gap: "2px" }}>
                                <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontFamily: "'Courier New', Courier, monospace", fontWeight: "700", color: "var(--text-primary)", fontSize: "13px", background: "#f3f4f6", padding: "4px 8px", borderRadius: "6px" }}>
                                  <span>🚚</span>
                                  <span>{match.formatted_tracking || "No Barcode"}</span>
                                </div>
                                {match.carrier_name && (
                                  <span style={{ fontSize: "10px", fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em", paddingLeft: "4px" }}>
                                    {match.carrier_name}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td style={{ padding: "14px" }}>
                              <span style={{ fontWeight: "700", fontSize: "13px", color: "var(--text-primary)" }}>{match.extracted_customer || "—"}</span>
                            </td>
                            <td style={{ padding: "14px" }}>
                              {match.candidate_orders && match.candidate_orders.length > 1 ? (
                                <div style={{ display: "inline-flex", flexDirection: "column", gap: "4px" }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                    <span style={{ fontWeight: "700", fontSize: "13px", color: "var(--accent)" }}>
                                      Order {match.matched_order_number}
                                    </span>
                                    <span style={{ fontSize: "10px", padding: "2px 6px", borderRadius: "4px", background: "rgba(59, 130, 246, 0.1)", color: "#2563eb", fontWeight: "700" }}>
                                      {match.candidate_orders.length} orders
                                    </span>
                                  </div>
                                  <select
                                    value={match.matched_order_id || ""}
                                    onChange={(e) => handleSelectCandidateOrder(index, Number(e.target.value))}
                                    style={{
                                      fontSize: "11px",
                                      padding: "4px 8px",
                                      borderRadius: "6px",
                                      border: "1px solid #cbd5e1",
                                      background: "#ffffff",
                                      color: "#1e293b",
                                      maxWidth: "260px",
                                      fontWeight: "500",
                                      cursor: "pointer"
                                    }}
                                  >
                                    {match.candidate_orders.map((cand) => (
                                      <option key={cand.id} value={cand.id}>
                                        Order {cand.order_id} • {cand.product_name.slice(0, 24)}... ({cand.score}% match)
                                      </option>
                                    ))}
                                  </select>
                                  <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>
                                    Customer DB ID: #{match.matched_order_id}
                                  </span>
                                </div>
                              ) : (
                                <div style={{ display: "inline-flex", flexDirection: "column" }}>
                                  <span style={{ fontWeight: "700", fontSize: "13px", color: "var(--accent)" }}>Order {match.matched_order_number}</span>
                                  <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>Customer DB ID: #{match.matched_order_id}</span>
                                </div>
                              )}
                            </td>
                            <td style={{ padding: "14px", textAlign: "center" }}>
                              <span style={{ display: "inline-block", padding: "4px 10px", borderRadius: "999px", fontSize: "11px", fontWeight: "700", background: "hsl(142.1, 70.6%, 90.3%)", color: "hsl(142.1, 76.2%, 20%)" }}>
                                PERFECT MATCH
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )
              ) : activeTab === "duplicate" ? (
                duplicateMatches.length === 0 ? (
                  <div style={{ padding: "48px 24px", textAlign: "center", color: "var(--text-muted)" }}>
                    <span style={{ fontSize: "28px" }}>✨</span>
                    <h4 style={{ fontSize: "14px", fontWeight: "700", color: "var(--text-primary)", marginTop: "8px", marginBottom: "2px" }}>No Duplicate Slips Detected</h4>
                    <p style={{ fontSize: "12px", margin: 0 }}>None of the uploaded shipping labels match orders that already have tracking codes set.</p>
                  </div>
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                      <thead>
                        <tr style={{ borderBottom: "1px solid var(--border-default)", background: "#f8fafc", color: "var(--text-muted)", fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                          <th style={{ padding: "14px", textAlign: "center", width: "40px" }}>
                            <input
                              type="checkbox"
                              checked={duplicateMatches.length > 0 && duplicateMatches.every((item) => selectedIndices.includes(scannedMatches.indexOf(item)))}
                              onChange={() => {
                                const dupIndices = duplicateMatches.map((m) => scannedMatches.indexOf(m));
                                const allSelected = dupIndices.every((idx) => selectedIndices.includes(idx));
                                if (allSelected) {
                                  setSelectedIndices(selectedIndices.filter((idx) => !dupIndices.includes(idx)));
                                } else {
                                  setSelectedIndices(Array.from(new Set([...selectedIndices, ...dupIndices])));
                                }
                              }}
                            />
                          </th>
                          <th style={{ padding: "14px", textAlign: "left" }}>PDF Shipping slip</th>
                          <th style={{ padding: "14px", textAlign: "left" }}>New tracking extracted</th>
                          <th style={{ padding: "14px", textAlign: "left" }}>Recipient name</th>
                          <th style={{ padding: "14px", textAlign: "left" }}>Existing tracking in db</th>
                          <th style={{ padding: "14px", textAlign: "center" }}>Override</th>
                        </tr>
                      </thead>
                      <tbody>
                        {scannedMatches.map((match, index) => {
                          if (match.confidence !== "duplicate") return null;
                          const isSelected = selectedIndices.includes(index);
                          return (
                            <tr key={index} style={{ borderBottom: "1px solid var(--border-default)", background: isSelected ? "rgba(245, 158, 11, 0.02)" : "white", transition: "background 0.2s" }}>
                              <td style={{ padding: "14px", textAlign: "center" }}>
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleSelect(index)}
                                />
                              </td>
                              <td style={{ padding: "14px" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                  <span style={{ fontSize: "18px" }}>📄</span>
                                  <span style={{ fontWeight: "600", fontSize: "13px", color: "var(--text-primary)" }}>{match.filename}</span>
                                </div>
                              </td>
                              <td style={{ padding: "14px" }}>
                                <div style={{ display: "inline-flex", flexDirection: "column", gap: "2px" }}>
                                  <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontFamily: "'Courier New', Courier, monospace", fontWeight: "700", color: "var(--text-primary)", fontSize: "13px", background: "#f3f4f6", padding: "4px 8px", borderRadius: "6px" }}>
                                    <span>🚚</span>
                                    <span>{match.formatted_tracking}</span>
                                  </div>
                                  {match.carrier_name && (
                                    <span style={{ fontSize: "10px", fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em", paddingLeft: "4px" }}>
                                      {match.carrier_name}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td style={{ padding: "14px" }}>
                                <span style={{ fontWeight: "700", fontSize: "13px", color: "var(--text-primary)" }}>{match.extracted_customer || "—"}</span>
                              </td>
                              <td style={{ padding: "14px" }}>
                                <div style={{ display: "inline-flex", flexDirection: "column" }}>
                                  <span style={{ fontWeight: "700", fontSize: "13px", color: "var(--text-primary)" }}>Order {match.matched_order_number}</span>
                                  <span style={{ fontSize: "11px", color: "hsl(47.9, 95.8%, 30%)", fontFamily: "'Courier New', Courier, monospace", fontWeight: "700", marginTop: "2px" }}>
                                    Already has: {match.existing_tracking}
                                  </span>
                                </div>
                              </td>
                              <td style={{ padding: "14px", textAlign: "center" }}>
                                <span style={{ display: "inline-block", padding: "4px 10px", borderRadius: "999px", fontSize: "11px", fontWeight: "700", background: "hsl(47.9, 95.8%, 90%)", color: "hsl(47.9, 95.8%, 25%)" }}>
                                  DUPLICATE WARNING
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )
              ) : (
                failedMatches.length === 0 ? (
                  <div style={{ padding: "48px 24px", textAlign: "center", color: "var(--text-muted)" }}>
                    <span style={{ fontSize: "28px" }}>👍</span>
                    <h4 style={{ fontSize: "14px", fontWeight: "700", color: "var(--text-primary)", marginTop: "8px", marginBottom: "2px" }}>All Slips Matched!</h4>
                    <p style={{ fontSize: "12px", margin: 0 }}>Every uploaded shipping label successfully matched an active customer order in the database.</p>
                  </div>
                ) : (
                  <table className="table" style={{ width: "100%", borderCollapse: "collapse", margin: 0 }}>
                    <thead>
                      <tr style={{ background: "rgba(243, 244, 246, 0.5)", borderBottom: "1px solid var(--border-default)", fontSize: "11px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-secondary)" }}>
                        <th style={{ width: "50px", padding: "14px", textAlign: "center" }}>—</th>
                        <th style={{ padding: "14px", textAlign: "left" }}>PDF Shipping slip</th>
                        <th style={{ padding: "14px", textAlign: "left" }}>Extracted tracking</th>
                        <th style={{ padding: "14px", textAlign: "left" }}>Extracted recipient candidate</th>
                        <th style={{ padding: "14px", textAlign: "left" }}>Database Status</th>
                        <th style={{ padding: "14px", textAlign: "center" }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scannedMatches.map((match, index) => {
                        if (match.confidence !== "unmatched" && match.confidence !== "none") return null;
                        return (
                          <tr key={index} style={{ borderBottom: "1px solid var(--border-default)", background: "white" }}>
                            <td style={{ padding: "14px", textAlign: "center", color: "var(--text-muted)" }}>❌</td>
                            <td style={{ padding: "14px" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <span style={{ fontSize: "18px" }}>📄</span>
                                <span style={{ fontWeight: "600", fontSize: "13px", color: "var(--text-primary)" }}>{match.filename}</span>
                              </div>
                            </td>
                            <td style={{ padding: "14px" }}>
                              <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontFamily: "'Courier New', Courier, monospace", color: "var(--text-primary)", fontSize: "13px", background: "#f3f4f6", padding: "4px 8px", borderRadius: "6px" }}>
                                <span>🚚</span>
                                <span>{match.formatted_tracking || "Not Found"}</span>
                              </div>
                            </td>
                            <td style={{ padding: "14px" }}>
                              <span style={{ fontWeight: "700", fontSize: "13px", color: "hsl(0, 72.2%, 40%)" }}>{match.extracted_customer || "—"}</span>
                            </td>
                            <td style={{ padding: "14px" }}>
                              <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                                No matching name found in database orders
                              </span>
                            </td>
                            <td style={{ padding: "14px", textAlign: "center" }}>
                              <span style={{ display: "inline-block", padding: "4px 10px", borderRadius: "999px", fontSize: "11px", fontWeight: "700", background: "hsl(0, 72.2%, 93%)", color: "hsl(0, 72.2%, 25%)" }}>
                                NO ORDER MATCH
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )
              )}

            </div>
          </div>

          {/* Sync Button Toolbar */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "20px" }}>
            <button onClick={() => setScannedMatches([])} className="btn btn-secondary" style={{ padding: "0 20px" }}>
              Clear Panel
            </button>
            
            {activeTab !== "failed" && (
              <button
                onClick={handleSyncTracking}
                disabled={
                  syncing || 
                  selectedIndices.filter(idx => {
                    const conf = scannedMatches[idx]?.confidence;
                    return activeTab === "success" ? conf === "high" : conf === "duplicate";
                  }).length === 0
                }
                className="btn btn-primary"
                style={{
                  padding: "0 28px",
                  height: "44px",
                  fontWeight: "700",
                  fontSize: "14px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  boxShadow: activeTab === "success" 
                    ? "0 4px 6px -1px rgba(16, 185, 129, 0.2)"
                    : "0 4px 6px -1px rgba(245, 158, 11, 0.2)",
                  background: activeTab === "success" 
                    ? "hsl(142.1, 76.2%, 40%)"
                    : "hsl(47.9, 95.8%, 35%)",
                  border: "none",
                  color: "white"
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
                    <span>
                      {activeTab === "success" 
                        ? `Sync ${selectedIndices.filter(idx => scannedMatches[idx]?.confidence === "high").length} Matches to DB`
                        : `Overwrite ${selectedIndices.filter(idx => scannedMatches[idx]?.confidence === "duplicate").length} Duplicates in DB`
                      }
                    </span>
                  </>
                )}
              </button>
            )}
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
