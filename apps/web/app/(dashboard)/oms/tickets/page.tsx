"use client";

import React, { useState, useEffect } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Ticket {
  id: number;
  customer_name: string;
  customer_email: string;
  subject: string;
  message: string;
  status: string; // "open", "pending", "resolved", "spam", "snoozed"
  replies: string; // Serialized JSON string from DB
  recipient_email?: string; // Recognized inbound email
  tags?: string;
  snoozed_until?: string;
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

interface EmailSender {
  id: number;
  store_id: string;
  provider: string;
  from_name: string;
  from_email: string;
  domain: string;
  status: string;
}

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

const parseReply = (rawReply: string) => {
  let sender = "👤 Support Agent";
  let timestamp = "";
  let message = rawReply;
  let align = "flex-end";
  let bg = "#f0fdfa"; // Teal tint
  let border = "1px solid #ccfbf1";
  let textColor = "var(--text-primary)";
  let borderRadius = "12px 12px 0px 12px";

  if (rawReply.startsWith("[Customer Reply")) {
    sender = "👤 Customer";
    align = "flex-start";
    bg = "var(--bg-secondary)";
    border = "1px solid var(--border-default)";
    borderRadius = "12px 12px 12px 0px";
    
    const match = rawReply.match(/^\[Customer Reply\s*(?:\|\s*([^\]]+))?\]\s*([\s\S]*)/);
    if (match) {
      timestamp = match[1] || "";
      message = match[2] || "";
    }
  } else if (rawReply.startsWith("[Support Agent")) {
    sender = "👤 Support Agent";
    align = "flex-end";
    bg = "#eff6ff"; // Blue tint for manual support agent reply
    border = "1px solid #bfdbfe";
    borderRadius = "12px 12px 0px 12px";
    
    const match = rawReply.match(/^\[Support Agent\s*(?:\|\s*([^\]]+))?\]\s*([\s\S]*)/);
    if (match) {
      timestamp = match[1] || "";
      message = match[2] || "";
      
      // If it contains "via email@domain.com", extract or keep it in sender/timestamp
      if (timestamp && timestamp.includes("via ")) {
        const parts = timestamp.split("via ");
        const part0 = parts[0];
        const part1 = parts[1];
        if (part0 !== undefined && part1 !== undefined) {
          timestamp = part0.trim();
          sender = `👤 Support Agent (via ${part1.trim()})`;
        }
      }
    }
  } else if (rawReply.includes("[Instant AI Update]")) {
    sender = "🤖 JOT Logistics AI Assistant";
    align = "flex-end";
    bg = "#f0fdf4"; // Green tint for AI
    border = "1px solid #bbf7d0";
    textColor = "#166534";
    borderRadius = "12px 12px 0px 12px";
    message = rawReply.replace("[Instant AI Update]", "").trim();
  }

  return { sender, timestamp, message, align, bg, border, textColor, borderRadius };
};

// Detect and safely render HTML message bodies
const isHtmlContent = (text: string): boolean => {
  return /<(html|body|table|td|tr|p|div|span|br|img|a|ul|li|h[1-6])[\s>]/i.test(text);
};

