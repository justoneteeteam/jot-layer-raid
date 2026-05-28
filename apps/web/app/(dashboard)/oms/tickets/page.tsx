"use client";

import React, { useState, useEffect } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Ticket {
  id: number;
  customer_name: string;
  customer_email: string;
  subject: string;
  message: string;
  status: string; // "open", "pending", "resolved"
  replies: string; // Serialized JSON string from DB
  created_at: string;
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
  variant: string;
}

interface CustomerProfile {
  name: string;
  email: string;
  address: string;
  platform: string;
  total_spent: number;
  orders: OrderHistory[];
}

export default function EmailTicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTicketId, setActiveTicketId] = useState<number | null>(null);
  
  // Right side CRM integration
  const [crmProfile, setCrmProfile] = useState<CustomerProfile | null>(null);
  const [crmLoading, setCrmLoading] = useState(false);
  
  // Reply box state
  const [replyText, setReplyText] = useState("");
  const [replying, setReplying] = useState(false);

  const activeTicket = tickets.find((t) => t.id === activeTicketId);

  // Load tickets list
  const loadTickets = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/oms/tickets`);
      if (res.ok) {
        const data = await res.json();
        setTickets(data);
        if (data.length > 0 && activeTicketId === null) {
          setActiveTicketId(data[0].id);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTickets();
  }, []);

  // Load customer CRM orders on ticket switch
  const loadCRMContext = async (email: string) => {
    setCrmLoading(true);
    setCrmProfile(null);
    try {
      const res = await fetch(`${API_BASE}/api/oms/customers/${email}`);
      if (res.ok) {
        const data = await res.json();
        setCrmProfile(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setCrmLoading(false);
    }
  };

  useEffect(() => {
    if (activeTicket) {
      loadCRMContext(activeTicket.customer_email);
    }
  }, [activeTicketId, tickets]);

  // Submit manual reply
  const handleSubmitReply = async (newStatus: string) => {
    if (!activeTicket || !replyText.trim()) return;
    setReplying(true);
    try {
      const res = await fetch(`${API_BASE}/api/oms/tickets/${activeTicket.id}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: newStatus,
          message: replyText
        }),
      });

      if (res.ok) {
        setReplyText("");
        alert(`Reply successfully submitted and status marked as ${newStatus}`);
        loadTickets(); // Refresh ticket thread and status
      } else {
        alert("Failed to send reply.");
      }
    } catch (err) {
      console.error(err);
      alert("Error contacting server.");
    } finally {
      setReplying(false);
    }
  };

  // Safe parse replies JSON
  const getTicketReplies = (ticket: Ticket): string[] => {
    if (!ticket.replies) return [];
    try {
      return JSON.parse(ticket.replies);
    } catch (e) {
      return [];
    }
  };

  // Auto-Reply rules classification helper
  const matchesAutoReplyRule = (ticket: Ticket): boolean => {
    const text = (ticket.subject + " " + ticket.message).toLowerCase();
    const keywords = ["shipping status", "tracking", "track", "status", "where is my order"];
    return keywords.some((kw) => text.includes(kw));
  };

  // Email Templates
  const handleSelectTemplate = (templateType: string) => {
    if (!crmProfile) {
      alert("Loading customer context first...");
      return;
    }
    const name = crmProfile.name;
    const order = crmProfile.orders[0];
    const orderId = order ? order.order_id : "#W6300";
    const tracking = order && order.tracking_number ? order.tracking_number : "Awaiting carrier scanning";
    
    let draft = "";
    if (templateType === "shipping") {
      draft = `Hi ${name},\n\nYour order ${orderId} has shipped! Here is your USPS carrier tracking number: ${tracking}.\n\nYou can track the package directly on 17track here:\nhttps://www.17track.net/en/track?nums=${order?.tracking_number || ""}\n\nBest regards,\nJOT Support Team`;
    } else if (templateType === "size") {
      draft = `Hi ${name},\n\nThank you for reaching out! We have successfully updated your order ${orderId} to size L as requested. The logistics details are synchronized.\n\nBest regards,\nJOT Support Team`;
    } else if (templateType === "general") {
      draft = `Hi ${name},\n\nThank you for your email! We are looking into your request regarding order ${orderId} and will follow up with details shortly.\n\nBest regards,\nJOT Support Team`;
    }
    
    setReplyText(draft);
  };

  return (
    <div style={{ display: "flex", gap: "20px", height: "calc(100vh - 130px)", minHeight: "650px", overflow: "hidden" }}>
      
      {/* 1. LEFT PANE: Conversation Tickets Feed */}
      <div className="card" style={{ width: "320px", padding: "16px", display: "flex", flexDirection: "column", background: "white", flexShrink: 0 }}>
        <div style={{ paddingBottom: "12px", borderBottom: "1px solid var(--border-default)", marginBottom: "12px" }}>
          <h3 style={{ fontSize: "16px", fontWeight: "bold", margin: 0, color: "var(--text-primary)" }}>Email Inbox</h3>
          <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "var(--text-secondary)" }}>Direct customer email threads</p>
        </div>

        {loading ? (
          <div style={{ padding: "40px", textAlign: "center", color: "var(--text-secondary)", flex: 1 }}>
            <div className="spinner" style={{ display: "inline-block", width: "20px", height: "20px", border: "2px solid #ccc", borderTopColor: "var(--accent)", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
            <p style={{ marginTop: "12px", fontSize: "12px" }}>Opening mailbox...</p>
          </div>
        ) : tickets.length === 0 ? (
          <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)", fontStyle: "italic", fontSize: "13px" }}>No emails available.</div>
        ) : (
          <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "8px" }}>
            {tickets.map((t) => {
              const isActive = activeTicketId === t.id;
              const isOpen = t.status === "open";
              const isResolved = t.status === "resolved";
              
              return (
                <div
                  key={t.id}
                  onClick={() => setActiveTicketId(t.id)}
                  style={{
                    padding: "12px",
                    borderRadius: "8px",
                    border: isActive ? "1px solid var(--accent)" : "1px solid var(--border-default)",
                    background: isActive ? "var(--accent-light)" : "var(--bg-secondary)",
                    cursor: "pointer",
                    transition: "all 0.15s ease"
                  }}
                  onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = "var(--bg-tertiary)"; }}
                  onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = "var(--bg-secondary)"; }}
                >
                  <div style={{ display: "flex", justifyItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                    <span style={{ fontSize: "11px", fontWeight: "bold", textTransform: "uppercase", color: "var(--text-secondary)", maxWidth: "160px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      👤 {t.customer_name}
                    </span>
                    <span
                      style={{
                        display: "inline-block",
                        width: "8px",
                        height: "8px",
                        borderRadius: "50%",
                        background: isOpen ? "var(--error)" : isResolved ? "var(--success)" : "var(--warning)"
                      }}
                      title={`Status: ${t.status}`}
                    />
                  </div>
                  <div style={{ fontSize: "13px", fontWeight: "bold", color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.subject}</div>
                  <p style={{ margin: "4px 0 0 0", fontSize: "11px", color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {t.message}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 2. MIDDLE PANE: Active Chat Thread Console */}
      <div className="card" style={{ flex: 1, padding: "20px", display: "flex", flexDirection: "column", background: "white" }}>
        {activeTicket ? (
          <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
            {/* Subject Banner */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-default)", paddingBottom: "12px", marginBottom: "12px" }}>
              <div>
                <h3 style={{ fontSize: "16px", fontWeight: "bold", color: "var(--text-primary)", margin: 0 }}>{activeTicket.subject}</h3>
                <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "2px" }}>
                  From: <strong>{activeTicket.customer_name}</strong> ({activeTicket.customer_email})
                </div>
              </div>
              <span
                style={{
                  padding: "3px 12px",
                  borderRadius: "999px",
                  fontSize: "11px",
                  fontWeight: "bold",
                  textTransform: "uppercase",
                  background: activeTicket.status === "open" ? "#fee2e2" : activeTicket.status === "resolved" ? "#d1fae5" : "#fef3c7",
                  color: activeTicket.status === "open" ? "#991b1b" : activeTicket.status === "resolved" ? "#065f46" : "#92400e"
                }}
              >
                {activeTicket.status}
              </span>
            </div>

            {/* AI Rules Classifier Alert Header Card */}
            {matchesAutoReplyRule(activeTicket) ? (
              <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", padding: "10px 12px", borderRadius: "8px", color: "#166534", fontSize: "13px", display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
                <span>🤖</span>
                <div>
                  <strong>AI Rule Match (Shipping status Inquiry)</strong>: Automatically scanned customer email matching 'tracking' keywords and instantly resolved with carrier update.
                </div>
              </div>
            ) : (
              <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-default)", padding: "10px 12px", borderRadius: "8px", color: "var(--text-secondary)", fontSize: "13px", display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
                <span>⏳</span>
                <div>
                  <strong>Awaiting Manual Reply</strong>: Keywords matching auto-replies not detected (Size/Custom Jersey update). Requires manual approval.
                </div>
              </div>
            )}

            {/* Conversation Messages */}
            <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "16px", paddingRight: "4px", marginBottom: "16px" }}>
              {/* Customer Initial Question Bubble */}
              <div style={{ alignSelf: "flex-start", maxWidth: "85%", background: "var(--bg-secondary)", border: "1px solid var(--border-default)", padding: "14px 16px", borderRadius: "12px 12px 12px 0", color: "var(--text-primary)", fontSize: "14px", lineHeight: "1.5", whiteSpace: "pre-line" }}>
                {activeTicket.message}
              </div>

              {/* Parsed replies thread */}
              {getTicketReplies(activeTicket).map((reply, i) => {
                const isAuto = reply.includes("[Instant AI Update]");
                return (
                  <div
                    key={i}
                    style={{
                      alignSelf: "flex-end",
                      maxWidth: "85%",
                      background: isAuto ? "#f0fdf4" : "var(--accent-light)",
                      border: isAuto ? "1px solid #bbf7d0" : "1px solid var(--accent)",
                      padding: "14px 16px",
                      borderRadius: "12px 12px 0 12px",
                      color: isAuto ? "#166534" : "var(--text-primary)",
                      fontSize: "14px",
                      lineHeight: "1.5",
                      whiteSpace: "pre-line"
                    }}
                  >
                    <div style={{ fontSize: "10px", color: isAuto ? "#166534" : "var(--accent)", fontWeight: "bold", marginBottom: "4px", textTransform: "uppercase" }}>
                      {isAuto ? "🤖 JOT Logistics AI Assistant" : "👤 Support Agent"}
                    </div>
                    {reply}
                  </div>
                );
              })}
            </div>

            {/* Reply Drafting Editor Box */}
            <div style={{ borderTop: "1px solid var(--border-default)", paddingTop: "12px", marginTop: "auto" }}>
              
              {/* Email Templates Selector Panel */}
              <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "10px", flexWrap: "wrap" }}>
                <span style={{ fontSize: "11px", fontWeight: "bold", color: "var(--text-secondary)", textTransform: "uppercase" }}>📄 Use Template:</span>
                <button
                  type="button"
                  onClick={() => handleSelectTemplate("shipping")}
                  style={{ padding: "4px 10px", background: "var(--bg-secondary)", border: "1px solid var(--border-default)", borderRadius: "12px", fontSize: "11px", cursor: "pointer", color: "var(--text-primary)", transition: "background 0.15s" }}
                  onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-tertiary)"}
                  onMouseLeave={(e) => e.currentTarget.style.background = "var(--bg-secondary)"}
                >
                  🚚 Shipping Status Update
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectTemplate("size")}
                  style={{ padding: "4px 10px", background: "var(--bg-secondary)", border: "1px solid var(--border-default)", borderRadius: "12px", fontSize: "11px", cursor: "pointer", color: "var(--text-primary)", transition: "background 0.15s" }}
                  onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-tertiary)"}
                  onMouseLeave={(e) => e.currentTarget.style.background = "var(--bg-secondary)"}
                >
                  🎽 Size Change Confirm
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectTemplate("general")}
                  style={{ padding: "4px 10px", background: "var(--bg-secondary)", border: "1px solid var(--border-default)", borderRadius: "12px", fontSize: "11px", cursor: "pointer", color: "var(--text-primary)", transition: "background 0.15s" }}
                  onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-tertiary)"}
                  onMouseLeave={(e) => e.currentTarget.style.background = "var(--bg-secondary)"}
                >
                  💬 General Support
                </button>
              </div>

              <textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder={`Draft your reply to ${activeTicket.customer_name}...`}
                style={{ width: "100%", height: "90px", padding: "12px", borderRadius: "8px", border: "1px solid var(--border-default)", background: "white", fontSize: "13px", resize: "none", marginBottom: "12px", fontFamily: "inherit" }}
              />
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                <button
                  onClick={() => handleSubmitReply("pending")}
                  disabled={replying || !replyText.trim()}
                  className="btn btn-secondary"
                  style={{ height: "38px" }}
                >
                  Send & Keep Open
                </button>
                <button
                  onClick={() => handleSubmitReply("resolved")}
                  disabled={replying || !replyText.trim()}
                  className="btn btn-primary"
                  style={{ height: "38px" }}
                >
                  {replying ? "Sending..." : "✔️ Send & Resolve Ticket"}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flex: 1, color: "var(--text-muted)", fontStyle: "italic" }}>
            Select an email conversation thread to reply.
          </div>
        )}
      </div>

      {/* 3. RIGHT PANE: Linked Buyer Order Details Hub */}
      <div className="card" style={{ width: "350px", padding: "20px", display: "flex", flexDirection: "column", background: "white", flexShrink: 0, overflowY: "auto" }}>
        <div style={{ paddingBottom: "12px", borderBottom: "1px solid var(--border-default)", marginBottom: "16px" }}>
          <h3 style={{ fontSize: "14px", fontWeight: "bold", margin: 0, color: "var(--text-primary)", textTransform: "uppercase" }}>Linked Store Orders</h3>
          <p style={{ margin: "2px 0 0 0", fontSize: "11px", color: "var(--text-secondary)" }}>Linked automatically via buyer email address</p>
        </div>

        {crmLoading ? (
          <div style={{ padding: "40px", textAlign: "center", color: "var(--text-secondary)", flex: 1 }}>
            <div className="spinner" style={{ display: "inline-block", width: "16px", height: "16px", border: "2px solid #ccc", borderTopColor: "var(--accent)", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
            <p style={{ marginTop: "12px", fontSize: "11px" }}>Linking customer orders...</p>
          </div>
        ) : crmProfile ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {/* Buyer lifetime statistics card */}
            <div style={{ background: "var(--bg-secondary)", padding: "12px", borderRadius: "8px", border: "1px solid var(--border-default)", fontSize: "12px" }}>
              <div style={{ fontWeight: "bold", fontSize: "14px", color: "var(--text-primary)" }}>{crmProfile.name}</div>
              <div style={{ color: "var(--text-secondary)", marginTop: "2px" }}>{crmProfile.email}</div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: "8px", fontWeight: "bold", borderTop: "1px dashed var(--border-default)", paddingTop: "8px" }}>
                <span>Lifetime spent:</span>
                <span style={{ color: "var(--accent)" }}>${crmProfile.total_spent.toFixed(2)}</span>
              </div>
            </div>

            {/* List of their orders */}
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {crmProfile.orders.length === 0 ? (
                <div style={{ fontSize: "12px", color: "var(--text-muted)", fontStyle: "italic", textAlign: "center", padding: "20px" }}>No orders exist for this email.</div>
              ) : (
                crmProfile.orders.map((o) => (
                  <div key={o.id} style={{ border: "1px solid var(--border-default)", borderRadius: "8px", padding: "12px", background: "white" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold", fontSize: "12px", color: "var(--text-primary)" }}>
                      <span>Order {o.order_id} ({o.order_name})</span>
                      <span>${o.revenue.toFixed(2)}</span>
                    </div>
                    <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "4px" }}>{o.product_name}</div>
                    <div style={{ fontSize: "10px", color: "var(--text-muted)", whiteSpace: "pre-line", margin: "6px 0", background: "var(--bg-secondary)", padding: "6px", borderRadius: "4px" }}>
                      {o.variant}
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "8px", fontSize: "11px" }}>
                      <span style={{ fontWeight: "bold", color: "var(--accent)" }}>
                        🏢 {o.store_id}
                      </span>
                      <span style={{ fontWeight: "bold", color: o.shipping_status === "delivered" ? "var(--success)" : o.shipping_status === "in transit" ? "var(--info)" : "var(--warning)" }}>
                        📦 {o.shipping_status.toUpperCase()}
                      </span>
                    </div>
                    {o.tracking_number ? (
                      <div style={{ fontSize: "11px", background: "#f0fdf4", padding: "6px 8px", borderRadius: "4px", marginTop: "8px", fontFamily: "monospace", color: "var(--success)", border: "1px solid #bbf7d0", fontWeight: "bold" }}>
                        🚚 {o.tracking_number}
                      </div>
                    ) : (
                      <div style={{ fontSize: "11px", color: "var(--text-muted)", fontStyle: "italic", marginTop: "8px" }}>
                        Awaiting carrier tracking number...
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        ) : (
          <div style={{ fontSize: "12px", color: "var(--text-muted)", fontStyle: "italic", textAlign: "center", padding: "20px" }}>No buyer profiles linked.</div>
        )}
      </div>

    </div>
  );
}
