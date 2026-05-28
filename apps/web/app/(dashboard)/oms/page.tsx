"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface OrderItem {
  id: number;
  product_name: string;
  product_image: string;
  quantity: number;
  variant: string;
  variant_value: string;
  cost: number;
}

interface GroupedOrder {
  order_id: string;
  store_id: string;
  order_name: string;
  customer_name: string;
  customer_address: string;
  customer_email: string;
  revenue: number;
  shipping_status: string;
  tracking_number: string;
  email_sent: boolean;
  created_at: string;
  items: OrderItem[];
}

interface RawOrder {
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
  shipping_status: string;
  tracking_number: string;
  email_sent: boolean;
  created_at: string;
}

export default function OrdersPage() {
  const [rawOrders, setRawOrders] = useState<RawOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [platform, setPlatform] = useState("");
  const [shippingStatus, setShippingStatus] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [trackSyncing, setTrackSyncing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);

  // Group raw orders by order_id
  const getGroupedOrders = (): GroupedOrder[] => {
    const groups: { [key: string]: GroupedOrder } = {};
    rawOrders.forEach((o) => {
      const key = o.order_id || `temp-${o.id}`;
      if (!groups[key]) {
        groups[key] = {
          order_id: o.order_id,
          store_id: o.store_id,
          order_name: o.order_name,
          customer_name: o.customer_name,
          customer_address: o.customer_address,
          customer_email: o.customer_email,
          revenue: o.revenue, // already order total revenue
          shipping_status: o.shipping_status,
          tracking_number: o.tracking_number,
          email_sent: o.email_sent,
          created_at: o.created_at,
          items: [],
        };
      }
      // Add item to group
      groups[key].items.push({
        id: o.id,
        product_name: o.product_name,
        product_image: o.product_image,
        quantity: o.quantity,
        variant: o.variant,
        variant_value: o.variant_value,
        cost: o.cost,
      });
    });
    return Object.values(groups);
  };

  const groupedOrders = getGroupedOrders();

  // Fetch orders
  const loadOrders = async () => {
    setLoading(true);
    setSyncNotice(null);
    try {
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (platform) params.append("platform", platform);
      if (shippingStatus) params.append("shipping_status", shippingStatus);
      if (startDate) params.append("start_date", startDate);
      if (endDate) params.append("end_date", endDate);

      const res = await fetch(`${API_BASE}/api/oms/orders?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setRawOrders(data);
      }
    } catch (err) {
      console.error("Failed to load orders", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, [platform, shippingStatus, startDate, endDate]);

  // Handle Search on Enter
  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      loadOrders();
    }
  };

  // Selection handlers
  const toggleSelectOrder = (orderId: string) => {
    setSelectedOrderIds((prev) =>
      prev.includes(orderId) ? prev.filter((id) => id !== orderId) : [...prev, orderId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedOrderIds.length === groupedOrders.length) {
      setSelectedOrderIds([]);
    } else {
      setSelectedOrderIds(groupedOrders.map((o) => o.order_id));
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

  // Export selected orders to Excel resolving item database IDs
  const handleExportExcel = async () => {
    if (selectedOrderIds.length === 0) {
      alert("Please select at least one order to export.");
      return;
    }
    setExporting(true);
    try {
      // Gather database line item IDs belonging to selected grouped orders
      const selectedDbIds: number[] = [];
      groupedOrders.forEach((o) => {
        if (selectedOrderIds.includes(o.order_id)) {
          o.items.forEach((item) => selectedDbIds.push(item.id));
        }
      });

      const idsStr = selectedDbIds.join(",");
      const url = `${API_BASE}/api/oms/export?ids=${idsStr}`;
      window.open(url, "_blank");
    } catch (err) {
      console.error(err);
      alert("Error generating supplier spreadsheet.");
    } finally {
      setExporting(false);
    }
  };

  // Aggregate metrics using merged grouped orders to avoid duplicate revenue counting
  const totalRevenue = groupedOrders.reduce((sum, o) => sum + o.revenue, 0);
  const totalCost = groupedOrders.reduce((sum, o) => sum + o.items.reduce((iSum, item) => iSum + (item.cost * item.quantity), 0), 0);
  const totalProfit = totalRevenue - totalCost;

  return (
    <div className="card" style={{ padding: "24px", minHeight: "85vh", display: "flex", flexDirection: "column" }}>
      {/* Header Panel */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <h2 style={{ fontSize: "22px", fontWeight: "bold", margin: 0, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "8px" }}>
            📦 Centralized Order Logistics Dashboard
          </h2>
          <p style={{ margin: "4px 0 0 0", fontSize: "14px", color: "var(--text-secondary)" }}>
            Fulfillment logs & real-time ShopBase / WooCommerce carrier synchronization.
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
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
            disabled={exporting || selectedOrderIds.length === 0}
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
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px", marginBottom: "24px" }}>
        <div style={{ background: "var(--bg-secondary)", padding: "16px", borderRadius: "10px", border: "1px solid var(--border-default)" }}>
          <div style={{ fontSize: "11px", color: "var(--text-secondary)", textTransform: "uppercase", fontWeight: "bold" }}>Total Synced Orders</div>
          <div style={{ fontSize: "28px", fontWeight: "bold", color: "var(--text-primary)", marginTop: "4px" }}>{groupedOrders.length}</div>
        </div>
        <div style={{ background: "var(--bg-secondary)", padding: "16px", borderRadius: "10px", border: "1px solid var(--border-default)" }}>
          <div style={{ fontSize: "11px", color: "var(--text-secondary)", textTransform: "uppercase", fontWeight: "bold" }}>Total Revenue</div>
          <div style={{ fontSize: "28px", fontWeight: "bold", color: "var(--accent)", marginTop: "4px" }}>${totalRevenue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        </div>
        <div style={{ background: "var(--bg-secondary)", padding: "16px", borderRadius: "10px", border: "1px solid var(--border-default)" }}>
          <div style={{ fontSize: "11px", color: "var(--text-secondary)", textTransform: "uppercase", fontWeight: "bold" }}>Supplier Cost</div>
          <div style={{ fontSize: "28px", fontWeight: "bold", color: "var(--error)", marginTop: "4px" }}>${totalCost.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        </div>
        <div style={{ background: "var(--bg-secondary)", padding: "16px", borderRadius: "10px", border: "1px solid var(--border-default)" }}>
          <div style={{ fontSize: "11px", color: "var(--text-secondary)", textTransform: "uppercase", fontWeight: "bold" }}>Net profit margin</div>
          <div style={{ fontSize: "28px", fontWeight: "bold", color: "var(--success)", marginTop: "4px" }}>${totalProfit.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        </div>
      </div>

      {/* Advanced Spreadsheet Filters & Calendar Range */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", marginBottom: "20px", background: "var(--bg-secondary)", padding: "16px", borderRadius: "10px", border: "1px solid var(--border-default)", alignItems: "center" }}>
        <div style={{ flex: "2 1 300px" }}>
          <label style={{ fontSize: "11px", fontWeight: "bold", color: "var(--text-secondary)", display: "block", marginBottom: "4px" }}>SEARCH KEYWORD</label>
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
        
        {/* Calendar Range Filters */}
        <div style={{ flex: "1 1 150px" }}>
          <label style={{ fontSize: "11px", fontWeight: "bold", color: "var(--text-secondary)", display: "block", marginBottom: "4px" }}>START DATE</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--border-default)", borderRadius: "6px", height: "40px" }}
          />
        </div>
        <div style={{ flex: "1 1 150px" }}>
          <label style={{ fontSize: "11px", fontWeight: "bold", color: "var(--text-secondary)", display: "block", marginBottom: "4px" }}>END DATE</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--border-default)", borderRadius: "6px", height: "40px" }}
          />
        </div>

        <div>
          <label style={{ fontSize: "11px", fontWeight: "bold", color: "var(--text-secondary)", display: "block", marginBottom: "4px" }}>PLATFORM STORE</label>
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
            style={{ padding: "8px 12px", border: "1px solid var(--border-default)", borderRadius: "6px", background: "white", height: "40px", width: "150px" }}
          >
            <option value="">All Stores</option>
            <option value="woo">WooCommerce</option>
            <option value="sb">ShopBase</option>
          </select>
        </div>

        <div>
          <label style={{ fontSize: "11px", fontWeight: "bold", color: "var(--text-secondary)", display: "block", marginBottom: "4px" }}>SHIPPING LOGISTICS</label>
          <select
            value={shippingStatus}
            onChange={(e) => setShippingStatus(e.target.value)}
            style={{ padding: "8px 12px", border: "1px solid var(--border-default)", borderRadius: "6px", background: "white", height: "40px", width: "160px" }}
          >
            <option value="">All Statuses</option>
            <option value="placed">Placed</option>
            <option value="in transit">In Transit</option>
            <option value="delivered">Delivered</option>
            <option value="incident">Incident</option>
          </select>
        </div>

        <div style={{ alignSelf: "flex-end", height: "40px" }}>
          <button
            onClick={loadOrders}
            className="btn btn-primary"
            style={{ height: "40px", padding: "0 20px", display: "inline-flex", alignItems: "center", gap: "6px" }}
          >
            🔍 Filter
          </button>
        </div>
      </div>

      {/* Table grid representing columns exactly as shown in screenshot */}
      {loading ? (
        <div style={{ padding: "80px 0", textAlign: "center", color: "var(--text-secondary)", flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
          <div className="spinner" style={{ display: "inline-block", width: "32px", height: "32px", border: "4px solid var(--border-default)", borderTopColor: "var(--accent)", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
          <p style={{ marginTop: "16px", fontWeight: "500" }}>Accessing Logistics database...</p>
        </div>
      ) : groupedOrders.length === 0 ? (
        <div style={{ padding: "80px 0", textAlign: "center", border: "1px dashed var(--border-default)", borderRadius: "10px", flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
          <p style={{ color: "var(--text-secondary)", margin: 0, fontSize: "16px", fontWeight: "500" }}>No logistics order rows found matching criteria.</p>
          <p style={{ color: "var(--text-muted)", margin: "6px 0 20px 0", fontSize: "13px" }}>Check your date filters or import new sales logs.</p>
          <Link href="/oms/sync" className="btn btn-secondary" style={{ textDecoration: "none" }}>Trigger Store Sync</Link>
        </div>
      ) : (
        <div style={{ overflowX: "auto", flex: 1, border: "1px solid var(--border-default)", borderRadius: "10px", background: "white" }}>
          <table className="table" style={{ width: "100%", borderCollapse: "collapse", minWidth: "1600px" }}>
            <thead>
              <tr style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border-default)", textTransform: "uppercase", fontSize: "10px", fontWeight: "bold", color: "var(--text-secondary)" }}>
                <th style={{ width: "40px", padding: "14px 12px", textAlign: "center" }}>
                  <input
                    type="checkbox"
                    checked={selectedOrderIds.length === groupedOrders.length}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th style={{ padding: "14px 12px", textAlign: "left" }}>Store ID</th>
                <th style={{ padding: "14px 12px", textAlign: "left" }}>Order ID</th>
                <th style={{ padding: "14px 12px", textAlign: "left" }}>Order Name</th>
                <th style={{ padding: "14px 12px", textAlign: "left" }}>Customer Name</th>
                <th style={{ padding: "14px 12px", textAlign: "left" }}>Customer Addr</th>
                <th style={{ padding: "14px 12px", textAlign: "left" }}>Email</th>
                <th style={{ padding: "14px 12px", textAlign: "left" }}>Product Name</th>
                <th style={{ padding: "14px 12px", textAlign: "center", width: "110px" }}>Product Image</th>
                <th style={{ padding: "14px 12px", textAlign: "center", width: "80px" }}>Quantity</th>
                <th style={{ padding: "14px 12px", textAlign: "left", width: "200px" }}>Variant</th>
                <th style={{ padding: "14px 12px", textAlign: "left", width: "100px" }}>Val</th>
                <th style={{ padding: "14px 12px", textAlign: "right" }}>Revenue</th>
                <th style={{ padding: "14px 12px", textAlign: "right", width: "100px" }}>Cost</th>
                <th style={{ padding: "14px 12px", textAlign: "center", width: "140px" }}>Created At</th>
                <th style={{ padding: "14px 12px", textAlign: "center" }}>Status</th>
                <th style={{ padding: "14px 12px", textAlign: "left" }}>Tracking number</th>
                <th style={{ padding: "14px 12px", textAlign: "center" }}>Email sent</th>
              </tr>
            </thead>
            <tbody>
              {groupedOrders.map((order) => {
                const isSelected = selectedOrderIds.includes(order.order_id);
                
                const isDelivered = order.shipping_status === "delivered";
                const isInTransit = order.shipping_status === "in transit";
                const isIncident = order.shipping_status === "incident";
                
                const statusColor = isDelivered 
                  ? { bg: "#D1FAE5", text: "#065F46" } 
                  : isInTransit 
                  ? { bg: "#E0F2FE", text: "#0369A1" } 
                  : isIncident 
                  ? { bg: "#FEE2E2", text: "#991B1B" } 
                  : { bg: "#FEF3C7", text: "#92400E" };

                // Get count of line items in this order
                const itemsCount = order.items.length;

                return (
                  <tr key={order.order_id} style={{ borderBottom: "1px solid var(--border-default)", background: isSelected ? "var(--bg-tertiary)" : "white" }}>
                    <td style={{ padding: "12px", textAlign: "center", verticalAlign: "middle" }}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectOrder(order.order_id)}
                      />
                    </td>
                    {/* Store ID */}
                    <td style={{ padding: "12px", fontWeight: "bold", color: "var(--text-primary)", verticalAlign: "middle" }}>
                      {order.store_id.replace(" WooCommerce", "").replace(" ShopBase", "")}
                    </td>
                    {/* Order ID */}
                    <td style={{ padding: "12px", color: "var(--text-primary)", verticalAlign: "middle" }}>{order.order_id}</td>
                    {/* Order Name */}
                    <td style={{ padding: "12px", fontWeight: "bold", color: "var(--text-primary)", verticalAlign: "middle" }}>{order.order_name}</td>
                    {/* Customer Name */}
                    <td style={{ padding: "12px", fontWeight: "500", color: "var(--text-primary)", verticalAlign: "middle" }}>{order.customer_name}</td>
                    {/* Customer Addr */}
                    <td style={{ padding: "12px", fontSize: "12px", color: "var(--text-secondary)", maxWidth: "240px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", verticalAlign: "middle" }} title={order.customer_address}>
                      {order.customer_address}
                    </td>
                    {/* Email */}
                    <td style={{ padding: "12px", fontSize: "12px", color: "var(--text-secondary)", verticalAlign: "middle" }}>{order.customer_email}</td>
                    
                    {/* STACKED LINE ITEMS COLUMNS */}
                    
                    {/* Product Name */}
                    <td style={{ padding: "12px", verticalAlign: "middle" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        {order.items.map((item, idx) => (
                          <div 
                            key={item.id} 
                            style={{ 
                              height: "38px", 
                              display: "flex", 
                              alignItems: "center", 
                              fontSize: "12px", 
                              fontWeight: "500", 
                              color: "var(--text-primary)", 
                              maxWidth: "220px", 
                              overflow: "hidden", 
                              textOverflow: "ellipsis", 
                              whiteSpace: "nowrap",
                              borderBottom: idx < itemsCount - 1 ? "1px dashed #f0f0f0" : "none"
                            }} 
                            title={item.product_name}
                          >
                            {item.product_name}
                          </div>
                        ))}
                      </div>
                    </td>
                    
                    {/* Product Image */}
                    <td style={{ padding: "12px", verticalAlign: "middle", textAlign: "center" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px", alignItems: "center" }}>
                        {order.items.map((item) => (
                          <div key={item.id} style={{ height: "38px", display: "flex", alignItems: "center" }}>
                            {item.product_image ? (
                              <img
                                src={item.product_image}
                                alt=""
                                style={{ width: "34px", height: "34px", borderRadius: "4px", objectFit: "cover", border: "1px solid var(--border-default)" }}
                              />
                            ) : (
                              <div style={{ width: "34px", height: "34px", borderRadius: "4px", background: "var(--bg-tertiary)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px" }}>🎽</div>
                            )}
                          </div>
                        ))}
                      </div>
                    </td>
                    
                    {/* Quantity */}
                    <td style={{ padding: "12px", verticalAlign: "middle", textAlign: "center" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px", alignItems: "center" }}>
                        {order.items.map((item) => (
                          <div key={item.id} style={{ height: "38px", display: "flex", alignItems: "center", color: "var(--text-primary)", fontWeight: "500" }}>
                            {item.quantity}
                          </div>
                        ))}
                      </div>
                    </td>
                    
                    {/* Variant */}
                    <td style={{ padding: "12px", verticalAlign: "middle" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        {order.items.map((item, idx) => (
                          <div 
                            key={item.id} 
                            style={{ 
                              height: "38px", 
                              display: "flex", 
                              alignItems: "center", 
                              fontSize: "11px", 
                              color: "var(--text-secondary)", 
                              maxWidth: "200px", 
                              overflow: "hidden", 
                              textOverflow: "ellipsis", 
                              whiteSpace: "nowrap",
                              borderBottom: idx < itemsCount - 1 ? "1px dashed #f0f0f0" : "none"
                            }}
                            title={item.variant}
                          >
                            {item.variant || "—"}
                          </div>
                        ))}
                      </div>
                    </td>
                    
                    {/* Val (Variant Value) */}
                    <td style={{ padding: "12px", verticalAlign: "middle" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        {order.items.map((item, idx) => (
                          <div 
                            key={item.id} 
                            style={{ 
                              height: "38px", 
                              display: "flex", 
                              alignItems: "center", 
                              fontSize: "11px", 
                              color: "var(--text-secondary)", 
                              maxWidth: "80px", 
                              overflow: "hidden", 
                              textOverflow: "ellipsis", 
                              whiteSpace: "nowrap",
                              borderBottom: idx < itemsCount - 1 ? "1px dashed #f0f0f0" : "none"
                            }}
                            title={item.variant_value}
                          >
                            {item.variant_value || "—"}
                          </div>
                        ))}
                      </div>
                    </td>
                    
                    {/* Revenue (Single cell value for whole order) */}
                    <td style={{ padding: "12px", textAlign: "right", fontWeight: "bold", color: "var(--text-primary)", verticalAlign: "middle", fontSize: "14px" }}>
                      ${order.revenue.toFixed(2)}
                    </td>
                    
                    {/* Cost */}
                    <td style={{ padding: "12px", verticalAlign: "middle", textAlign: "right" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px", alignItems: "flex-end" }}>
                        {order.items.map((item) => (
                          <div key={item.id} style={{ height: "38px", display: "flex", alignItems: "center", color: "var(--error)", fontWeight: "500" }}>
                            ${item.cost.toFixed(2)}
                          </div>
                        ))}
                      </div>
                    </td>
                    
                    {/* Exposed Created At (Full Date and Time) */}
                    <td style={{ padding: "12px", fontSize: "11px", color: "var(--text-secondary)", textAlign: "center", verticalAlign: "middle" }}>
                      {order.created_at ? (() => {
                        const dateStr = order.created_at;
                        const parts = dateStr.split("T");
                        const datePart = parts[0] || "";
                        const timePart = parts[1] ? parts[1].slice(0, 5) : "";
                        return (
                          <div style={{ lineHeight: "1.4" }}>
                            <div style={{ fontWeight: "bold" }}>{datePart}</div>
                            <div style={{ color: "var(--text-muted)", fontSize: "10px" }}>{timePart}</div>
                          </div>
                        );
                      })() : "—"}
                    </td>
                    
                    {/* status pill matching image */}
                    <td style={{ padding: "12px", textAlign: "center", verticalAlign: "middle" }}>
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
                    <td style={{ padding: "12px", fontSize: "12px", fontFamily: "monospace", color: "var(--text-primary)", verticalAlign: "middle" }}>
                      {order.tracking_number ? (
                        <span style={{ color: "var(--accent)", fontWeight: "bold" }}>📦 {order.tracking_number}</span>
                      ) : (
                        <span style={{ color: "var(--text-muted)", fontStyle: "italic" }}>Awaiting sync...</span>
                      )}
                    </td>
                    
                    {/* Email sent */}
                    <td style={{ padding: "12px", textAlign: "center", verticalAlign: "middle" }}>
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