const sanitizeHtml = (html: string): string => {
  // Remove tracking pixels (1x1 images from sendgrid, etc.)
  let clean = html.replace(/<img[^>]+(?:width=["']?1["']?[^>]*height=["']?1["']?|height=["']?1["']?[^>]*width=["']?1["']?)[^>]*>/gi, "");
  // Remove <script> and <style> tags
  clean = clean.replace(/<script[\s\S]*?<\/script>/gi, "");
  clean = clean.replace(/<style[\s\S]*?<\/style>/gi, "");
  // Remove tracking URLs embedded in <img src="..."> from known senders
  clean = clean.replace(/<img[^>]+src=["'][^"']*(?:sendgrid\.net|tracking|pixel|open|wf\/open)[^"']*["'][^>]*>/gi, "");
  return clean;
};

const MessageBody = ({ content }: { content: string }) => {
  if (isHtmlContent(content)) {
    return (
      <div
        className="html-message-body"
        style={{ fontSize: "13px", lineHeight: "1.6" }}
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(content) }}
      />
    );
  }
  return <span style={{ whiteSpace: "pre-line" }}>{content}</span>;
};

// Calculate time difference in hours to allocate SLA columns
const getHoursSinceCreated = (dateStr: string) => {
  if (!dateStr) return 0;
  const created = new Date(dateStr);
  const now = new Date();
  return (now.getTime() - created.getTime()) / (1000 * 60 * 60);
};

export default function ZohoTicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [senders, setSenders] = useState<EmailSender[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Dashboard configuration states
  const [activeTicketId, setActiveTicketId] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<"kanban" | "table">("kanban");
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"unresolved" | "resolved" | "all">("unresolved");
  const [searchQuery, setSearchQuery] = useState<string>("");
  
  // Right side CRM integration
  const [crmProfile, setCrmProfile] = useState<CustomerProfile | null>(null);
  const [crmLoading, setCrmLoading] = useState(false);
  
  // Reply box state
  const [replyText, setReplyText] = useState("");
  const [selectedFromEmail, setSelectedFromEmail] = useState("");
  const [replying, setReplying] = useState(false);

  // Manual ticket creation states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createCustomerEmail, setCreateCustomerEmail] = useState("");
  const [createCustomerName, setCreateCustomerName] = useState("");
  const [createSenderEmail, setCreateSenderEmail] = useState("");
  const [createSubject, setCreateSubject] = useState("");
  const [createMessage, setCreateMessage] = useState("");
  const [creatingTicket, setCreatingTicket] = useState(false);

  const activeTicket = tickets.find((t) => t.id === activeTicketId);

  // Fallback sender list if DB is empty
  const defaultSenders: EmailSender[] = [
    { id: -1, store_id: "WaiRaiders Store", provider: "cloudflare", from_name: "WaiRaiders Support", from_email: "contact@wairaiders.com", domain: "wairaiders.com", status: "active" },
    { id: -2, store_id: "Vulius Store", provider: "cloudflare", from_name: "Vulius Support", from_email: "contact@vulius.com", domain: "vulius.com", status: "active" },
    { id: -3, store_id: "JOT Support", provider: "cloudflare", from_name: "JOT Support", from_email: "customer@justonetee.org", domain: "justonetee.org", status: "active" }
  ];

  const getSenderList = () => {
    return senders.length > 0 ? senders : defaultSenders;
  };

  // Load tickets list
  const loadTickets = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/oms/tickets`);
      if (res.ok) {
        const data = await res.json();
        setTickets(data);
      }
    } catch (err) {
      console.error("Error loading tickets:", err);
    } finally {
      setLoading(false);
    }
  };

  // Load sender identities
  const loadSenders = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/marketing/senders`);
      if (res.ok) {
        const data = await res.json();
        setSenders(data);
      }
    } catch (err) {
      console.error("Error loading senders:", err);
    }
  };

  useEffect(() => {
    loadTickets();
    loadSenders();
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
      console.error("Error loading CRM context:", err);
    } finally {
      setCrmLoading(false);
    }
  };

  useEffect(() => {
    if (activeTicket) {
      loadCRMContext(activeTicket.customer_email);
    }
  }, [activeTicketId, tickets]);

  // Handle auto outbound sender routing selection
  useEffect(() => {
    if (activeTicket) {
      const recipient = (activeTicket.recipient_email || "").toLowerCase();
      const allSenders = getSenderList();
      
      // 1. Check if recipient matches a sender from_email
      let matched = allSenders.find((s) => recipient.includes(s.from_email.toLowerCase()) || s.from_email.toLowerCase().includes(recipient));
      
      // 2. If no direct email match, check store/domain match in recipient
      if (!matched && recipient) {
        matched = allSenders.find((s) => recipient.includes(s.domain.toLowerCase()));
      }
      
      // 3. Check order history brand match if still no match
      if (!matched && crmProfile && crmProfile.orders && crmProfile.orders.length > 0) {
        const firstOrder = crmProfile.orders[0];
        if (firstOrder) {
          const storeId = (firstOrder.store_id || "").toLowerCase();
          matched = allSenders.find((s) => storeId.includes(s.domain.toLowerCase()) || s.store_id.toLowerCase().includes(storeId));
        }
      }

      if (matched) {
        setSelectedFromEmail(matched.from_email);
      } else {
        setSelectedFromEmail(allSenders[0]?.from_email || "");
      }
    }
  }, [activeTicketId, crmProfile]);

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
          message: replyText,
          from_email: selectedFromEmail
        }),
      });

      if (res.ok) {
        setReplyText("");
        alert(`Reply successfully submitted and status marked as ${newStatus}`);
        loadTickets(); // Refresh ticket thread
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

  const handleUpdateStatus = async (status: string) => {
    if (!activeTicket) return;
    try {
      const res = await fetch(`${API_BASE}/api/oms/tickets/${activeTicket.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, snoozed_until: null }),
      });
      if (res.ok) {
        loadTickets();
        alert(`Ticket marked as ${status}`);
      } else {
        alert("Failed to update status.");
      }
    } catch (err) {
      console.error(err);
      alert("Error updating status.");
    }
  };

  const handleSnoozeTicket = async () => {
    if (!activeTicket) return;
    const snoozeTime = new Date();
    snoozeTime.setHours(snoozeTime.getHours() + 24);
    try {
      const res = await fetch(`${API_BASE}/api/oms/tickets/${activeTicket.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "snoozed",
          snoozed_until: snoozeTime.toISOString()
        }),
      });
      if (res.ok) {
        loadTickets();
        alert("Ticket snoozed for 24 hours.");
      } else {
        alert("Failed to snooze ticket.");
      }
    } catch (err) {
      console.error(err);
      alert("Error snoozing ticket.");
    }
  };

  const handleToggleSpam = async () => {
    if (!activeTicket) return;
    const isSpam = activeTicket.tags?.includes("spam");
    const newTags = isSpam ? "" : "spam";
    try {
      const res = await fetch(`${API_BASE}/api/oms/tickets/${activeTicket.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags: newTags }),
      });
      if (res.ok) {
        loadTickets();
        alert(isSpam ? "Spam tag removed" : "Ticket tagged as Spam");
      } else {
        alert("Failed to toggle spam tag.");
      }
    } catch (err) {
      console.error(err);
      alert("Error toggling spam tag.");
    }
  };

  const resetCreateFields = () => {
    setCreateCustomerEmail("");
    setCreateCustomerName("");
    setCreateSenderEmail("");
    setCreateSubject("");
    setCreateMessage("");
  };

  const handleCreateTicket = async () => {
    if (!createCustomerEmail.trim() || !createCustomerName.trim() || !createSenderEmail.trim() || !createSubject.trim() || !createMessage.trim()) {
      alert("Please fill out all fields.");
      return;
    }
    if (!createCustomerEmail.includes("@")) {
      alert("Please enter a valid customer email.");
      return;
    }

    setCreatingTicket(true);
    try {
      const res = await fetch(`${API_BASE}/api/oms/tickets/new`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_email: createCustomerEmail.trim(),
          customer_name: createCustomerName.trim(),
          recipient_email: createSenderEmail.trim(),
          subject: createSubject.trim(),
          message: createMessage.trim()
        }),
      });

      if (res.ok) {
        alert("Manual ticket created and initial email dispatched successfully!");
        setShowCreateModal(false);
        resetCreateFields();
        loadTickets(); // Refresh dashboard
      } else {
        const err = await res.json();
        alert(`Failed to create ticket: ${err.error || "Unknown error"}`);
      }
    } catch (e) {
      console.error(e);
      alert("Error creating ticket.");
    } finally {
      setCreatingTicket(false);
    }
  };

  const getTicketReplies = (ticket: Ticket): string[] => {
    if (!ticket.replies) return [];
    try {
      return JSON.parse(ticket.replies);
    } catch (e) {
      return [];
    }
  };

  const matchesAutoReplyRule = (ticket: Ticket): boolean => {
    const text = (ticket.subject + " " + ticket.message).toLowerCase();
    const keywords = ["shipping status", "tracking", "track", "status", "where is my order"];
    return keywords.some((kw) => text.includes(kw));
  };

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
      draft = `Hi ${name},\n\nYour order ${orderId} has shipped! Here is your USPS carrier tracking number: ${tracking}.\n\nYou can track the package directly on 17track here:\nhttps://www.17track.net/en/track?nums=${order?.tracking_number || ""}\n\nBest regards,\nSupport Team`;
    } else if (templateType === "size") {
      draft = `Hi ${name},\n\nThank you for reaching out! We have successfully updated your order ${orderId} to size L as requested. The logistics details are synchronized.\n\nBest regards,\nSupport Team`;
    } else if (templateType === "general") {
      draft = `Hi ${name},\n\nThank you for your email! We are looking into your request regarding order ${orderId} and will follow up with details shortly.\n\nBest regards,\nSupport Team`;
    }
    
    setReplyText(draft);
  };

  // Filter Tickets
  const getFilteredTickets = () => {
    return tickets.filter((t) => {
      // 1. Search Query filter
      const textMatch = 
        t.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.customer_email.toLowerCase().includes(searchQuery.toLowerCase());
      
      if (!textMatch) return false;

      // 2. Spam filter
      const isSpam = t.tags?.includes("spam");
      if (activeFilter === "spam") {
        if (!isSpam) return false;
      } else {
        if (isSpam) return false; // Hide spam by default from other views
      }

      // 3. Active Sidebar filter
      const rec = (t.recipient_email || "").toLowerCase();
      const hours = getHoursSinceCreated(t.created_at);

      let matchesSidebar = true;
      if (activeFilter === "wairaiders") {
        matchesSidebar = rec.includes("wairaiders");
      } else if (activeFilter === "vulius") {
        matchesSidebar = rec.includes("vulius");
      } else if (activeFilter === "other") {
        matchesSidebar = rec !== "" && !rec.includes("wairaiders") && !rec.includes("vulius");
      } else if (activeFilter === "overdue") {
        matchesSidebar = t.status === "open" && hours >= 24;
      } else if (activeFilter === "due6h") {
        matchesSidebar = t.status === "open" && hours >= 18 && hours < 24;
      } else if (activeFilter === "due12h") {
        matchesSidebar = t.status === "open" && hours < 18;
      } else if (activeFilter === "open") {
        matchesSidebar = t.status === "open";
      } else if (activeFilter === "pending") {
        matchesSidebar = t.status === "pending";
      } else if (activeFilter === "resolved") {
        matchesSidebar = t.status === "resolved";
      } else if (activeFilter === "snoozed") {
        matchesSidebar = t.status === "snoozed";
      }

      if (!matchesSidebar) return false;

      // 4. Status sub-filter
      const isStatusSpecificFilter = ["open", "pending", "resolved", "snoozed", "spam", "overdue", "due6h", "due12h"].includes(activeFilter);
      if (!isStatusSpecificFilter) {
        if (t.status === "snoozed") return false;
        if (statusFilter === "unresolved") {
          return t.status === "open" || t.status === "pending";
        }
        if (statusFilter === "resolved") {
          return t.status === "resolved";
        }
      }

      return true;
    });
  };

  const filteredTickets = getFilteredTickets();

  // Kanban groups
  const overdueTickets = filteredTickets.filter((t) => t.status === "open" && getHoursSinceCreated(t.created_at) >= 24);
  const due6hTickets = filteredTickets.filter((t) => t.status === "open" && getHoursSinceCreated(t.created_at) >= 18 && getHoursSinceCreated(t.created_at) < 24);
  const due12hTickets = filteredTickets.filter((t) => t.status === "open" && getHoursSinceCreated(t.created_at) < 18);
  const resolvedPendingTickets = filteredTickets.filter((t) => t.status !== "open");

  // Get Store badge colors
  const getRecipientBadgeStyle = (email?: string) => {
    const rec = (email || "").toLowerCase();
    if (rec.includes("wairaiders")) {
      return { bg: "#ffedd5", text: "#ea580c", border: "1px solid #fed7aa", label: "WaiRaiders" };
    }
    if (rec.includes("vulius")) {
      return { bg: "#f3e8ff", text: "#9333ea", border: "1px solid #e9d5ff", label: "Vulius" };
    }
    if (rec) {
      return { bg: "#eff6ff", text: "#2563eb", border: "1px solid #bfdbfe", label: rec.split("@")[0] || "Support" };
    }
    return { bg: "#f3f4f6", text: "#4b5563", border: "1px solid #e5e7eb", label: "General" };
  };

  const getDomainFromEmail = (emailStr: string) => {
    if (!emailStr || !emailStr.includes("@")) return "";
    return emailStr.split("@")[1];
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 80px)", margin: "-24px", background: "#f8fafc" }}>
      
      {/* 1. ZOHO DESK HEADER TAB BAR */}
      <div style={{ background: "#1e2229", height: "48px", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px", flexShrink: 0, borderBottom: "2px solid #ea580c" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
          <span style={{ color: "#ffffff", fontWeight: 800, fontSize: "16px", letterSpacing: "0.05em", display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "20px" }}>🗃️</span> ZOHO DESK
          </span>
          <div style={{ display: "flex", gap: "16px", height: "100%" }}>
            <button style={{ background: "transparent", border: "none", color: "#ffffff", borderBottom: "3px solid #ea580c", fontSize: "13px", fontWeight: "bold", padding: "0 8px", cursor: "pointer", height: "48px" }}>TICKETS</button>
            <button style={{ background: "transparent", border: "none", color: "#9ca3af", fontSize: "13px", fontWeight: "medium", padding: "0 8px", cursor: "pointer", height: "48px" }} onClick={() => alert("Redirecting to KB...")}>KB</button>
            <button style={{ background: "transparent", border: "none", color: "#9ca3af", fontSize: "13px", fontWeight: "medium", padding: "0 8px", cursor: "pointer", height: "48px" }} onClick={() => alert("Redirecting to Tasks...")}>TASKS</button>
            <button style={{ background: "transparent", border: "none", color: "#9ca3af", fontSize: "13px", fontWeight: "medium", padding: "0 8px", cursor: "pointer", height: "48px" }} onClick={() => alert("Redirecting to Customers...")}>CUSTOMERS</button>
            <button style={{ background: "transparent", border: "none", color: "#9ca3af", fontSize: "13px", fontWeight: "medium", padding: "0 8px", cursor: "pointer", height: "48px" }} onClick={() => alert("Redirecting to Reports...")}>REPORTS</button>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <span style={{ color: "#9ca3af", fontSize: "12px", background: "#374151", padding: "3px 8px", borderRadius: "4px", fontWeight: "bold" }}>zPhone Connected</span>
          <div style={{ color: "#ffffff", fontSize: "16px", cursor: "pointer" }}>⚙️</div>
          <div style={{ width: "28px", height: "28px", borderRadius: "50%", background: "#4f46e5", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: "11px", fontWeight: "bold" }}>LP</div>
        </div>
      </div>

      {/* 2. MAIN CONSOLE LAYOUT (SIDEBAR + MAIN AREA) */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        
        {/* SIDEBAR VIEW SELECTOR */}
        <div style={{ width: "240px", background: "#ffffff", borderRight: "1px solid #e2e8f0", display: "flex", flexDirection: "column", flexShrink: 0, padding: "16px 0", overflowY: "auto" }}>
          
          <div style={{ padding: "0 16px 12px 16px", borderBottom: "1px solid #f1f5f9", marginBottom: "12px" }}>
            <h3 style={{ fontSize: "13px", fontWeight: "bold", margin: 0, color: "var(--text-primary)", letterSpacing: "0.03em" }}>VIEWS</h3>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "2px", padding: "0 8px" }}>
            <button
              onClick={() => { setActiveFilter("all"); setActiveTicketId(null); }}
              style={{
                display: "flex", alignItems: "center", gap: "10px", width: "100%", padding: "8px 12px", border: "none", borderRadius: "6px",
                background: activeFilter === "all" ? "#f1f5f9" : "transparent", color: activeFilter === "all" ? "var(--accent)" : "var(--text-secondary)",
                fontSize: "13px", fontWeight: activeFilter === "all" ? "600" : "500", cursor: "pointer", textAlign: "left", transition: "all 0.15s"
              }}
            >
              <span>📂</span> All Tickets
            </button>
            <button
              onClick={() => { setActiveFilter("wairaiders"); setActiveTicketId(null); }}
              style={{
                display: "flex", alignItems: "center", gap: "10px", width: "100%", padding: "8px 12px", border: "none", borderRadius: "6px",
                background: activeFilter === "wairaiders" ? "#fff7ed" : "transparent", color: activeFilter === "wairaiders" ? "#ea580c" : "var(--text-secondary)",
                fontSize: "13px", fontWeight: activeFilter === "wairaiders" ? "600" : "500", cursor: "pointer", textAlign: "left", transition: "all 0.15s"
              }}
            >
              <span style={{ color: "#f97316" }}>🟠</span> WaiRaiders Store
            </button>
            <button
              onClick={() => { setActiveFilter("vulius"); setActiveTicketId(null); }}
              style={{
                display: "flex", alignItems: "center", gap: "10px", width: "100%", padding: "8px 12px", border: "none", borderRadius: "6px",
                background: activeFilter === "vulius" ? "#faf5ff" : "transparent", color: activeFilter === "vulius" ? "#9333ea" : "var(--text-secondary)",
                fontSize: "13px", fontWeight: activeFilter === "vulius" ? "600" : "500", cursor: "pointer", textAlign: "left", transition: "all 0.15s"
              }}
            >
              <span style={{ color: "#a855f7" }}>🟣</span> Vulius Store
            </button>
            <button
              onClick={() => { setActiveFilter("other"); setActiveTicketId(null); }}
              style={{
                display: "flex", alignItems: "center", gap: "10px", width: "100%", padding: "8px 12px", border: "none", borderRadius: "6px",
                background: activeFilter === "other" ? "#f0f9ff" : "transparent", color: activeFilter === "other" ? "#0284c7" : "var(--text-secondary)",
                fontSize: "13px", fontWeight: activeFilter === "other" ? "600" : "500", cursor: "pointer", textAlign: "left", transition: "all 0.15s"
              }}
            >
              <span style={{ color: "#3b82f6" }}>🔵</span> Other / JOT
            </button>
          </div>

          <div style={{ padding: "20px 16px 12px 16px", borderBottom: "1px solid #f1f5f9", marginBottom: "12px" }}>
            <h3 style={{ fontSize: "11px", fontWeight: "bold", margin: 0, color: "var(--text-muted)", letterSpacing: "0.05em", textTransform: "uppercase" }}>SLA COLUMNS</h3>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "2px", padding: "0 8px" }}>
            <button
              onClick={() => { setActiveFilter("overdue"); setActiveTicketId(null); }}
              style={{
                display: "flex", alignItems: "center", gap: "10px", width: "100%", padding: "8px 12px", border: "none", borderRadius: "6px",
                background: activeFilter === "overdue" ? "#fef2f2" : "transparent", color: activeFilter === "overdue" ? "#dc2626" : "var(--text-secondary)",
                fontSize: "13px", fontWeight: activeFilter === "overdue" ? "600" : "500", cursor: "pointer", textAlign: "left", transition: "all 0.15s"
              }}
            >
              <span style={{ color: "#ef4444" }}>🔴</span> Overdue (&gt;24h)
            </button>
            <button
              onClick={() => { setActiveFilter("due6h"); setActiveTicketId(null); }}
              style={{
                display: "flex", alignItems: "center", gap: "10px", width: "100%", padding: "8px 12px", border: "none", borderRadius: "6px",
                background: activeFilter === "due6h" ? "#fffbeb" : "transparent", color: activeFilter === "due6h" ? "#d97706" : "var(--text-secondary)",
                fontSize: "13px", fontWeight: activeFilter === "due6h" ? "600" : "500", cursor: "pointer", textAlign: "left", transition: "all 0.15s"
              }}
            >
              <span style={{ color: "#f59e0b" }}>🟡</span> Due in 6 Hours
            </button>
            <button
              onClick={() => { setActiveFilter("due12h"); setActiveTicketId(null); }}
              style={{
                display: "flex", alignItems: "center", gap: "10px", width: "100%", padding: "8px 12px", border: "none", borderRadius: "6px",
                background: activeFilter === "due12h" ? "#eff6ff" : "transparent", color: activeFilter === "due12h" ? "#2563eb" : "var(--text-secondary)",
                fontSize: "13px", fontWeight: activeFilter === "due12h" ? "600" : "500", cursor: "pointer", textAlign: "left", transition: "all 0.15s"
              }}
            >
              <span style={{ color: "#3b82f6" }}>🔵</span> Due in 12h+
            </button>
          </div>

          <div style={{ padding: "20px 16px 12px 16px", borderBottom: "1px solid #f1f5f9", marginBottom: "12px" }}>
            <h3 style={{ fontSize: "11px", fontWeight: "bold", margin: 0, color: "var(--text-muted)", letterSpacing: "0.05em", textTransform: "uppercase" }}>STATUS FILTERS</h3>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "2px", padding: "0 8px" }}>
            <button
              onClick={() => { setActiveFilter("open"); setActiveTicketId(null); }}
              style={{
                display: "flex", alignItems: "center", gap: "10px", width: "100%", padding: "8px 12px", border: "none", borderRadius: "6px",
                background: activeFilter === "open" ? "#f1f5f9" : "transparent", color: activeFilter === "open" ? "var(--accent)" : "var(--text-secondary)",
                fontSize: "13px", fontWeight: activeFilter === "open" ? "600" : "500", cursor: "pointer", textAlign: "left"
              }}
            >
              <span>🎟️</span> Open
            </button>
            <button
              onClick={() => { setActiveFilter("pending"); setActiveTicketId(null); }}
              style={{
                display: "flex", alignItems: "center", gap: "10px", width: "100%", padding: "8px 12px", border: "none", borderRadius: "6px",
                background: activeFilter === "pending" ? "#f1f5f9" : "transparent", color: activeFilter === "pending" ? "var(--accent)" : "var(--text-secondary)",
                fontSize: "13px", fontWeight: activeFilter === "pending" ? "600" : "500", cursor: "pointer", textAlign: "left"
              }}
            >
              <span>⏳</span> Pending
            </button>
            <button
              onClick={() => { setActiveFilter("resolved"); setActiveTicketId(null); }}
              style={{
                display: "flex", alignItems: "center", gap: "10px", width: "100%", padding: "8px 12px", border: "none", borderRadius: "6px",
                background: activeFilter === "resolved" ? "#f1f5f9" : "transparent", color: activeFilter === "resolved" ? "var(--accent)" : "var(--text-secondary)",
                fontSize: "13px", fontWeight: activeFilter === "resolved" ? "600" : "500", cursor: "pointer", textAlign: "left"
              }}
            >
              <span>✔️</span> Resolved
            </button>
            <button
              onClick={() => { setActiveFilter("snoozed"); setActiveTicketId(null); }}
              style={{
                display: "flex", alignItems: "center", gap: "10px", width: "100%", padding: "8px 12px", border: "none", borderRadius: "6px",
                background: activeFilter === "snoozed" ? "#f1f5f9" : "transparent", color: activeFilter === "snoozed" ? "var(--accent)" : "var(--text-secondary)",
                fontSize: "13px", fontWeight: activeFilter === "snoozed" ? "600" : "500", cursor: "pointer", textAlign: "left"
              }}
            >
              <span>⏱️</span> Snoozed
            </button>
            <button
              onClick={() => { setActiveFilter("spam"); setActiveTicketId(null); }}
              style={{
                display: "flex", alignItems: "center", gap: "10px", width: "100%", padding: "8px 12px", border: "none", borderRadius: "6px",
                background: activeFilter === "spam" ? "#f1f5f9" : "transparent", color: activeFilter === "spam" ? "var(--accent)" : "var(--text-secondary)",
                fontSize: "13px", fontWeight: activeFilter === "spam" ? "600" : "500", cursor: "pointer", textAlign: "left"
              }}
            >
              <span>🚫</span> Spam/Marketing
            </button>
          </div>

          <div style={{ padding: "20px 16px 12px 16px", borderBottom: "1px solid #f1f5f9", marginBottom: "12px" }}>
            <h3 style={{ fontSize: "11px", fontWeight: "bold", margin: 0, color: "var(--text-muted)", letterSpacing: "0.05em", textTransform: "uppercase" }}>DOMAIN IDENTITIES</h3>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px", padding: "0 16px" }}>
            {getSenderList().map((sender) => (
              <div key={sender.id} style={{ display: "flex", flexDirection: "column", gap: "2px", background: "#f8fafc", padding: "8px", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
                <span style={{ fontSize: "11px", fontWeight: "bold", color: "var(--text-primary)" }}>{sender.store_id}</span>
                <span style={{ fontSize: "10px", color: "var(--text-secondary)", fontFamily: "monospace" }}>@{sender.domain}</span>
                <span style={{ fontSize: "9px", color: "#16a34a", fontWeight: "bold", display: "flex", alignItems: "center", gap: "3px" }}>
                  🟢 Verified Domain
                </span>
              </div>
            ))}
          </div>

        </div>

        {/* MAIN WORKSPACE AREA */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          
          {/* DASHBOARD VIEW MODE OR TICKET CONSOLE */}
          {!activeTicket ? (
            
            /* ==========================================================
               A. TICKETS DASHBOARD VIEW (KANBAN / TABLE)
               ========================================================== */
            <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", padding: "20px" }}>
              
              {/* Filter controls / Toolbar */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexShrink: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <h2 style={{ fontSize: "18px", fontWeight: "bold", color: "var(--text-primary)", margin: 0 }}>
                    {activeFilter.toUpperCase()} TICKETS ({filteredTickets.length})
                  </h2>
                  <input
                    type="text"
                    placeholder="Search subject, body or customer..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ width: "280px", height: "36px", borderRadius: "8px", border: "1px solid #cbd5e1", padding: "0 12px", fontSize: "13px" }}
                  />
                  <button
                    onClick={() => {
                      const list = getSenderList();
                      if (list.length > 0 && list[0]) {
                        setCreateSenderEmail(list[0].from_email || "");
                      }
                      setShowCreateModal(true);
                    }}
                    style={{
                      background: "#ea580c",
                      color: "white",
                      border: "none",
                      padding: "0 16px",
                      height: "36px",
                      borderRadius: "8px",
                      fontSize: "13px",
                      fontWeight: "bold",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px"
                    }}
                  >
                    ➕ New Ticket
                  </button>
                </div>
                
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  {/* Status sub-filter */}
                  {!["open", "pending", "resolved", "snoozed", "spam", "overdue", "due6h", "due12h"].includes(activeFilter) && (
                    <div style={{ display: "flex", background: "#e2e8f0", padding: "3px", borderRadius: "8px" }}>
                      <button
                        onClick={() => setStatusFilter("all")}
                        style={{
                          padding: "6px 12px", border: "none", borderRadius: "6px", fontSize: "12px", fontWeight: "bold", cursor: "pointer",
                          background: statusFilter === "all" ? "#ffffff" : "transparent", color: statusFilter === "all" ? "var(--text-primary)" : "var(--text-secondary)",
                          boxShadow: statusFilter === "all" ? "0 1px 3px rgba(0,0,0,0.1)" : "none", transition: "all 0.15s"
                        }}
                      >
                        All
                      </button>
                      <button
                        onClick={() => setStatusFilter("unresolved")}
                        style={{
                          padding: "6px 12px", border: "none", borderRadius: "6px", fontSize: "12px", fontWeight: "bold", cursor: "pointer",
                          background: statusFilter === "unresolved" ? "#ffffff" : "transparent", color: statusFilter === "unresolved" ? "var(--text-primary)" : "var(--text-secondary)",
                          boxShadow: statusFilter === "unresolved" ? "0 1px 3px rgba(0,0,0,0.1)" : "none", transition: "all 0.15s"
                        }}
                      >
                        Unresolved
                      </button>
                      <button
                        onClick={() => setStatusFilter("resolved")}
                        style={{
                          padding: "6px 12px", border: "none", borderRadius: "6px", fontSize: "12px", fontWeight: "bold", cursor: "pointer",
                          background: statusFilter === "resolved" ? "#ffffff" : "transparent", color: statusFilter === "resolved" ? "var(--text-primary)" : "var(--text-secondary)",
                          boxShadow: statusFilter === "resolved" ? "0 1px 3px rgba(0,0,0,0.1)" : "none", transition: "all 0.15s"
                        }}
                      >
                        Resolved
                      </button>
                    </div>
                  )}

                  {/* View switcher */}
                  <div style={{ display: "flex", background: "#e2e8f0", padding: "3px", borderRadius: "8px" }}>
                  <button
                    onClick={() => setViewMode("kanban")}
                    style={{
                      padding: "6px 12px", border: "none", borderRadius: "6px", fontSize: "12px", fontWeight: "bold", cursor: "pointer",
                      background: viewMode === "kanban" ? "#ffffff" : "transparent", color: viewMode === "kanban" ? "var(--text-primary)" : "var(--text-secondary)",
                      boxShadow: viewMode === "kanban" ? "0 1px 3px rgba(0,0,0,0.1)" : "none", transition: "all 0.15s"
                    }}
                  >
                    📊 Kanban View
                  </button>
                  <button
                    onClick={() => setViewMode("table")}
                    style={{
                      padding: "6px 12px", border: "none", borderRadius: "6px", fontSize: "12px", fontWeight: "bold", cursor: "pointer",
                      background: viewMode === "table" ? "#ffffff" : "transparent", color: viewMode === "table" ? "var(--text-primary)" : "var(--text-secondary)",
                      boxShadow: viewMode === "table" ? "0 1px 3px rgba(0,0,0,0.1)" : "none", transition: "all 0.15s"
                    }}
                  >
                    📝 List View
                  </button>
                </div>
              </div>
            </div>

              {loading ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1 }}>
                  <div className="spinner" style={{ width: "32px", height: "32px", border: "3px solid #ccc", borderTopColor: "var(--accent)", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
                  <p style={{ marginTop: "16px", color: "var(--text-secondary)" }}>Loading support ticket threads...</p>
                </div>
              ) : filteredTickets.length === 0 ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, background: "white", borderRadius: "12px", border: "1px solid #e2e8f0", padding: "40px" }}>
                  <span style={{ fontSize: "48px" }}>📦</span>
                  <h3 style={{ marginTop: "16px", fontSize: "16px", fontWeight: "bold" }}>No tickets found</h3>
                  <p style={{ color: "var(--text-muted)", fontSize: "13px", marginTop: "4px" }}>No support tickets match the selected filters or search queries.</p>
                </div>
              ) : viewMode === "kanban" ? (
                
                /* KANBAN BOARD */
                <div style={{ display: "flex", gap: "16px", flex: 1, overflowX: "auto", paddingBottom: "12px" }}>
                  
                  {/* Column 1: Overdue */}
                  <div style={{ flex: 1, minWidth: "280px", maxWidth: "350px", background: "#f1f5f9", borderRadius: "12px", border: "1px solid #e2e8f0", display: "flex", flexDirection: "column", overflow: "hidden" }}>
                    <div style={{ padding: "12px 16px", background: "#fef2f2", borderBottom: "3px solid #ef4444", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontWeight: "bold", color: "#991b1b", fontSize: "13px" }}>🔴 OVERDUE</span>
                      <span style={{ background: "#fee2e2", color: "#991b1b", fontSize: "11px", fontWeight: "bold", padding: "2px 8px", borderRadius: "99px" }}>{overdueTickets.length}</span>
                    </div>
                    <div style={{ flex: 1, overflowY: "auto", padding: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
                      {overdueTickets.map((t) => (
                        <div
                          key={t.id}
                          onClick={() => setActiveTicketId(t.id)}
                          style={{ background: "#ffffff", padding: "12px", borderRadius: "8px", border: "1px solid #e2e8f0", cursor: "pointer", transition: "transform 0.15s, box-shadow 0.15s", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}
                          onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 4px 6px rgba(0,0,0,0.08)"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.05)"; }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                            <span style={{ fontSize: "11px", fontWeight: "bold", color: "#64748b" }}>#{t.id}</span>
                            <span style={{ fontSize: "10px", padding: "2px 6px", borderRadius: "4px", background: getRecipientBadgeStyle(t.recipient_email).bg, color: getRecipientBadgeStyle(t.recipient_email).text, border: getRecipientBadgeStyle(t.recipient_email).border, fontWeight: "bold" }}>
                              {getRecipientBadgeStyle(t.recipient_email).label}
                            </span>
                          </div>
                          <h4 style={{ fontSize: "13px", fontWeight: "bold", margin: "0 0 6px 0", color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.subject}</h4>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "11px", color: "var(--text-secondary)" }}>
                            <span>👤 {t.customer_name}</span>
                            <span style={{ fontSize: "9px", background: "#fee2e2", color: "#ef4444", padding: "1px 5px", borderRadius: "3px", fontWeight: "bold" }}>
                              LATE BY {Math.floor(getHoursSinceCreated(t.created_at) / 24)}d
                            </span>
                          </div>
                          
                          {/* Domain Badges */}
                          <div style={{ display: "flex", gap: "4px", marginTop: "8px", borderTop: "1px dashed #f1f5f9", paddingTop: "8px", flexWrap: "wrap" }}>
                            {t.recipient_email && (
                              <span style={{ fontSize: "9px", background: "#f8fafc", border: "1px solid #e2e8f0", padding: "1px 4px", borderRadius: "3px", color: "var(--text-secondary)" }}>
                                📥 {getDomainFromEmail(t.recipient_email)}
                              </span>
                            )}
                            <span style={{ fontSize: "9px", background: "#f8fafc", border: "1px solid #e2e8f0", padding: "1px 4px", borderRadius: "3px", color: "var(--text-secondary)" }}>
                              👤 @{getDomainFromEmail(t.customer_email)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Column 2: Due in 6h */}
                  <div style={{ flex: 1, minWidth: "280px", maxWidth: "350px", background: "#f1f5f9", borderRadius: "12px", border: "1px solid #e2e8f0", display: "flex", flexDirection: "column", overflow: "hidden" }}>
                    <div style={{ padding: "12px 16px", background: "#fffbeb", borderBottom: "3px solid #d97706", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontWeight: "bold", color: "#92400e", fontSize: "13px" }}>🟡 DUE IN 6H</span>
                      <span style={{ background: "#fef3c7", color: "#92400e", fontSize: "11px", fontWeight: "bold", padding: "2px 8px", borderRadius: "99px" }}>{due6hTickets.length}</span>
                    </div>
                    <div style={{ flex: 1, overflowY: "auto", padding: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
                      {due6hTickets.map((t) => (
                        <div
                          key={t.id}
                          onClick={() => setActiveTicketId(t.id)}
                          style={{ background: "#ffffff", padding: "12px", borderRadius: "8px", border: "1px solid #e2e8f0", cursor: "pointer", transition: "transform 0.15s, box-shadow 0.15s", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}
                          onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 4px 6px rgba(0,0,0,0.08)"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.05)"; }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                            <span style={{ fontSize: "11px", fontWeight: "bold", color: "#64748b" }}>#{t.id}</span>
                            <span style={{ fontSize: "10px", padding: "2px 6px", borderRadius: "4px", background: getRecipientBadgeStyle(t.recipient_email).bg, color: getRecipientBadgeStyle(t.recipient_email).text, border: getRecipientBadgeStyle(t.recipient_email).border, fontWeight: "bold" }}>
                              {getRecipientBadgeStyle(t.recipient_email).label}
                            </span>
                          </div>
                          <h4 style={{ fontSize: "13px", fontWeight: "bold", margin: "0 0 6px 0", color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.subject}</h4>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "11px", color: "var(--text-secondary)" }}>
                            <span>👤 {t.customer_name}</span>
                            <span style={{ fontSize: "9px", background: "#fef3c7", color: "#d97706", padding: "1px 5px", borderRadius: "3px", fontWeight: "bold" }}>
                              DUE SOON
                            </span>
                          </div>
                          
                          {/* Domain Badges */}
                          <div style={{ display: "flex", gap: "4px", marginTop: "8px", borderTop: "1px dashed #f1f5f9", paddingTop: "8px", flexWrap: "wrap" }}>
                            {t.recipient_email && (
                              <span style={{ fontSize: "9px", background: "#f8fafc", border: "1px solid #e2e8f0", padding: "1px 4px", borderRadius: "3px", color: "var(--text-secondary)" }}>
                                📥 {getDomainFromEmail(t.recipient_email)}
                              </span>
                            )}
                            <span style={{ fontSize: "9px", background: "#f8fafc", border: "1px solid #e2e8f0", padding: "1px 4px", borderRadius: "3px", color: "var(--text-secondary)" }}>
                              👤 @{getDomainFromEmail(t.customer_email)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Column 3: Due in 12h+ */}
                  <div style={{ flex: 1, minWidth: "280px", maxWidth: "350px", background: "#f1f5f9", borderRadius: "12px", border: "1px solid #e2e8f0", display: "flex", flexDirection: "column", overflow: "hidden" }}>
                    <div style={{ padding: "12px 16px", background: "#eff6ff", borderBottom: "3px solid #3b82f6", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontWeight: "bold", color: "#1e40af", fontSize: "13px" }}>🔵 DUE &gt;12H (NEW)</span>
                      <span style={{ background: "#dbeafe", color: "#1e40af", fontSize: "11px", fontWeight: "bold", padding: "2px 8px", borderRadius: "99px" }}>{due12hTickets.length}</span>
                    </div>
                    <div style={{ flex: 1, overflowY: "auto", padding: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
                      {due12hTickets.map((t) => (
                        <div
                          key={t.id}
                          onClick={() => setActiveTicketId(t.id)}
                          style={{ background: "#ffffff", padding: "12px", borderRadius: "8px", border: "1px solid #e2e8f0", cursor: "pointer", transition: "transform 0.15s, box-shadow 0.15s", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}
                          onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 4px 6px rgba(0,0,0,0.08)"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.05)"; }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                            <span style={{ fontSize: "11px", fontWeight: "bold", color: "#64748b" }}>#{t.id}</span>
                            <span style={{ fontSize: "10px", padding: "2px 6px", borderRadius: "4px", background: getRecipientBadgeStyle(t.recipient_email).bg, color: getRecipientBadgeStyle(t.recipient_email).text, border: getRecipientBadgeStyle(t.recipient_email).border, fontWeight: "bold" }}>
                              {getRecipientBadgeStyle(t.recipient_email).label}
                            </span>
                          </div>
                          <h4 style={{ fontSize: "13px", fontWeight: "bold", margin: "0 0 6px 0", color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.subject}</h4>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "11px", color: "var(--text-secondary)" }}>
                            <span>👤 {t.customer_name}</span>
                            <span style={{ fontSize: "9px", color: "#3b82f6", fontWeight: "bold" }}>
                              NEW
                            </span>
                          </div>
                          
                          {/* Domain Badges */}
                          <div style={{ display: "flex", gap: "4px", marginTop: "8px", borderTop: "1px dashed #f1f5f9", paddingTop: "8px", flexWrap: "wrap" }}>
                            {t.recipient_email && (
                              <span style={{ fontSize: "9px", background: "#f8fafc", border: "1px solid #e2e8f0", padding: "1px 4px", borderRadius: "3px", color: "var(--text-secondary)" }}>
                                📥 {getDomainFromEmail(t.recipient_email)}
                              </span>
                            )}
                            <span style={{ fontSize: "9px", background: "#f8fafc", border: "1px solid #e2e8f0", padding: "1px 4px", borderRadius: "3px", color: "var(--text-secondary)" }}>
                              👤 @{getDomainFromEmail(t.customer_email)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Column 4: Resolved / Pending */}
                  <div style={{ flex: 1, minWidth: "280px", maxWidth: "350px", background: "#f1f5f9", borderRadius: "12px", border: "1px solid #e2e8f0", display: "flex", flexDirection: "column", overflow: "hidden" }}>
                    <div style={{ padding: "12px 16px", background: "#d1fae5", borderBottom: "3px solid #10b981", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontWeight: "bold", color: "#065f46", fontSize: "13px" }}>✔️ RESOLVED / PENDING</span>
                      <span style={{ background: "#a7f3d0", color: "#065f46", fontSize: "11px", fontWeight: "bold", padding: "2px 8px", borderRadius: "99px" }}>{resolvedPendingTickets.length}</span>
                    </div>
                    <div style={{ flex: 1, overflowY: "auto", padding: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
                      {resolvedPendingTickets.map((t) => (
                        <div
                          key={t.id}
                          onClick={() => setActiveTicketId(t.id)}
                          style={{ background: "#ffffff", padding: "12px", borderRadius: "8px", border: "1px solid #e2e8f0", cursor: "pointer", opacity: 0.8, transition: "transform 0.15s, box-shadow 0.15s" }}
                          onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 4px 6px rgba(0,0,0,0.08)"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "none"; }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                            <span style={{ fontSize: "11px", fontWeight: "bold", color: "#64748b" }}>#{t.id}</span>
                            <span style={{ fontSize: "10px", padding: "2px 6px", borderRadius: "4px", background: getRecipientBadgeStyle(t.recipient_email).bg, color: getRecipientBadgeStyle(t.recipient_email).text, border: getRecipientBadgeStyle(t.recipient_email).border, fontWeight: "bold" }}>
                              {getRecipientBadgeStyle(t.recipient_email).label}
                            </span>
                          </div>
                          <h4 style={{ fontSize: "13px", fontWeight: "bold", margin: "0 0 6px 0", color: "#64748b", textDecoration: t.status === "resolved" ? "line-through" : "none" }}>{t.subject}</h4>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "11px", color: "var(--text-secondary)" }}>
                            <span>👤 {t.customer_name}</span>
                            <span style={{ fontSize: "9px", background: t.status === "resolved" ? "#d1fae5" : "#fef3c7", color: t.status === "resolved" ? "#065f46" : "#b45309", padding: "1px 5px", borderRadius: "3px", fontWeight: "bold", textTransform: "uppercase" }}>
                              {t.status}
                            </span>
                          </div>
                          
                          {/* Domain Badges */}
                          <div style={{ display: "flex", gap: "4px", marginTop: "8px", borderTop: "1px dashed #f1f5f9", paddingTop: "8px", flexWrap: "wrap" }}>
                            {t.recipient_email && (
                              <span style={{ fontSize: "9px", background: "#f8fafc", border: "1px solid #e2e8f0", padding: "1px 4px", borderRadius: "3px", color: "var(--text-secondary)" }}>
                                📥 {getDomainFromEmail(t.recipient_email)}
                              </span>
                            )}
                            <span style={{ fontSize: "9px", background: "#f8fafc", border: "1px solid #e2e8f0", padding: "1px 4px", borderRadius: "3px", color: "var(--text-secondary)" }}>
                              👤 @{getDomainFromEmail(t.customer_email)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>
              ) : (
                
                /* TABLE / LIST VIEW */
                <div style={{ flex: 1, background: "white", borderRadius: "12px", border: "1px solid #e2e8f0", overflowY: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr>
                        <th style={{ padding: "12px 16px", borderBottom: "1px solid #cbd5e1", textAlign: "left", fontSize: "11px", fontWeight: "bold" }}>TICKET ID</th>
                        <th style={{ padding: "12px 16px", borderBottom: "1px solid #cbd5e1", textAlign: "left", fontSize: "11px", fontWeight: "bold" }}>CUSTOMER</th>
                        <th style={{ padding: "12px 16px", borderBottom: "1px solid #cbd5e1", textAlign: "left", fontSize: "11px", fontWeight: "bold" }}>INBOUND ROUTE</th>
                        <th style={{ padding: "12px 16px", borderBottom: "1px solid #cbd5e1", textAlign: "left", fontSize: "11px", fontWeight: "bold" }}>SUBJECT</th>
                        <th style={{ padding: "12px 16px", borderBottom: "1px solid #cbd5e1", textAlign: "left", fontSize: "11px", fontWeight: "bold" }}>STATUS</th>
                        <th style={{ padding: "12px 16px", borderBottom: "1px solid #cbd5e1", textAlign: "left", fontSize: "11px", fontWeight: "bold" }}>DATE</th>
                        <th style={{ padding: "12px 16px", borderBottom: "1px solid #cbd5e1", textAlign: "left", fontSize: "11px", fontWeight: "bold" }}>ACTION</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTickets.map((t) => {
                        const recBadge = getRecipientBadgeStyle(t.recipient_email);
                        return (
                          <tr key={t.id} onClick={() => setActiveTicketId(t.id)} style={{ cursor: "pointer", borderBottom: "1px solid #f1f5f9" }} className="table-row-hover">
                            <td style={{ padding: "12px 16px", fontSize: "13px", fontWeight: "bold", color: "#64748b" }}>#{t.id}</td>
                            <td style={{ padding: "12px 16px", fontSize: "13px" }}>
                              <div style={{ fontWeight: "600" }}>{t.customer_name}</div>
                              <div style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "monospace" }}>{t.customer_email}</div>
                            </td>
                            <td style={{ padding: "12px 16px", fontSize: "13px" }}>
                              <span style={{ fontSize: "11px", padding: "3px 8px", borderRadius: "4px", background: recBadge.bg, color: recBadge.text, border: recBadge.border, fontWeight: "bold" }}>
                                {t.recipient_email || "General Intake"}
                              </span>
                            </td>
                            <td style={{ padding: "12px 16px", fontSize: "13px", fontWeight: "600", maxWidth: "250px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                               <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                 <span>{t.subject}</span>
                                 {t.tags?.includes("spam") && (
                                   <span style={{ fontSize: "9px", padding: "1px 4px", borderRadius: "3px", background: "#fee2e2", color: "#ef4444", fontWeight: "bold" }}>
                                     Spam
                                   </span>
                                 )}
                                 {t.status === "snoozed" && (
                                   <span style={{ fontSize: "9px", padding: "1px 4px", borderRadius: "3px", background: "#dbeafe", color: "#1e40af", fontWeight: "bold" }}>
                                     Snoozed
                                   </span>
                                 )}
                               </div>
                             </td>
                            <td style={{ padding: "12px 16px", fontSize: "13px" }}>
                              <span style={{
                                padding: "2px 8px", borderRadius: "99px", fontSize: "11px", fontWeight: "bold", textTransform: "uppercase",
                                background: t.status === "open" ? "#fee2e2" : t.status === "resolved" ? "#d1fae5" : "#fef3c7",
                                color: t.status === "open" ? "#dc2626" : t.status === "resolved" ? "#065f46" : "#d97706"
                              }}>
                                {t.status}
                              </span>
                            </td>
                            <td style={{ padding: "12px 16px", fontSize: "12px", color: "var(--text-secondary)" }}>
                              {formatTimelineDate(t.created_at)}
                            </td>
                            <td style={{ padding: "12px 16px" }}>
                              <button className="btn btn-secondary" style={{ padding: "4px 8px", fontSize: "11px" }}>Open Console</button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

              )}

            </div>
          ) : (
            
            /* ==========================================================
               B. ACTIVE TICKET CONSOLE SPLIT VIEW (CHAT + CRM HUB)
               ========================================================== */
            <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
              
              {/* MIDDLE CONSOLE PANE (TICKET THREAD & CONVERSATION) */}
              <div style={{ flex: 1, padding: "20px", display: "flex", flexDirection: "column", background: "white", borderRight: "1px solid #e2e8f0" }}>
                
                {/* Back button and Subject details */}
                <div style={{ display: "flex", flexDirection: "column", borderBottom: "1px solid var(--border-default)", paddingBottom: "12px", marginBottom: "12px", gap: "8px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <button
                      onClick={() => setActiveTicketId(null)}
                      style={{ background: "#f1f5f9", border: "1px solid #cbd5e1", padding: "6px 12px", borderRadius: "6px", fontSize: "12px", fontWeight: "bold", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}
                    >
                      ⬅️ Back to Dashboard
                    </button>

                    {/* Quick action buttons */}
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button
                        onClick={() => handleUpdateStatus("resolved")}
                        style={{ background: "#10b981", color: "white", border: "none", padding: "6px 12px", borderRadius: "6px", fontSize: "12px", fontWeight: "bold", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}
                      >
                        ✔️ Solve
                      </button>
                      <button
                        onClick={() => handleUpdateStatus("pending")}
                        style={{ background: "#f59e0b", color: "white", border: "none", padding: "6px 12px", borderRadius: "6px", fontSize: "12px", fontWeight: "bold", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}
                      >
                        ⏳ Pending
                      </button>
                      <button
                        onClick={() => handleSnoozeTicket()}
                        style={{ background: "#3b82f6", color: "white", border: "none", padding: "6px 12px", borderRadius: "6px", fontSize: "12px", fontWeight: "bold", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}
                      >
                        ⏱️ Wait 24 Hours
                      </button>
                      <button
                        onClick={() => handleToggleSpam()}
                        style={{
                          background: activeTicket.tags?.includes("spam") ? "#ef4444" : "#f1f5f9",
                          color: activeTicket.tags?.includes("spam") ? "white" : "var(--text-secondary)",
                          border: "1px solid #cbd5e1", padding: "6px 12px", borderRadius: "6px", fontSize: "12px", fontWeight: "bold", cursor: "pointer"
                        }}
                      >
                        {activeTicket.tags?.includes("spam") ? "🚫 Tagged Spam" : "🏳️ Mark as Spam"}
                      </button>
                    </div>

                    <span
                      style={{
                        padding: "3px 12px", borderRadius: "999px", fontSize: "11px", fontWeight: "bold", textTransform: "uppercase",
                        background: activeTicket.status === "open" ? "#fee2e2" : activeTicket.status === "resolved" ? "#d1fae5" : activeTicket.status === "snoozed" ? "#dbeafe" : "#fef3c7",
                        color: activeTicket.status === "open" ? "#dc2626" : activeTicket.status === "resolved" ? "#065f46" : activeTicket.status === "snoozed" ? "#1e40af" : "#d97706"
                      }}
                    >
                      {activeTicket.status}
                    </span>
                  </div>

                  <div>
                    <h3 style={{ fontSize: "15px", fontWeight: "bold", color: "var(--text-primary)", margin: 0 }}>
                      Ticket #{activeTicket.id}: {activeTicket.subject}
                    </h3>
                    
                    {/* Domain recognition headers */}
                    <div style={{ display: "flex", gap: "8px", alignItems: "center", marginTop: "4px", flexWrap: "wrap" }}>
                      <span style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
                        From: <strong>{activeTicket.customer_name}</strong> ({activeTicket.customer_email})
                      </span>
                      <span style={{ color: "#cbd5e1", fontSize: "12px" }}>|</span>
                      <span style={{ fontSize: "11px", padding: "2px 6px", borderRadius: "4px", background: getRecipientBadgeStyle(activeTicket.recipient_email).bg, color: getRecipientBadgeStyle(activeTicket.recipient_email).text, border: getRecipientBadgeStyle(activeTicket.recipient_email).border, fontWeight: "bold" }}>
                        📥 Recipient Inbox: {activeTicket.recipient_email || "customer@justonetee.org"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* AI Rules Classifier Alert */}
                {matchesAutoReplyRule(activeTicket) ? (
                  <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", padding: "10px 12px", borderRadius: "8px", color: "#166534", fontSize: "12px", display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px", flexShrink: 0 }}>
                    <span>🤖</span>
                    <div>
                      <strong>AI Rule Match (Shipping Inquiry)</strong>: Scanned keywords matching order updates and resolved instantly.
                    </div>
                  </div>
                ) : (
                  <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-default)", padding: "10px 12px", borderRadius: "8px", color: "var(--text-secondary)", fontSize: "12px", display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px", flexShrink: 0 }}>
                    <span>⏳</span>
                    <div>
                      <strong>Awaiting Manual Reply</strong>: Keywords matching auto-replies not detected (Size/Custom jersey update). Outbound routing verified.
                    </div>
                  </div>
                )}

                {/* Conversation messages scroll area */}
                <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "12px", paddingRight: "4px", marginBottom: "16px" }}>
                  
                  {/* Customer question bubble */}
                  <div style={{ alignSelf: "flex-start", maxWidth: "85%", background: "var(--bg-secondary)", border: "1px solid var(--border-default)", padding: "12px 14px", borderRadius: "12px 12px 12px 0", color: "var(--text-primary)", fontSize: "13px", lineHeight: "1.5" }}>
                    <div style={{ fontSize: "10px", color: "var(--text-secondary)", fontWeight: "bold", marginBottom: "4px" }}>
                      👤 {activeTicket.customer_name} &lt;{activeTicket.customer_email}&gt;
                    </div>
                    <MessageBody content={activeTicket.message} />
                    <div style={{ fontSize: "9px", color: "var(--text-muted)", textAlign: "right", marginTop: "6px" }}>
                      {formatTimelineDate(activeTicket.created_at)}
                    </div>
                  </div>

                  {/* Thread replies */}
                  {getTicketReplies(activeTicket).map((reply, i) => {
                    const parsed = parseReply(reply);
                    return (
                      <div
                        key={i}
                        style={{
                          alignSelf: parsed.align as any,
                          maxWidth: "85%",
                          background: parsed.bg,
                          border: parsed.border,
                          padding: "12px 14px",
                          borderRadius: parsed.borderRadius,
                          color: parsed.textColor,
                          fontSize: "13px",
                          lineHeight: "1.5",
                        }}
                      >
                        <div style={{ fontSize: "10px", color: parsed.textColor === "var(--text-primary)" ? "var(--text-secondary)" : parsed.textColor, fontWeight: "bold", marginBottom: "4px", textTransform: "uppercase", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px" }}>
                          <span>{parsed.sender}</span>
                          {parsed.timestamp && (
                            <span style={{ fontSize: "9px", color: "var(--text-muted)", fontWeight: "normal" }}>
                              {parsed.timestamp}
                            </span>
                          )}
                        </div>
                        <MessageBody content={parsed.message} />
                      </div>
                    );
                  })}
                </div>

                {/* Reply Drafting console */}
                <div style={{ borderTop: "1px solid var(--border-default)", paddingTop: "12px", marginTop: "auto", flexShrink: 0 }}>
                  
                  {/* Outbound email selector & Templates panel */}
                  <div style={{ display: "flex", gap: "12px", alignItems: "center", marginBottom: "10px", flexWrap: "wrap", justifyContent: "space-between", background: "#f8fafc", padding: "8px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                    
                    {/* Outbound Domain recognition */}
                    <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                      <span style={{ fontSize: "11px", fontWeight: "bold", color: "var(--text-secondary)" }}>📤 REPLY FROM:</span>
                      <select
                        value={selectedFromEmail}
                        onChange={(e) => setSelectedFromEmail(e.target.value)}
                        style={{ padding: "4px 8px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "11px", fontWeight: "bold", background: "white", outline: "none" }}
                      >
                        {getSenderList().map((sender) => (
                          <option key={sender.id} value={sender.from_email}>
                            {sender.from_name} ({sender.from_email})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Email templates quick buttons */}
                    <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                      <span style={{ fontSize: "10px", fontWeight: "bold", color: "var(--text-secondary)" }}>📄 TEMPLATES:</span>
                      <button
                        type="button"
                        onClick={() => handleSelectTemplate("shipping")}
                        style={{ padding: "3px 8px", background: "white", border: "1px solid #cbd5e1", borderRadius: "4px", fontSize: "10px", cursor: "pointer", color: "var(--text-primary)" }}
                      >
                        🚚 Shipping
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSelectTemplate("size")}
                        style={{ padding: "3px 8px", background: "white", border: "1px solid #cbd5e1", borderRadius: "4px", fontSize: "10px", cursor: "pointer", color: "var(--text-primary)" }}
                      >
                        🎽 Size Change
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSelectTemplate("general")}
                        style={{ padding: "3px 8px", background: "white", border: "1px solid #cbd5e1", borderRadius: "4px", fontSize: "10px", cursor: "pointer", color: "var(--text-primary)" }}
                      >
                        💬 General
                      </button>
                    </div>

                  </div>

                  <textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder={`Reply to ${activeTicket.customer_name} from ${selectedFromEmail}...`}
                    style={{ width: "100%", height: "80px", padding: "10px", borderRadius: "8px", border: "1px solid var(--border-default)", background: "white", fontSize: "13px", resize: "none", marginBottom: "8px", fontFamily: "inherit" }}
                  />

                  <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                    <button
                      onClick={() => handleSubmitReply("pending")}
                      disabled={replying || !replyText.trim()}
                      className="btn btn-secondary"
                      style={{ height: "34px", padding: "0 12px", fontSize: "12px" }}
                    >
                      Send & Keep Open
                    </button>
                    <button
                      onClick={() => handleSubmitReply("resolved")}
                      disabled={replying || !replyText.trim()}
                      className="btn btn-primary"
                      style={{ height: "34px", padding: "0 12px", fontSize: "12px" }}
                    >
                      {replying ? "Sending..." : "✔️ Send & Resolve"}
                    </button>
                  </div>
                </div>

              </div>

              {/* RIGHT PANE: CRM BUYER HISTORY DETAILS HUB */}
              <div style={{ width: "320px", padding: "20px", display: "flex", flexDirection: "column", background: "#f8fafc", flexShrink: 0, overflowY: "auto" }}>
                
                <div style={{ paddingBottom: "8px", borderBottom: "1px solid var(--border-default)", marginBottom: "12px" }}>
                  <h3 style={{ fontSize: "12px", fontWeight: "bold", margin: 0, color: "var(--text-primary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Linked Buyer CRM</h3>
                  <p style={{ margin: "2px 0 0 0", fontSize: "10px", color: "var(--text-secondary)" }}>Linked via customer email address</p>
                </div>

                {crmLoading ? (
                  <div style={{ padding: "40px", textAlign: "center", color: "var(--text-secondary)", flex: 1 }}>
                    <div className="spinner" style={{ display: "inline-block", width: "16px", height: "16px", border: "2px solid #ccc", borderTopColor: "var(--accent)", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
                    <p style={{ marginTop: "12px", fontSize: "11px" }}>Loading customer order history...</p>
                  </div>
                ) : crmProfile ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    
                    {/* Customer Profile Card */}
                    <div style={{ background: "white", padding: "10px", borderRadius: "8px", border: "1px solid var(--border-default)", fontSize: "11px" }}>
                      <div style={{ fontWeight: "bold", fontSize: "13px", color: "var(--text-primary)" }}>{crmProfile.name}</div>
                      <div style={{ color: "var(--text-secondary)", marginTop: "2px" }}>{crmProfile.email}</div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginTop: "8px", fontWeight: "bold", borderTop: "1px dashed var(--border-default)", paddingTop: "8px" }}>
                        <span>CRM Lifetime Spent:</span>
                        <span style={{ color: "var(--accent)" }}>${crmProfile.total_spent.toFixed(2)}</span>
                      </div>
                    </div>

                    {/* Orders listing */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      <div style={{ fontSize: "11px", fontWeight: "bold", color: "var(--text-secondary)", textTransform: "uppercase" }}>Orders ({crmProfile.orders.length})</div>
                      {crmProfile.orders.length === 0 ? (
                        <div style={{ fontSize: "11px", color: "var(--text-muted)", fontStyle: "italic", textAlign: "center", padding: "20px" }}>No orders exist for this buyer.</div>
                      ) : (
                        crmProfile.orders.map((o) => {
                          const isWai = (o.store_id || "").toLowerCase().includes("wairaiders");
                          return (
                            <div key={o.id} style={{ border: "1px solid var(--border-default)", borderRadius: "8px", padding: "10px", background: "white" }}>
                              <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold", fontSize: "11px", color: "var(--text-primary)" }}>
                                <span>Order {o.order_id}</span>
                                <span>${o.revenue.toFixed(2)}</span>
                              </div>
                              <div style={{ fontSize: "10px", color: "var(--text-secondary)", marginTop: "2px" }}>{o.product_name}</div>
                              <div style={{ fontSize: "9px", color: "var(--text-muted)", background: "var(--bg-secondary)", padding: "4px", borderRadius: "3px", margin: "4px 0" }}>
                                {o.variant}
                              </div>
                              
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "6px", fontSize: "10px" }}>
                                <span style={{ fontWeight: "bold", color: isWai ? "#ea580c" : "#9333ea" }}>
                                  🏢 {isWai ? "WaiRaiders Store" : "Vulius Store"}
                                </span>
                                <span style={{ fontWeight: "bold", color: o.shipping_status === "delivered" ? "var(--success)" : o.shipping_status === "in transit" ? "var(--info)" : "var(--warning)", textTransform: "uppercase", fontSize: "9px" }}>
                                  📦 {o.shipping_status}
                                </span>
                              </div>
                              {o.tracking_number ? (
                                <div style={{ fontSize: "9px", background: "#f0fdf4", padding: "4px 6px", borderRadius: "3px", marginTop: "6px", fontFamily: "monospace", color: "var(--success)", border: "1px solid #bbf7d0", fontWeight: "bold" }}>
                                  🚚 {o.tracking_number}
                                </div>
                              ) : (
                                <div style={{ fontSize: "10px", color: "var(--text-muted)", fontStyle: "italic", marginTop: "6px" }}>
                                  Awaiting tracking code...
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>

                  </div>
                ) : (
                  <div style={{ fontSize: "11px", color: "var(--text-muted)", fontStyle: "italic", textAlign: "center", padding: "20px" }}>No buyer profile linked.</div>
                )}

              </div>

            </div>

          )}

        </div>

      </div>

      {/* Manual Ticket Creation Modal (Freshdesk style overlay) */}
      {showCreateModal && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
          background: "rgba(15, 23, 42, 0.6)",
          backdropFilter: "blur(4px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 9999,
        }}>
          <div style={{
            background: "white",
            width: "550px",
            borderRadius: "16px",
            boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
            border: "1px solid #e2e8f0",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden"
          }}>
            {/* Header */}
            <div style={{
              padding: "18px 24px",
              borderBottom: "1px solid #f1f5f9",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              background: "#f8fafc"
            }}>
              <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "bold", color: "#0f172a" }}>
                ➕ Create New Support Ticket
              </h3>
              <button 
                onClick={() => {
                  setShowCreateModal(false);
                  resetCreateFields();
                }}
                style={{ background: "transparent", border: "none", fontSize: "18px", cursor: "pointer", color: "#64748b" }}
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "16px", maxHeight: "70vh", overflowY: "auto" }}>
              
              {/* Row 1: Cust Email & Cust Name */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <label style={{ fontSize: "12px", fontWeight: "600", color: "#334155" }}>Customer Email</label>
                  <input 
                    type="email" 
                    placeholder="customer@example.com"
                    value={createCustomerEmail}
                    onChange={(e) => setCreateCustomerEmail(e.target.value)}
                    style={{ width: "100%", height: "38px", borderRadius: "8px", border: "1px solid #cbd5e1", padding: "0 12px", fontSize: "13px" }}
                  />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <label style={{ fontSize: "12px", fontWeight: "600", color: "#334155" }}>Customer Name</label>
                  <input 
                    type="text" 
                    placeholder="John Doe"
                    value={createCustomerName}
                    onChange={(e) => setCreateCustomerName(e.target.value)}
                    style={{ width: "100%", height: "38px", borderRadius: "8px", border: "1px solid #cbd5e1", padding: "0 12px", fontSize: "13px" }}
                  />
                </div>
              </div>

              {/* Row 2: Sender Email Select */}
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "12px", fontWeight: "600", color: "#334155" }}>Send From Store Identity</label>
                <select
                  value={createSenderEmail}
                  onChange={(e) => setCreateSenderEmail(e.target.value)}
                  style={{ width: "100%", height: "38px", borderRadius: "8px", border: "1px solid #cbd5e1", padding: "0 10px", fontSize: "13px", background: "white" }}
                >
                  <option value="">-- Select Store Sender Address --</option>
                  {getSenderList().map(s => (
                    <option key={s.id} value={s.from_email}>
                      {s.from_name} ({s.from_email})
                    </option>
                  ))}
                </select>
              </div>

              {/* Row 3: Subject */}
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "12px", fontWeight: "600", color: "#334155" }}>Subject</label>
                <input 
                  type="text" 
                  placeholder="e.g. Size update for your order"
                  value={createSubject}
                  onChange={(e) => setCreateSubject(e.target.value)}
                  style={{ width: "100%", height: "38px", borderRadius: "8px", border: "1px solid #cbd5e1", padding: "0 12px", fontSize: "13px" }}
                />
              </div>

              {/* Row 4: Initial Message */}
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "12px", fontWeight: "600", color: "#334155" }}>Initial Outgoing Message</label>
                <textarea 
                  placeholder="Write your email body here. This will be sent directly to the customer."
                  value={createMessage}
                  onChange={(e) => setCreateMessage(e.target.value)}
                  style={{ width: "100%", height: "120px", borderRadius: "8px", border: "1px solid #cbd5e1", padding: "12px", fontSize: "13px", resize: "none", fontFamily: "inherit" }}
                />
              </div>
            </div>

            {/* Footer */}
            <div style={{
              padding: "16px 24px",
              borderTop: "1px solid #f1f5f9",
              display: "flex",
              justifyContent: "flex-end",
              gap: "12px",
              background: "#f8fafc"
            }}>
              <button 
                onClick={() => {
                  setShowCreateModal(false);
                  resetCreateFields();
                }}
                disabled={creatingTicket}
                style={{
                  background: "white",
                  border: "1px solid #cbd5e1",
                  padding: "8px 16px",
                  borderRadius: "8px",
                  fontSize: "13px",
                  fontWeight: "bold",
                  cursor: "pointer",
                  color: "#334155"
                }}
              >
                Cancel
              </button>
              <button 
                onClick={handleCreateTicket}
                disabled={creatingTicket}
                style={{
                  background: "#ea580c",
                  border: "none",
                  padding: "8px 16px",
                  borderRadius: "8px",
                  fontSize: "13px",
                  fontWeight: "bold",
                  cursor: "pointer",
                  color: "white",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px"
                }}
              >
                {creatingTicket ? "Sending..." : "✉️ Send & Open Ticket"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
