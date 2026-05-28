"use client";

import React, { useState } from "react";
import Link from "next/link";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function StoreSyncPage() {
  const [syncing, setSyncing] = useState(false);
  const [platform, setPlatform] = useState("all");
  const [syncLogs, setSyncLogs] = useState<string[]>([]);
  const [syncedStats, setSyncedStats] = useState<any | null>(null);

  const handleStartSync = async () => {
    setSyncing(true);
    setSyncLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] Starting order & product synchronization for: ${platform}...`]);
    try {
      // Simulate steps in sync logs
      setSyncLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] Fetching API keys & configurations...`]);
      await new Promise((r) => setTimeout(r, 600));

      setSyncLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] Fetching unfulfilled orders from target stores...`]);
      await new Promise((r) => setTimeout(r, 600));

      const res = await fetch(`${API_BASE}/api/oms/sync?platform=${platform}`, {
        method: "POST",
      });

      if (res.ok) {
        const data = await res.json();
        setSyncedStats(data);
        setSyncLogs((prev) => [
          ...prev,
          `[${new Date().toLocaleTimeString()}] Synchronized successfully!`,
          `[${new Date().toLocaleTimeString()}] Result: ${data.message}`,
          `[${new Date().toLocaleTimeString()}] Products linked automatically with Orders.`
        ]);
      } else {
        setSyncLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] Sync failed. Check server connection.`]);
      }
    } catch (err) {
      console.error(err);
      setSyncLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] Error: Network error occurred during sync.`]);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="card" style={{ padding: "24px", maxWidth: "800px", margin: "0 auto" }}>
      <div style={{ display: "flex", gap: "12px", alignItems: "center", marginBottom: "16px" }}>
        <Link href="/oms" style={{ textDecoration: "none", fontSize: "20px" }}>⬅️</Link>
        <h2 style={{ fontSize: "20px", fontWeight: "bold", margin: 0, color: "var(--text-primary)" }}>Store Sync Settings</h2>
      </div>

      <p style={{ fontSize: "14px", color: "var(--text-secondary)", marginBottom: "24px" }}>
        Triggers product and order imports across connected shopping carts. Synced items automatically populates details like customer addresses, quantities, product images, and pricing.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "24px" }}>
        {/* Left Side: Controls */}
        <div style={{ background: "var(--bg-secondary)", padding: "20px", borderRadius: "8px", border: "1px solid var(--border-default)" }}>
          <h3 style={{ fontSize: "14px", fontWeight: "bold", margin: "0 0 12px 0", color: "var(--text-primary)" }}>1. Select Platform to Sync</h3>
          
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "20px" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "var(--text-primary)", cursor: "pointer" }}>
              <input type="radio" name="platform" value="all" checked={platform === "all"} onChange={() => setPlatform("all")} />
              All Platforms (Woo, Shopbase, Astro)
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "var(--text-primary)", cursor: "pointer" }}>
              <input type="radio" name="platform" value="shopbase" checked={platform === "shopbase"} onChange={() => setPlatform("shopbase")} />
              Shopbase only (Auto-captures Payments)
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "var(--text-primary)", cursor: "pointer" }}>
              <input type="radio" name="platform" value="woocommerce" checked={platform === "woocommerce"} onChange={() => setPlatform("woocommerce")} />
              WooCommerce only
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "var(--text-primary)", cursor: "pointer" }}>
              <input type="radio" name="platform" value="astro" checked={platform === "astro"} onChange={() => setPlatform("astro")} />
              Astro Storefront only
            </label>
          </div>

          <button
            onClick={handleStartSync}
            disabled={syncing}
            className="btn btn-primary"
            style={{ width: "100%", height: "42px", fontSize: "14px", fontWeight: "bold" }}
          >
            {syncing ? "⏳ Synchronizing..." : "⚡ Sync Active Orders"}
          </button>
        </div>

        {/* Right Side: Store Statuses */}
        <div style={{ background: "var(--bg-secondary)", padding: "20px", borderRadius: "8px", border: "1px solid var(--border-default)" }}>
          <h3 style={{ fontSize: "14px", fontWeight: "bold", margin: "0 0 12px 0", color: "var(--text-primary)" }}>Store Integrations</h3>
          
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-default)", paddingBottom: "8px" }}>
              <div>
                <div style={{ fontSize: "13px", fontWeight: "bold", color: "var(--text-primary)" }}>Shopbase Store</div>
                <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>JustOneTee Shopbase API</div>
              </div>
              <span style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "999px", background: "var(--accent-light)", color: "var(--accent)", fontWeight: "bold" }}>CONNECTED</span>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-default)", paddingBottom: "8px" }}>
              <div>
                <div style={{ fontSize: "13px", fontWeight: "bold", color: "var(--text-primary)" }}>WooCommerce Store</div>
                <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>justoneteeteam.org rest</div>
              </div>
              <span style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "999px", background: "var(--accent-light)", color: "var(--accent)", fontWeight: "bold" }}>CONNECTED</span>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: "13px", fontWeight: "bold", color: "var(--text-primary)" }}>Astro Headless API</div>
                <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>Astro static endpoints</div>
              </div>
              <span style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "999px", background: "var(--accent-light)", color: "var(--accent)", fontWeight: "bold" }}>CONNECTED</span>
            </div>
          </div>
        </div>
      </div>

      {/* Sync Log Pane */}
      <div style={{ background: "#111827", borderRadius: "8px", padding: "16px", color: "#10b981", fontFamily: "monospace", minHeight: "180px", maxHeight: "250px", overflowY: "auto", border: "1px solid #1f2937" }}>
        <div style={{ color: "#9ca3af", borderBottom: "1px solid #1f2937", paddingBottom: "6px", marginBottom: "10px", fontSize: "12px", display: "flex", justifyContent: "space-between" }}>
          <span>Sync Console Logs</span>
          <span>online</span>
        </div>
        {syncLogs.length === 0 ? (
          <div style={{ color: "#6b7280", fontStyle: "italic", fontSize: "13px" }}>Awaiting sync command. Press 'Sync Active Orders' above to pull products and order items.</div>
        ) : (
          syncLogs.map((log, index) => (
            <div key={index} style={{ fontSize: "13px", marginBottom: "4px", lineHeight: "1.4" }}>{log}</div>
          ))
        )}
      </div>

      {syncedStats && (
        <div style={{ marginTop: "20px", background: "#f0fdf4", padding: "12px 16px", borderRadius: "8px", border: "1px solid #bbf7d0", color: "#166534", fontSize: "14px" }}>
          🎉 <strong>Sync complete!</strong> Platform cached {syncedStats.synced_count} new orders. Synced products are cataloged under the Products tab. You can now view them in the main Orders screen.
        </div>
      )}
    </div>
  );
}
