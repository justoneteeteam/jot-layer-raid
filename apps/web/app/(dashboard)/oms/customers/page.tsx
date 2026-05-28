"use client";

import React, { useState, useEffect } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Customer {
  name: string;
  email: string;
  total_orders: number;
  total_spent: number;
  platform: string;
  address: string;
}

interface OrderHistory {
  id: number;
  store_id: string;
  order_id: string;
  order_name: string;
  product_name: string;
  revenue: number;
  shipping_status: string;
  created_at: string;
  tracking_number: string;
}

interface TicketHistory {
  id: number;
  subject: string;
  message: string;
  status: string;
  created_at: string;
}

interface CustomerProfile {
  name: string;
  email: string;
  address: string;
  platform: string;
  total_spent: number;
  orders: OrderHistory[];
  tickets: TicketHistory[];
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmail, setSelectedEmail] = useState<string | null>(null);
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  // Load customers list
  const loadCustomers = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/oms/customers`);
      if (res.ok) {
        const data = await res.json();
        setCustomers(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  // Load detailed profile
  const handleSelectCustomer = async (email: string) => {
    setSelectedEmail(email);
    setProfileLoading(true);
    setProfile(null);
    try {
      const res = await fetch(`${API_BASE}/api/oms/customers/${email}`);
      if (res.ok) {
        const data = await res.json();
        setProfile(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setProfileLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", gap: "24px", minHeight: "600px" }}>
      {/* Customers List Pane */}
      <div className="card" style={{ flex: 1, padding: "24px", background: "white" }}>
        <h2 style={{ fontSize: "20px", fontWeight: "bold", margin: "0 0 4px 0", color: "var(--text-primary)" }}>Customer CRM Directory</h2>
        <p style={{ margin: "0 0 20px 0", fontSize: "14px", color: "var(--text-secondary)" }}>
          Directory of all synced buyers with aggregate order quantities, total spent, and platform details.
        </p>

        {loading ? (
          <div style={{ padding: "40px", textAlign: "center", color: "var(--text-secondary)" }}>
            <div className="spinner" style={{ display: "inline-block", width: "24px", height: "24px", border: "3px solid #ccc", borderTopColor: "var(--accent)", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
            <p style={{ marginTop: "12px" }}>Loading buyer profiles...</p>
          </div>
        ) : customers.length === 0 ? (
          <div style={{ padding: "60px", textAlign: "center", border: "1px dashed var(--border-default)", borderRadius: "8px" }}>
            <p style={{ color: "var(--text-secondary)", margin: 0, fontSize: "14px" }}>No customer directories found.</p>
            <p style={{ color: "var(--text-muted)", margin: "4px 0 0 0", fontSize: "12px" }}>Import/Sync store orders to register profiles automatically.</p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="table" style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border-default)", textTransform: "uppercase", fontSize: "11px", fontWeight: "bold", color: "var(--text-secondary)" }}>
                  <th style={{ padding: "12px", textAlign: "left" }}>Customer</th>
                  <th style={{ padding: "12px", textAlign: "center" }}>Orders</th>
                  <th style={{ padding: "12px", textAlign: "right" }}>Total Spent</th>
                  <th style={{ padding: "12px", textAlign: "left" }}>Default Platform</th>
                  <th style={{ padding: "12px", textAlign: "left" }}>Shipping Address</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr
                    key={c.email}
                    onClick={() => handleSelectCustomer(c.email)}
                    style={{
                      borderBottom: "1px solid var(--border-default)",
                      cursor: "pointer",
                      background: selectedEmail === c.email ? "var(--bg-tertiary)" : "white",
                      transition: "background 0.15s ease"
                    }}
                    onMouseEnter={(e) => { if (selectedEmail !== c.email) e.currentTarget.style.background = "var(--bg-secondary)"; }}
                    onMouseLeave={(e) => { if (selectedEmail !== c.email) e.currentTarget.style.background = "white"; }}
                  >
                    <td style={{ padding: "12px" }}>
                      <div style={{ fontWeight: "bold", color: "var(--text-primary)" }}>{c.name}</div>
                      <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>{c.email}</div>
                    </td>
                    <td style={{ padding: "12px", textAlign: "center", fontWeight: "bold", color: "var(--text-primary)" }}>{c.total_orders}</td>
                    <td style={{ padding: "12px", textAlign: "right", fontWeight: "bold", color: "var(--accent)" }}>${c.total_spent.toFixed(2)}</td>
                    <td style={{ padding: "12px" }}>
                      <span style={{ fontSize: "11px", textTransform: "uppercase", fontWeight: "bold", padding: "2px 6px", borderRadius: "4px", background: "var(--accent-light)", color: "var(--accent)" }}>{c.platform}</span>
                    </td>
                    <td style={{ padding: "12px", fontSize: "13px", color: "var(--text-secondary)", maxWidth: "250px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.address}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Customer Profile Side Drawer Pane */}
      {selectedEmail && (
        <div className="card" style={{ width: "420px", padding: "24px", background: "white", display: "flex", flexDirection: "column", gap: "20px", borderLeft: "2px solid var(--accent)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-default)", paddingBottom: "12px" }}>
            <h3 style={{ fontSize: "16px", fontWeight: "bold", margin: 0, color: "var(--text-primary)" }}>Buyer Profile Details</h3>
            <button onClick={() => setSelectedEmail(null)} style={{ border: "none", background: "none", fontSize: "18px", cursor: "pointer" }}>✖️</button>
          </div>

          {profileLoading ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, color: "var(--text-secondary)" }}>
              <div className="spinner" style={{ display: "inline-block", width: "20px", height: "20px", border: "2px solid #ccc", borderTopColor: "var(--accent)", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
              <p style={{ marginTop: "12px", fontSize: "13px" }}>Loading detail cards...</p>
            </div>
          ) : profile ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px", flex: 1, overflowY: "auto" }}>
              {/* Header Info */}
              <div style={{ background: "var(--bg-secondary)", padding: "16px", borderRadius: "8px", border: "1px solid var(--border-default)" }}>
                <h4 style={{ margin: 0, fontSize: "18px", color: "var(--text-primary)" }}>{profile.name}</h4>
                <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "4px" }}>{profile.email}</div>
                <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "4px", borderTop: "1px solid var(--border-default)", paddingTop: "8px" }}>
                  📍 <strong>Default Address:</strong> {profile.address}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: "12px", fontSize: "13px", fontWeight: "bold" }}>
                  <span>Total Spent:</span>
                  <span style={{ color: "var(--accent)" }}>${profile.total_spent.toFixed(2)}</span>
                </div>
              </div>

              {/* Order History list */}
              <div>
                <h4 style={{ fontSize: "13px", fontWeight: "bold", textTransform: "uppercase", color: "var(--text-secondary)", margin: "0 0 8px 0" }}>Order History ({profile.orders.length})</h4>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {profile.orders.map((o) => (
                    <div key={o.id} style={{ border: "1px solid var(--border-default)", borderRadius: "6px", padding: "10px", background: "white" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold", fontSize: "13px", color: "var(--text-primary)" }}>
                        <span>Order {o.order_id} ({o.order_name})</span>
                        <span>${o.revenue.toFixed(2)}</span>
                      </div>
                      <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "4px" }}>{o.product_name}</div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "8px", fontSize: "11px" }}>
                        <span style={{ color: "var(--accent)", fontWeight: "bold" }}>
                          🏢 {o.store_id}
                        </span>
                        <span style={{ color: o.shipping_status === "delivered" ? "var(--success)" : o.shipping_status === "in transit" ? "var(--info)" : "var(--warning)", fontWeight: "bold" }}>
                          📦 {o.shipping_status.toUpperCase()}
                        </span>
                      </div>
                      {o.tracking_number && (
                        <div style={{ fontSize: "11px", background: "var(--bg-secondary)", padding: "4px 8px", borderRadius: "4px", marginTop: "6px", fontFamily: "monospace", color: "var(--success)" }}>
                          🚚 {o.tracking_number}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Support Tickets list */}
              <div>
                <h4 style={{ fontSize: "13px", fontWeight: "bold", textTransform: "uppercase", color: "var(--text-secondary)", margin: "0 0 8px 0" }}>CRM Ticket History ({profile.tickets.length})</h4>
                {profile.tickets.length === 0 ? (
                  <p style={{ margin: 0, fontSize: "12px", color: "var(--text-muted)", fontStyle: "italic" }}>No email ticket correspondence.</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {profile.tickets.map((t) => (
                      <div key={t.id} style={{ border: "1px solid var(--border-default)", borderRadius: "6px", padding: "10px", background: "white" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontWeight: "bold", fontSize: "12px", color: "var(--text-primary)" }}>{t.subject}</span>
                          <span style={{ fontSize: "10px", fontWeight: "bold", textTransform: "uppercase", padding: "1px 6px", borderRadius: "999px", background: t.status === "open" ? "#fee2e2" : "#d1fae5", color: t.status === "open" ? "#991b1b" : "#065f46" }}>
                            {t.status}
                          </span>
                        </div>
                        <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{t.message}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <p style={{ color: "var(--text-muted)", fontSize: "12px" }}>No profile selected.</p>
          )}
        </div>
      )}
    </div>
  );
}
