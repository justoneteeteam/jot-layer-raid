"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Order {
  id: number;
  store_id: string;
  order_id: string;
  order_name: string;
  customer_name: string;
  customer_address: string;
  customer_email: string;
  product_name: string;
  product_image: string;
  quantity: number;
  variant: string;
  variant_value: string;
  revenue: number;
  cost: number;
  shipping_status: string; // placed, in transit, delivered, incident
  tracking_number: string;
  email_sent: boolean;
  created_at: string;
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [platform, setPlatform] = useState("");
  const [shippingStatus, setShippingStatus] = useState("");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [trackSyncing, setTrackSyncing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);

  // Fetch orders
  const loadOrders = async () => {
    setLoading(true);
    setSyncNotice(null);
    try {
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (platform) params.append("platform", platform);
      if (shippingStatus) params.append("shipping_status", shippingStatus);

      const res = await fetch(`${API_BASE}/api/oms/orders?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setOrders(data);
      }
    } catch (err) {
      console.error("Failed to load orders", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, [platform, shippingStatus]);

  // Handle Search on Enter
  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      loadOrders();
    }
  };

  // Selection handlers
  const toggleSelectOrder = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === orders.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(orders.map((o) => o.id));
    }
  };

  // Sync package tracking statuses with 17track API
  const handleSync17Track = async () => {
    setTrackSyncing(true);
    setSyncNotice(null);
    try {
      const res = await fetch(`${API_BASE}/api/oms/17track/sync`, {
        method: "POST",
      });
      if (res.ok) {
        const data = await res.json();
        setSyncNotice(data.message);
        loadOrders();
      } else {
        alert("Failed to synchronize with 17track API.");
      }
    } catch (err) {
      console.error(err);
      alert("Error contacting tracking server.");
    } finally {
      setTrackSyncing(false);
    }
  };

  // Export selected orders to Excel matching the exact columns
  const handleExportExcel = async () => {
    if (selectedIds.length === 0) {
      alert("Please select at least one order to export.");
      return;
    }
    setExporting(true);
    try {
      const idsStr = selectedIds.join(",");
      const url = `${API_BASE}/api/oms/export?ids=${idsStr}`;
      window.open(url, "_blank");
    } catch (err) {
      console.error(err);
      alert("Error generating supplier spreadsheet.");
    } finally {
      setExporting(false);
    }
  };

  // Aggregate metrics
  const totalRevenue = orders.reduce((sum, o) => sum + o.revenue, 0);
  const totalCost = orders.reduce((sum, o) => sum + o.cost, 0);
  const totalProfit = totalRevenue - totalCost;

  return (
    <div className="card" style={{ padding: "24px" }}>
      {/* Header Panel */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <div>
          <h2 style={{ fontSize: "20px", fontWeight: "bold", margin: 0, color: "var(--text-primary)" }}>Order Logistics Dashboard</h2>
          <p style={{ margin: "4px 0 0 0", fontSize: "14px", color: "var(--text-secondary)" }}>
            Dropshipping Order Fulfillment tracking & carrier synchronization.
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <button
            onClick={handleSync17Track}
            disabled={trackSyncing}
            className="btn btn-secondary"
            style={{ display: "inline-flex", alignItems: "center", gap: "6px", border: "1px solid var(--accent)", color: "var(--accent)", background: "var(--accent-light)" }}
          >
            {trackSyncing ? "✈️ Syncing 17track..." : "✈️ Sync 17track"}
          </button>
          <Link href="/oms/sync" className="btn btn-secondary" style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "6px" }}>
            🔄 Sync Stores
          </Link>
          <button
            onClick={handleExportExcel}
            className="btn btn-primary"
            style={{ display: "inline-flex", alignItems: "center", gap: "6px", backgroundColor: "var(--success)", border: "none" }}
            disabled={exporting || selectedIds.length === 0}
          >
            {exporting ? "Generating..." : "📊 Export Supplier"}
          </button>
        </div>
      </div>

      {syncNotice && (
        <div style={{ background: "#e0f2fe", border: "1px solid #bae6fd", color: "#0369a1", padding: "12px 16px", borderRadius: "8px", marginBottom: "20px", fontSize: "14px", fontWeight: "500" }}>
          📡 <strong>17track API Sync:</strong> {syncNotice}
        </div>
      )}

      {/* Aggregated Logistics Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px", marginBottom: "24px" }}>
        <div style={{ background: "var(--bg-secondary)", padding: "16px", borderRadius: "8px", border: "1px solid var(--border-default)" }}>
          <div style={{ fontSize: "11px", color: "var(--text-secondary)", textTransform: "uppercase", fontWeight: "bold" }}>Total Orders</div>
          <div style={{ fontSize: "28px", fontWeight: "bold", color: "var(--text-primary)", marginTop: "4px" }}>{orders.length}</div>
        </div>
        <div style={{ background: "var(--bg-secondary)", padding: "16px", borderRadius: "8px", border: "1px solid var(--border-default)" }}>
          <div style={{ fontSize: "11px", color: "var(--text-secondary)", textTransform: "uppercase", fontWeight: "bold" }}>Total Revenue</div>
          <div style={{ fontSize: "28px", fontWeight: "bold", color: "var(--accent)", marginTop: "4px" }}>${totalRevenue.toFixed(2)}</div>
        </div>
        <div style={{ background: "var(--bg-secondary)", padding: "16px", borderRadius: "8px", border: "1px solid var(--border-default)" }}>
          <div style={{ fontSize: "11px", color: "var(--text-secondary)", textTransform: "uppercase", fontWeight: "bold" }}>Supplier Cost</div>
          <div style={{ fontSize: "28px", fontWeight: "bold", color: "var(--error)", marginTop: "4px" }}>${totalCost.toFixed(2)}</div>
        </div>
        <div style={{ background: "var(--bg-secondary)", padding: "16px", borderRadius: "8px", border: "1px solid var(--border-default)" }}>
          <div style={{ fontSize: "11px", color: "var(--text-secondary)", textTransform: "uppercase", fontWeight: "bold" }}>Net profit margin</div>
          <div style={{ fontSize: "28px", fontWeight: "bold", color: "var(--success)", marginTop: "4px" }}>${totalProfit.toFixed(2)}</div>
        </div>
      </div>

      {/* Advanced Spreadsheet Filters */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", marginBottom: "20px", background: "var(--bg-secondary)", padding: "12px", borderRadius: "8px", border: "1px solid var(--border-default)" }}>
        <div style={{ flex: 1, minWidth: "200px" }}>
          <input
            type="text"
            className="form-control"
            placeholder="Search by buyer, order ID, product name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--border-default)", borderRadius: "6px", height: "40px" }}
          />
        </div>
        <div>
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
            style={{ padding: "8px 12px", border: "1px solid var(--border-default)", borderRadius: "6px", background: "white", height: "40px", width: "150px" }}
          >
            <option value="">All Stores</option>
            <option value="woo">WooCommerce</option>
            <option value="sb">Shopbase</option>
          </select>
        </div>
        <div>
          <select
            value={shippingStatus}
            onChange={(e) => setShippingStatus(e.target.value)}
            style={{ padding: "8px 12px", border: "1px solid var(--border-default)", borderRadius: "6px", background: "white", height: "40px", width: "160px" }}
          >
            <option value="">All Logis status</option>
            <option value="placed">Placed</option>
            <option value="in transit">In Transit</option>
            <option value="delivered">Delivered</option>
            <option value="incident">Incident</option>
          </select>
        </div>
        <button
          onClick={loadOrders}
          className="btn btn-primary"
          style={{ height: "40px", padding: "0 16px", display: "inline-flex", alignItems: "center" }}
        >
          🔍 Search
        </button>
      </div>

      {/* Table grid representing columns exactly as shown in screenshot */}
      {loading ? (
        <div style={{ padding: "40px", textAlign: "center", color: "var(--text-secondary)" }}>
          <div className="spinner" style={{ display: "inline-block", width: "24px", height: "24px", border: "3px solid #ccc", borderTopColor: "var(--accent)", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
          <p style={{ marginTop: "12px" }}>Accessing Logistics database...</p>
        </div>
      ) : orders.length === 0 ? (
        <div style={{ padding: "60px", textAlign: "center", border: "1px dashed var(--border-default)", borderRadius: "8px" }}>
          <p style={{ color: "var(--text-secondary)", margin: 0, fontSize: "15px" }}>No logistics order rows found.</p>
          <p style={{ color: "var(--text-muted)", margin: "4px 0 16px 0", fontSize: "13px" }}>Import/Sync active stores to catalog dataset.</p>
          <Link href="/oms/sync" className="btn btn-secondary" style={{ textDecoration: "none" }}>Trigger Store Sync</Link>
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="table" style={{ width: "100%", borderCollapse: "collapse", minWidth: "1500px" }}>
            <thead>
              <tr style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border-default)", textTransform: "uppercase", fontSize: "10px", fontWeight: "bold", color: "var(--text-secondary)" }}>
                <th style={{ width: "40px", padding: "12px", textAlign: "center" }}>
                  <input
                    type="checkbox"
                    checked={selectedIds.length === orders.length}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th style={{ padding: "12px", textAlign: "left" }}>Store ID</th>
                <th style={{ padding: "12px", textAlign: "left" }}>Order ID</th>
                <th style={{ padding: "12px", textAlign: "left" }}>Order Name</th>
                <th style={{ padding: "12px", textAlign: "left" }}>Customer Name</th>
                <th style={{ padding: "12px", textAlign: "left" }}>Customer Addr</th>
                <th style={{ padding: "12px", textAlign: "left" }}>Email</th>
                <th style={{ padding: "12px", textAlign: "left" }}>Product Name</th>
                <th style={{ padding: "12px", textAlign: "center" }}>Product Image</th>
                <th style={{ padding: "12px", textAlign: "center" }}>Quantity</th>
                <th style={{ padding: "12px", textAlign: "left" }}>Variant</th>
                <th style={{ padding: "12px", textAlign: "left" }}>Val</th>
                <th style={{ padding: "12px", textAlign: "right" }}>Revenue</th>
                <th style={{ padding: "12px", textAlign: "right" }}>Cost</th>
                <th style={{ padding: "12px", textAlign: "center" }}>Created At</th>
                <th style={{ padding: "12px", textAlign: "center" }}>status</th>
                <th style={{ padding: "12px", textAlign: "left" }}>Tracking number</th>
                <th style={{ padding: "12px", textAlign: "center" }}>Email sent</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                const isSelected = selectedIds.includes(order.id);
                
                // Maps to screenshot statuses
                const isDelivered = order.shipping_status === "delivered";
                const isInTransit = order.shipping_status === "in transit";
                const isIncident = order.shipping_status === "incident";
                
                const statusColor = isDelivered 
                  ? { bg: "#D1FAE5", text: "#065F46" } // Green
                  : isInTransit 
                  ? { bg: "#E0F2FE", text: "#0369A1" } // Light blue
                  : isIncident 
                  ? { bg: "#FEE2E2", text: "#991B1B" } // Red
                  : { bg: "#FEF3C7", text: "#92400E" }; // Grey/Yellow

                return (
                  <tr key={order.id} style={{ borderBottom: "1px solid var(--border-default)", background: isSelected ? "var(--bg-tertiary)" : "white" }}>
                    <td style={{ padding: "12px", textAlign: "center" }}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectOrder(order.id)}
                      />
                    </td>
                    {/* Store ID */}
                    <td style={{ padding: "12px", fontWeight: "bold", color: "var(--text-primary)" }}>{order.store_id}</td>
                    {/* Order ID */}
                    <td style={{ padding: "12px", color: "var(--text-primary)" }}>{order.order_id}</td>
                    {/* Order Name */}
                    <td style={{ padding: "12px", fontWeight: "bold", color: "var(--text-primary)" }}>{order.order_name}</td>
                    {/* Customer Name */}
                    <td style={{ padding: "12px", fontWeight: "500", color: "var(--text-primary)" }}>{order.customer_name}</td>
                    {/* Customer Addr */}
                    <td style={{ padding: "12px", fontSize: "12px", color: "var(--text-secondary)", maxWidth: "250px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={order.customer_address}>
                      {order.customer_address}
                    </td>
                    {/* Email */}
                    <td style={{ padding: "12px", fontSize: "12px", color: "var(--text-secondary)" }}>{order.customer_email}</td>
                    {/* Product Name */}
                    <td style={{ padding: "12px", fontSize: "12px", fontWeight: "500", color: "var(--text-primary)", maxWidth: "220px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={order.product_name}>
                      {order.product_name}
                    </td>
                    {/* Product Image */}
                    <td style={{ padding: "12px", textAlign: "center" }}>
                      {order.product_image ? (
                        <img
                          src={order.product_image}
                          alt=""
                          style={{ width: "36px", height: "36px", borderRadius: "4px", objectFit: "cover", border: "1px solid var(--border-default)" }}
                        />
                      ) : (
                        <div style={{ width: "36px", height: "36px", borderRadius: "4px", background: "var(--bg-tertiary)", display: "flex", alignItems: "center", justifyContent: "center" }}>🎽</div>
                      )}
                    </td>
                    {/* Quantity */}
                    <td style={{ padding: "12px", textAlign: "center", color: "var(--text-primary)" }}>{order.quantity}</td>
                    {/* Variant */}
                    <td style={{ padding: "12px", fontSize: "12px", color: "var(--text-secondary)" }}>{order.variant || "—"}</td>
                    {/* Variant Value */}
                    <td style={{ padding: "12px", fontSize: "12px", color: "var(--text-secondary)" }}>{order.variant_value || "—"}</td>
                    {/* Revenue */}
                    <td style={{ padding: "12px", textAlign: "right", fontWeight: "bold", color: "var(--text-primary)" }}>${order.revenue.toFixed(2)}</td>
                    {/* Cost */}
                    <td style={{ padding: "12px", textAlign: "right", color: "var(--error)" }}>${order.cost.toFixed(2)}</td>
                    {/* Created At */}
                    <td style={{ padding: "12px", fontSize: "11px", color: "var(--text-secondary)", textAlign: "center" }}>
                      {order.created_at ? order.created_at.split("T")[0] : "—"}
                    </td>
                    {/* status pill matching image */}
                    <td style={{ padding: "12px", textAlign: "center" }}>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "4px 10px",
                          borderRadius: "12px",
                          fontSize: "11px",
                          fontWeight: "bold",
                          textTransform: "uppercase",
                          background: statusColor.bg,
                          color: statusColor.text,
                        }}
                      >
                        {order.shipping_status === "placed" ? "placed..." : order.shipping_status}
                      </span>
                    </td>
                    {/* Tracking number */}
                    <td style={{ padding: "12px", fontSize: "12px", fontFamily: "monospace", color: "var(--text-primary)" }}>
                      {order.tracking_number ? (
                        <span style={{ color: "var(--accent)", fontWeight: "bold" }}>📦 {order.tracking_number}</span>
                      ) : (
                        <span style={{ color: "var(--text-muted)", fontStyle: "italic" }}>Awaiting sync...</span>
                      )}
                    </td>
                    {/* Email sent */}
                    <td style={{ padding: "12px", textAlign: "center" }}>
                      {order.email_sent ? (
                        <span style={{ color: "var(--success)", fontWeight: "bold" }}>✔️ Sent</span>
                      ) : (
                        <span style={{ color: "var(--text-muted)" }}>No</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
