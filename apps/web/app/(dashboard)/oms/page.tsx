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

const formatCreatedDate = (dateStr: string) => {
  if (!dateStr) return "—";
  try {
    const dateObj = new Date(dateStr);
    if (isNaN(dateObj.getTime())) {
      const parts = dateStr.split("T");
      const datePart = parts[0] || "";
      const dateSubparts = datePart.split("-");
      if (dateSubparts.length === 3) {
        const y = dateSubparts[0]!.slice(-2);
        const m = dateSubparts[1]!;
        const d = dateSubparts[2]!;
        return `${d}/${m}/${y}`;
      }
      return dateStr;
    }
    const day = String(dateObj.getDate()).padStart(2, "0");
    const month = String(dateObj.getMonth() + 1).padStart(2, "0");
    const year = String(dateObj.getFullYear()).slice(-2);
    return `${day}/${month}/${year}`;
  } catch (e) {
    return dateStr;
  }
};

const formatTimelineDate = (dateStr: string) => {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const hours = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    return `${hours}:${minutes} ${day}/${month}`;
  } catch (e) {
    return dateStr;
  }
};

export default function OrdersPage() {
  const [rawOrders, setRawOrders] = useState<RawOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searchField, setSearchField] = useState("all");
  const [platform, setPlatform] = useState("");
  const [shippingStatus, setShippingStatus] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [presetRange, setPresetRange] = useState("all");
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [trackSyncing, setTrackSyncing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);

  // Order details modal states
  const [activeDetailOrder, setActiveDetailOrder] = useState<GroupedOrder | null>(null);
  const [customerProfile, setCustomerProfile] = useState<any>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);
  const [resending, setResending] = useState(false);
  const [deletingOrder, setDeletingOrder] = useState(false);
  
  // Editable fields in modal
  const [editOrderId, setEditOrderId] = useState("");
  const [editTrackingNumber, setEditTrackingNumber] = useState("");
  const [editShippingStatus, setEditShippingStatus] = useState("");
  const [editEmailSent, setEditEmailSent] = useState(false);
  const [editCustomerName, setEditCustomerName] = useState("");
  const [editCustomerEmail, setEditCustomerEmail] = useState("");
  const [editCustomerAddress, setEditCustomerAddress] = useState("");

  // Quick reply state inside modal
  const [quickReplyText, setQuickReplyText] = useState("");
  const [replyStatus, setReplyStatus] = useState("resolved");
  const [sendingReply, setSendingReply] = useState(false);

  const loadCustomerProfile = async (email: string) => {
    if (!email) return;
    setLoadingProfile(true);
    setCustomerProfile(null);
    try {
      const res = await fetch(`${API_BASE}/api/oms/customers/${email}`);
      if (res.ok) {
        const data = await res.json();
        setCustomerProfile(data);
      }
    } catch (err) {
      console.error("Failed to load customer profile", err);
    } finally {
      setLoadingProfile(false);
    }
  };

  const openOrderDetails = (order: GroupedOrder) => {
    setActiveDetailOrder(order);
    setEditOrderId(order.order_id);
    setEditTrackingNumber(order.tracking_number || "");
    setEditShippingStatus(order.shipping_status || "placed");
    setEditEmailSent(order.email_sent || false);
    setEditCustomerName(order.customer_name || "");
    setEditCustomerEmail(order.customer_email || "");
    setEditCustomerAddress(order.customer_address || "");
    
    // Reset quick reply inputs
    setQuickReplyText("");
    setReplyStatus("resolved");

    loadCustomerProfile(order.customer_email);
  };

  const handleSaveOrderDetails = async () => {
    if (!activeDetailOrder) return;
    setSavingOrder(true);
    try {
      const res = await fetch(`${API_BASE}/api/oms/orders/${activeDetailOrder.order_id}/update`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_id: editOrderId,
          tracking_number: editTrackingNumber,
          shipping_status: editShippingStatus,
          email_sent: editEmailSent,
          customer_name: editCustomerName,
          customer_email: editCustomerEmail,
          customer_address: editCustomerAddress,
        }),
      });
      if (res.ok) {
        setActiveDetailOrder(null);
        loadOrders();
      } else {
        alert("Failed to save order details.");
      }
    } catch (err) {
      console.error(err);
      alert("Network error updating order.");
    } finally {
      setSavingOrder(false);
    }
  };

  const handleSendQuickReply = async (ticketId: number) => {
    if (!quickReplyText.trim()) return;
    setSendingReply(true);
    try {
      const res = await fetch(`${API_BASE}/api/oms/tickets/${ticketId}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: quickReplyText,
          status: replyStatus,
        }),
      });
      if (res.ok) {
        setQuickReplyText("");
        setEditEmailSent(true); // Flag email as sent in UI
        if (activeDetailOrder) {
          loadCustomerProfile(activeDetailOrder.customer_email);
        }
      } else {
        alert("Failed to send support reply.");
      }
    } catch (err) {
      console.error(err);
      alert("Error sending reply.");
    } finally {
      setSendingReply(false);
    }
  };

  const handleDeleteOrder = async () => {
    if (!activeDetailOrder) return;
    if (!window.confirm(`Are you sure you want to delete order ${activeDetailOrder.order_id}? This action cannot be undone.`)) {
      return;
    }
    setDeletingOrder(true);
    try {
      const res = await fetch(`${API_BASE}/api/oms/orders/${encodeURIComponent(activeDetailOrder.order_id)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setActiveDetailOrder(null);
        setSelectedOrderIds(prev => prev.filter(id => id !== activeDetailOrder.order_id));
        loadOrders();
      } else {
        alert("Failed to delete order.");
      }
    } catch (err) {
      console.error(err);
      alert("Network error deleting order.");
    } finally {
      setDeletingOrder(false);
    }
  };

  const handleResendOrder = async (orderId: string) => {
    if (!orderId) return;
    if (!window.confirm(`Are you sure you want to create a Resend order for ${orderId}?`)) {
      return;
    }
    setResending(true);
    try {
      const res = await fetch(`${API_BASE}/api/oms/orders/${encodeURIComponent(orderId)}/resend`, {
        method: "POST",
      });
      if (res.ok) {
        const data = await res.json();
        alert(`Resend order created successfully: ${data.new_order_id}`);
        setActiveDetailOrder(null);
        setSelectedOrderIds([]);
        loadOrders();
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(errData.detail || "Failed to create resend order.");
      }
    } catch (err) {
      console.error(err);
      alert("Network error creating resend order.");
    } finally {
      setResending(false);
    }
  };

  const handleResendSelectedOrders = async () => {
    if (selectedOrderIds.length === 0) {
      alert("Please select at least one order to resend.");
      return;
    }
    if (!window.confirm(`Are you sure you want to create Resend orders for the ${selectedOrderIds.length} selected order(s)?`)) {
      return;
    }
    setResending(true);
    let successCount = 0;
    let failedCount = 0;
    for (const oid of selectedOrderIds) {
      try {
        const res = await fetch(`${API_BASE}/api/oms/orders/${encodeURIComponent(oid)}/resend`, {
          method: "POST",
        });
        if (res.ok) {
          successCount++;
        } else {
          failedCount++;
        }
      } catch (err) {
        console.error(err);
        failedCount++;
      }
    }
    alert(`Resend completed. Success: ${successCount}, Failed: ${failedCount}`);
    setSelectedOrderIds([]);
    loadOrders();
    setResending(false);
  };

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
          revenue: o.revenue,
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
    return Object.values(groups).sort((a, b) => {
      const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return dateB - dateA;
    });
  };

  const groupedOrders = getGroupedOrders();

  // Fetch orders
  const loadOrders = async () => {
    setLoading(true);
    setSyncNotice(null);
    try {
      const params = new URLSearchParams();
      if (search) {
        params.append("search", search);
        params.append("search_field", searchField);
      }
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

  // Date Preset calculation logic
  const handlePresetRangeChange = (preset: string) => {
    setPresetRange(preset);
    if (preset === "custom") {
      return;
    }

    const now = new Date();
    let start = "";
    let end = "";

    const formatDate = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    };

    if (preset === "today") {
      start = formatDate(now);
      end = formatDate(now);
    } else if (preset === "yesterday") {
      const yesterday = new Date();
      yesterday.setDate(now.getDate() - 1);
      start = formatDate(yesterday);
      end = formatDate(yesterday);
    } else if (preset === "this_month") {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      start = formatDate(firstDay);
      end = formatDate(now);
    } else if (preset === "last_month") {
      const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastDayLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
      start = formatDate(firstDayLastMonth);
      end = formatDate(lastDayLastMonth);
    } else {
      // all time
      start = "";
      end = "";
    }

    setStartDate(start);
    setEndDate(end);
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
          <button
            onClick={handleResendSelectedOrders}
            disabled={resending || selectedOrderIds.length === 0}
            className="btn btn-secondary"
            style={{ display: "inline-flex", alignItems: "center", gap: "6px", border: "1px solid var(--accent)", color: "var(--accent)", background: "var(--accent-light)" }}
          >
            {resending ? "🔄 Resending..." : "🔄 Resend Order"}
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
        
        {/* Granular Search Category Field */}
        <div style={{ flex: "2 1 350px" }}>
          <label style={{ fontSize: "11px", fontWeight: "bold", color: "var(--text-secondary)", display: "block", marginBottom: "4px" }}>SEARCH CATEGORY & INPUT</label>
          <div style={{ display: "flex", width: "100%", border: "1px solid var(--border-default)", borderRadius: "6px", overflow: "hidden", background: "white" }}>
            <select
              value={searchField}
              onChange={(e) => setSearchField(e.target.value)}
              style={{ padding: "8px 12px", border: "none", borderRight: "1px solid var(--border-default)", outline: "none", background: "var(--bg-secondary)", height: "38px", width: "150px", fontSize: "13px", fontWeight: "500", color: "var(--text-primary)" }}
            >
              <option value="all">🔍 All Fields</option>
              <option value="order_id">🏷️ Order ID</option>
              <option value="customer_name">👥 Customer Name</option>
              <option value="customer_email">✉️ Email</option>
              <option value="product_name">🎽 Product Name</option>
            </select>
            <input
              type="text"
              placeholder={`Type query to search...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              style={{ flex: 1, padding: "8px 12px", border: "none", outline: "none", height: "38px", fontSize: "14px" }}
            />
          </div>
        </div>
        
        {/* Date Range Preset Dropdown */}
        <div style={{ flex: "1 1 150px" }}>
          <label style={{ fontSize: "11px", fontWeight: "bold", color: "var(--text-secondary)", display: "block", marginBottom: "4px" }}>CALENDAR PRESETS</label>
          <select
            value={presetRange}
            onChange={(e) => handlePresetRangeChange(e.target.value)}
            style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--border-default)", borderRadius: "6px", background: "white", height: "40px", fontSize: "14px", fontWeight: "500" }}
          >
            <option value="all">📅 All Time</option>
            <option value="today">☀️ Today</option>
            <option value="yesterday">🌙 Yesterday</option>
            <option value="this_month">📅 This Month</option>
            <option value="last_month">📅 Last Month</option>
            <option value="custom">⚙️ Custom Range</option>
          </select>
        </div>

        {/* Date Range manual inputs - only displayed or active for custom dates */}
        {(presetRange === "custom" || startDate || endDate) && (
          <>
            <div style={{ flex: "1 1 130px" }}>
              <label style={{ fontSize: "11px", fontWeight: "bold", color: "var(--text-secondary)", display: "block", marginBottom: "4px" }}>START DATE</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--border-default)", borderRadius: "6px", height: "40px" }}
              />
            </div>
            <div style={{ flex: "1 1 130px" }}>
              <label style={{ fontSize: "11px", fontWeight: "bold", color: "var(--text-secondary)", display: "block", marginBottom: "4px" }}>END DATE</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--border-default)", borderRadius: "6px", height: "40px" }}
              />
            </div>
          </>
        )}

        <div>
          <label style={{ fontSize: "11px", fontWeight: "bold", color: "var(--text-secondary)", display: "block", marginBottom: "4px" }}>PLATFORM STORE</label>
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
            style={{ padding: "8px 12px", border: "1px solid var(--border-default)", borderRadius: "6px", background: "white", height: "40px", width: "140px" }}
          >
            <option value="">All Stores</option>
            <option value="woo">WooCommerce</option>
            <option value="sb">ShopBase</option>
            <option value="astro">Astro</option>
          </select>
        </div>

        <div>
          <label style={{ fontSize: "11px", fontWeight: "bold", color: "var(--text-secondary)", display: "block", marginBottom: "4px" }}>SHIPPING STATUS</label>
          <select
            value={shippingStatus}
            onChange={(e) => setShippingStatus(e.target.value)}
            style={{ padding: "8px 12px", border: "1px solid var(--border-default)", borderRadius: "6px", background: "white", height: "40px", width: "140px" }}
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
            🔍 Search
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
          <p style={{ color: "var(--text-muted)", margin: "6px 0 20px 0", fontSize: "13px" }}>Check your category search or calendar range.</p>
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
                <th style={{ padding: "14px 12px", textAlign: "center", width: "110px" }}>Created At</th>
                <th style={{ padding: "14px 12px", textAlign: "left" }}>Order ID</th>
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

                const itemsCount = order.items.length;

                return (
                  <tr 
                    key={order.order_id} 
                    onClick={() => openOrderDetails(order)}
                    style={{ 
                      borderBottom: "1px solid var(--border-default)", 
                      background: isSelected ? "var(--bg-tertiary)" : "white",
                      cursor: "pointer",
                      transition: "background 0.2s"
                    }}
                  >
                    <td style={{ padding: "12px", textAlign: "center", verticalAlign: "middle" }} onClick={(e) => e.stopPropagation()}>
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
                    {/* Created At */}
                    <td style={{ padding: "12px", fontSize: "12px", color: "var(--text-primary)", textAlign: "center", verticalAlign: "middle", fontWeight: "500" }}>
                      {formatCreatedDate(order.created_at)}
                    </td>
                    {/* Order ID */}
                    <td style={{ padding: "12px", color: "var(--text-primary)", verticalAlign: "middle" }}>{order.order_id}</td>
                    {/* Customer Name */}
                    <td style={{ padding: "12px", fontWeight: "500", color: "var(--text-primary)", verticalAlign: "middle" }}>{order.customer_name}</td>
                    {/* Customer Addr */}
                    <td style={{ padding: "12px", fontSize: "12px", color: "var(--text-secondary)", maxWidth: "240px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", verticalAlign: "middle" }} title={order.customer_address}>
                      {order.customer_address}
                    </td>
                    {/* Email */}
                    <td style={{ padding: "12px", fontSize: "12px", color: "var(--text-secondary)", verticalAlign: "middle" }}>{order.customer_email}</td>
                    
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
                    
                    {/* Revenue */}
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

      {/* ── Grouped Order Detail & Customer CRM Modal ── */}
      {activeDetailOrder !== null && (
        <div 
          className="upload-modal-overlay" 
          onClick={() => setActiveDetailOrder(null)}
          style={{ 
            position: "fixed", 
            top: 0, 
            left: 0, 
            right: 0, 
            bottom: 0, 
            background: "rgba(15, 23, 42, 0.6)", 
            backdropFilter: "blur(4px)",
            display: "flex", 
            alignItems: "center", 
            justifyContent: "center", 
            zIndex: 1100 
          }}
        >
          <div 
            className="upload-modal" 
            onClick={(e) => e.stopPropagation()} 
            style={{ 
              width: "90%", 
              maxWidth: "1100px", 
              height: "85vh", 
              maxHeight: "800px",
              display: "flex", 
              flexDirection: "column",
              borderRadius: "16px",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)"
            }}
          >
            {/* Modal Header */}
            <div className="upload-modal-header" style={{ padding: "16px 24px", borderBottom: "1px solid var(--border-default)" }}>
              <div className="upload-modal-title" style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "18px", fontWeight: "bold" }}>
                <span>📦 Order Logistics & CRM:</span>
                <span style={{ color: "var(--accent)" }}>{activeDetailOrder.order_id}</span>
                <span className="badge badge-info" style={{ fontSize: "11px", padding: "4px 8px" }}>
                  {activeDetailOrder.store_id.replace(" WooCommerce", "").replace(" ShopBase", "")}
                </span>
              </div>
              <button className="upload-modal-close" onClick={() => setActiveDetailOrder(null)} style={{ fontSize: "20px" }}>✕</button>
            </div>

            {/* Split View Body */}
            <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
              {/* LEFT COLUMN: Logistics Inputs & Product details */}
              <div style={{ flex: 1, padding: "24px", overflowY: "auto", borderRight: "1px solid var(--border-default)", display: "flex", flexDirection: "column", gap: "16px" }}>
                
                {/* Section 1: Customer Details */}
                <div>
                  <h3 style={{ fontSize: "13px", fontWeight: "bold", textTransform: "uppercase", color: "var(--text-secondary)", marginBottom: "12px", letterSpacing: "0.5px" }}>
                    👤 Customer Information
                  </h3>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: "11px", fontWeight: "bold" }}>Customer Name</label>
                      <input 
                        className="input" 
                        value={editCustomerName} 
                        onChange={(e) => setEditCustomerName(e.target.value)} 
                        style={{ height: "36px", fontSize: "13px" }}
                      />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: "11px", fontWeight: "bold" }}>Customer Email</label>
                      <input 
                        className="input" 
                        value={editCustomerEmail} 
                        onChange={(e) => setEditCustomerEmail(e.target.value)} 
                        style={{ height: "36px", fontSize: "13px" }}
                      />
                    </div>
                  </div>
                  <div className="form-group" style={{ marginTop: "12px", marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: "11px", fontWeight: "bold" }}>Shipping Address</label>
                    <textarea 
                      className="input" 
                      value={editCustomerAddress} 
                      onChange={(e) => setEditCustomerAddress(e.target.value)} 
                      style={{ minHeight: "60px", padding: "8px", fontSize: "13px", resize: "none" }}
                    />
                  </div>
                </div>

                <hr style={{ border: 0, borderTop: "1px solid var(--border-default)", margin: "4px 0" }} />

                {/* Section 2: Logistics Info */}
                <div>
                  <h3 style={{ fontSize: "13px", fontWeight: "bold", textTransform: "uppercase", color: "var(--text-secondary)", marginBottom: "12px", letterSpacing: "0.5px" }}>
                    🚚 Shipping & Fulfillment
                  </h3>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: "11px", fontWeight: "bold" }}>Transaction / Order ID</label>
                      <input 
                        className="input" 
                        value={editOrderId} 
                        onChange={(e) => setEditOrderId(e.target.value)} 
                        style={{ height: "36px", fontSize: "13px" }}
                      />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: "11px", fontWeight: "bold" }}>Tracking Number</label>
                      <input 
                        className="input" 
                        placeholder="Awaiting carrier number..."
                        value={editTrackingNumber} 
                        onChange={(e) => setEditTrackingNumber(e.target.value)} 
                        style={{ height: "36px", fontSize: "13px" }}
                      />
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginTop: "12px" }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: "11px", fontWeight: "bold" }}>Logistics Status</label>
                      <select 
                        className="input" 
                        value={editShippingStatus} 
                        onChange={(e) => setEditShippingStatus(e.target.value)}
                        style={{ height: "36px", fontSize: "13px", background: "white" }}
                      >
                        <option value="placed">Placed</option>
                        <option value="in transit">In Transit</option>
                        <option value="delivered">Delivered</option>
                        <option value="incident">Incident</option>
                      </select>
                    </div>

                    <div className="form-group" style={{ margin: 0, display: "flex", flexDirection: "column", justifyContent: "center" }}>
                      <label className="form-label" style={{ fontSize: "11px", fontWeight: "bold", marginBottom: "6px" }}>Email Sent Status</label>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <input 
                          type="checkbox" 
                          id="editEmailSent"
                          checked={editEmailSent} 
                          onChange={(e) => setEditEmailSent(e.target.checked)}
                          style={{ width: "18px", height: "18px", cursor: "pointer" }}
                        />
                        <label htmlFor="editEmailSent" style={{ fontSize: "13px", color: "var(--text-primary)", cursor: "pointer", fontWeight: "500" }}>
                          {editEmailSent ? "✔️ Logistics email sent" : "❌ Awaiting CRM reply"}
                        </label>
                      </div>
                    </div>
                  </div>
                </div>

                <hr style={{ border: 0, borderTop: "1px solid var(--border-default)", margin: "4px 0" }} />

                {/* Section 3: Ordered Products */}
                <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: "150px" }}>
                  <h3 style={{ fontSize: "13px", fontWeight: "bold", textTransform: "uppercase", color: "var(--text-secondary)", marginBottom: "8px", letterSpacing: "0.5px" }}>
                    🎽 Ordered Products details
                  </h3>
                  <div style={{ flex: 1, overflowY: "auto", background: "var(--bg-secondary)", borderRadius: "8px", border: "1px solid var(--border-default)", padding: "10px" }}>
                    {activeDetailOrder.items.map((item, idx) => (
                      <div 
                        key={item.id} 
                        style={{ 
                          display: "flex", 
                          gap: "12px", 
                          padding: "10px 0", 
                          borderBottom: idx < activeDetailOrder.items.length - 1 ? "1px solid var(--border-default)" : "none",
                          alignItems: "center"
                        }}
                      >
                        {item.product_image ? (
                          <img 
                            src={item.product_image} 
                            alt="" 
                            style={{ width: "42px", height: "42px", borderRadius: "6px", objectFit: "cover", border: "1px solid var(--border-default)" }}
                          />
                        ) : (
                          <div style={{ width: "42px", height: "42px", borderRadius: "6px", background: "var(--bg-tertiary)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px" }}>🎽</div>
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: "13px", fontWeight: "bold", color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={item.product_name}>
                            {item.product_name}
                          </div>
                          <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "2px", display: "flex", gap: "8px" }}>
                            <span>Size: <strong>{item.variant_value || "—"}</strong></span>
                            {item.variant && <span>Options: <strong>{item.variant}</strong></span>}
                          </div>
                        </div>
                        <div style={{ textAlign: "right", fontSize: "13px" }}>
                          <div style={{ fontWeight: "bold", color: "var(--text-primary)" }}>x{item.quantity}</div>
                          <div style={{ color: "var(--text-muted)", fontSize: "11px", marginTop: "2px" }}>${item.cost.toFixed(2)} cost</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>

              {/* RIGHT COLUMN: Conversation logs */}
              <div style={{ flex: 1.1, padding: "24px", background: "var(--bg-secondary)", display: "flex", flexDirection: "column" }}>
                <h3 style={{ fontSize: "13px", fontWeight: "bold", textTransform: "uppercase", color: "var(--text-secondary)", marginBottom: "12px", letterSpacing: "0.5px" }}>
                  💬 Freshdesk Email Conversation logs
                </h3>

                {loadingProfile ? (
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", color: "var(--text-secondary)" }}>
                    <div className="spinner" style={{ width: "28px", height: "28px", border: "3px solid var(--border-default)", borderTopColor: "var(--accent)", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
                    <p style={{ marginTop: "12px", fontSize: "13px" }}>Loading correspondence thread...</p>
                  </div>
                ) : !customerProfile || !customerProfile.tickets || customerProfile.tickets.length === 0 ? (
                  <div style={{ flex: 1, border: "1px dashed var(--border-default)", borderRadius: "10px", background: "white", padding: "32px", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", textAlign: "center" }}>
                    <span style={{ fontSize: "28px", marginBottom: "8px" }}>✉️</span>
                    <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "var(--text-secondary)" }}>No support threads found.</p>
                    <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "var(--text-muted)", maxWidth: "260px" }}>
                      This customer ({activeDetailOrder.customer_email}) hasn't raised any Freshdesk email requests.
                    </p>
                  </div>
                ) : (
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
                    {/* Message Feed */}
                    <div style={{ flex: 1, overflowY: "auto", background: "white", borderRadius: "10px", border: "1px solid var(--border-default)", padding: "16px", display: "flex", flexDirection: "column", gap: "16px", marginBottom: "16px" }}>
                      {customerProfile.tickets.map((ticket: any) => {
                        let repliesArray: string[] = [];
                        if (ticket.replies) {
                          try {
                            repliesArray = typeof ticket.replies === "string" ? JSON.parse(ticket.replies) : ticket.replies;
                          } catch (e) {
                            repliesArray = [];
                          }
                        }

                        return (
                          <div key={ticket.id} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                            {/* Original Ticket Post */}
                            <div style={{ alignSelf: "flex-start", background: "#f1f5f9", borderRadius: "12px 12px 12px 0px", padding: "12px 16px", maxWidth: "85%", border: "1px solid #e2e8f0" }}>
                              <div style={{ fontSize: "11px", fontWeight: "bold", color: "var(--text-secondary)", display: "flex", justifyContent: "space-between", gap: "16px" }}>
                                <span>📥 CUSTOMER INCOMING</span>
                                <span>{ticket.status.toUpperCase()}</span>
                              </div>
                              <div style={{ fontWeight: "bold", fontSize: "13px", color: "var(--text-primary)", marginBottom: "6px" }}>
                                {ticket.subject}
                              </div>
                              <div style={{ fontSize: "13px", color: "var(--text-primary)", whiteSpace: "pre-line" }}>
                                {ticket.message}
                              </div>
                              <div style={{ fontSize: "9px", color: "var(--text-muted)", textAlign: "right", marginTop: "6px" }}>
                                {formatTimelineDate(ticket.created_at)}
                              </div>
                            </div>

                            {/* Replies */}
                            {repliesArray.map((reply: string, rIdx: number) => (
                              <div 
                                key={rIdx} 
                                style={{ 
                                  alignSelf: "flex-end", 
                                  background: "#e0f2fe", 
                                  borderRadius: "12px 12px 0px 12px", 
                                  padding: "12px 16px", 
                                  maxWidth: "85%", 
                                  border: "1px solid #bae6fd" 
                                }}
                              >
                                <div style={{ fontSize: "11px", fontWeight: "bold", color: "#0369a1", marginBottom: "4px" }}>
                                  📤 JOT CRM REPLY (AGENT)
                                </div>
                                <div style={{ fontSize: "13px", color: "#0369a1", whiteSpace: "pre-line" }}>
                                  {reply}
                                </div>
                              </div>
                            ))}

                            {/* Quick Reply Form inside this ticket */}
                            {ticket.status !== "resolved" && (
                              <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: "12px", marginTop: "4px" }}>
                                <div style={{ display: "flex", gap: "8px" }}>
                                  <textarea 
                                    className="input" 
                                    placeholder="Type e-mail response instantly..."
                                    value={quickReplyText}
                                    onChange={(e) => setQuickReplyText(e.target.value)}
                                    style={{ flex: 1, minHeight: "50px", padding: "8px", fontSize: "12px", resize: "none", border: "1px solid #cbd5e1" }}
                                  />
                                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                                    <select 
                                      className="input" 
                                      value={replyStatus} 
                                      onChange={(e) => setReplyStatus(e.target.value)}
                                      style={{ height: "26px", padding: "2px 6px", fontSize: "11px", background: "white", width: "100px" }}
                                    >
                                      <option value="resolved">Resolved</option>
                                      <option value="pending">Pending</option>
                                      <option value="open">Open</option>
                                    </select>
                                    <button 
                                      className="btn btn-primary"
                                      disabled={sendingReply || !quickReplyText.trim()}
                                      onClick={() => handleSendQuickReply(ticket.id)}
                                      style={{ padding: "0 10px", height: "26px", fontSize: "11px", display: "flex", alignItems: "center", justifyContent: "center" }}
                                    >
                                      {sendingReply ? "..." : "Send"}
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="upload-modal-footer" style={{ padding: "16px 24px", borderTop: "1px solid var(--border-default)", background: "var(--bg-secondary)", borderRadius: "0 0 16px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <button 
                className="btn btn-danger" 
                onClick={handleDeleteOrder}
                disabled={deletingOrder}
                style={{ backgroundColor: "var(--error)", border: "none", color: "white", display: "inline-flex", alignItems: "center", gap: "6px" }}
              >
                {deletingOrder ? "Deleting..." : "🗑️ Delete Order"}
              </button>
              <div style={{ display: "flex", gap: "10px" }}>
                <button 
                  className="btn btn-secondary" 
                  onClick={() => handleResendOrder(activeDetailOrder.order_id)}
                  disabled={resending}
                  style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
                >
                  {resending ? "🔄 Resending..." : "🔄 Resend Order"}
                </button>
                <button className="btn btn-secondary" onClick={() => setActiveDetailOrder(null)}>Cancel</button>
                <button 
                  className="btn btn-primary" 
                  onClick={handleSaveOrderDetails}
                  disabled={savingOrder}
                  style={{ minWidth: "140px", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
                >
                  {savingOrder ? (
                    <>
                      <span className="upload-spinner" /> Saving...
                    </>
                  ) : (
                    "💾 Save Logistics"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
