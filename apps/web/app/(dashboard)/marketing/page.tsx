"use client";

import { useState, useEffect } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Campaign {
  id: number;
  name: string;
  subject: string;
  body_html: string;
  status: "draft" | "scheduled" | "sending" | "completed";
  sent_count: number;
  scheduled_at?: string;
  created_at: string;
}

interface Template {
  id: number;
  name: string;
  subject: string;
  body_html: string;
}

interface Contact {
  id: number;
  store_id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  consent_status: string;
  consent_source: string;
}

export default function MarketingPage() {
  const [activeTab, setActiveTab] = useState<"campaigns" | "contacts" | "templates" | "senders">("campaigns");
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  
  // Visual Campaign Builder states
  const [campaignModalOpen, setCampaignModalOpen] = useState(false);
  const [campaignName, setCampaignName] = useState("");
  const [campaignSubject, setCampaignSubject] = useState("");
  const [campaignTemplate, setCampaignTemplate] = useState<"promo" | "elegant" | "bold" | "custom">("promo");
  
  // Custom template fields
  const [campaignTitle, setCampaignTitle] = useState("🏈 WaiRaiders Jersey Special!");
  const [campaignSubtitle, setCampaignSubtitle] = useState("Get 25% off our exclusive custom drops this weekend only.");
  const [campaignBody, setCampaignBody] = useState("We are excited to share our latest premium custom NFL jersey mockups. Tailored with high-durability fabrics, bold colors, and customized lettering, these designs are ready to elevate your team spirit in style.");
  const [campaignCtaText, setCampaignCtaText] = useState("🛍️ Shop Jersey Collection");
  const [campaignCtaUrl, setCampaignCtaUrl] = useState("https://wairaiders.com/shop");
  const [campaignAccentColor, setCampaignAccentColor] = useState("#0d9488");
  const [campaignAudience, setCampaignAudience] = useState("all");
  const [campaignSchedule, setCampaignSchedule] = useState<"now" | "later">("now");
  const [campaignScheduledAt, setCampaignScheduledAt] = useState("");

  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [newTemplate, setNewTemplate] = useState({ name: "", subject: "", body_html: "", store_id: "WaiRaiders Store" });
  
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [csvText, setCsvText] = useState("");
  
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null);
  
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");

  // Load Data
  const loadCampaigns = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/marketing/campaigns`);
      if (res.ok) setCampaigns(await res.json());
    } catch (err) {
      console.error("Failed to load campaigns", err);
    }
  };

  const loadTemplates = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/marketing/templates`);
      if (res.ok) setTemplates(await res.json());
    } catch (err) {
      console.error("Failed to load templates", err);
    }
  };

  const loadContacts = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/marketing/contacts`);
      if (res.ok) setContacts(await res.json());
    } catch (err) {
      console.error("Failed to load contacts", err);
    }
  };

  useEffect(() => {
    loadCampaigns();
    loadTemplates();
    loadContacts();
  }, []);

  const showStatus = (msg: string, type: "success" | "error") => {
    setMessage(msg);
    setMessageType(type);
    setTimeout(() => setMessage(""), 5000);
  };

  const compileCampaignHtml = () => {
    if (campaignTemplate === "custom") {
      return campaignBody;
    }
    
    if (campaignTemplate === "elegant") {
      return `<div style="font-family: Georgia, serif; background: #faf9f6; padding: 40px 16px; margin: 0; color: #222222;">
  <div style="max-width: 580px; margin: 0 auto; background: #ffffff; padding: 48px 32px; border: 1px solid #eae6df; border-radius: 4px;">
    <div style="text-align: center; border-bottom: 2px solid #222222; padding-bottom: 24px; margin-bottom: 32px;">
      <h1 style="margin: 0; font-size: 26px; font-weight: normal; letter-spacing: 0.05em; font-family: sans-serif; color: #111827;">✨ ${campaignTitle}</h1>
      <p style="margin: 8px 0 0 0; font-size: 14px; font-style: italic; color: #666666;">${campaignSubtitle}</p>
    </div>
    <div style="line-height: 1.8; font-size: 15px; color: #334155;">
      <p style="margin: 0 0 20px 0;">Dear {customer_name},</p>
      <p style="margin: 0 0 24px 0; white-space: pre-line;">${campaignBody}</p>
      
      <div style="text-align: center; margin: 40px 0;">
        <a href="${campaignCtaUrl}" style="background: #222222; color: #ffffff; text-decoration: none; padding: 12px 32px; font-weight: bold; font-size: 13px; display: inline-block; letter-spacing: 0.1em; text-transform: uppercase; border-radius: 4px;">${campaignCtaText}</a>
      </div>
    </div>
  </div>
</div>`;
    }

    if (campaignTemplate === "bold") {
      return `<div style="font-family: sans-serif; background: #fef2f2; padding: 32px 16px; margin: 0;">
  <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 2px solid #ef4444; overflow: hidden; box-shadow: 0 4px 12px rgba(239,68,68,0.08);">
    <div style="background: #ef4444; padding: 32px 24px; text-align: center; color: #ffffff;">
      <h1 style="margin: 0; font-size: 24px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em;">🔥 ${campaignTitle}</h1>
      <p style="margin: 8px 0 0 0; font-size: 14px; font-weight: bold; opacity: 0.95;">${campaignSubtitle}</p>
    </div>
    <div style="padding: 32px 24px; color: #1e293b; line-height: 1.6; font-size: 14px;">
      <p style="margin: 0 0 20px 0; font-weight: bold;">Attention {customer_name},</p>
      <p style="margin: 0 0 24px 0; white-space: pre-line;">${campaignBody}</p>
      
      <div style="text-align: center; margin: 32px 0;">
        <a href="${campaignCtaUrl}" style="background: #ef4444; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 6px; font-weight: bold; font-size: 14px; display: inline-block; text-transform: uppercase; box-shadow: 0 4px 6px rgba(239,68,68,0.2);">${campaignCtaText}</a>
      </div>
    </div>
  </div>
</div>`;
    }

    // Default: classic sports brand promo
    return `<div style="font-family: sans-serif; background: #f8fafc; padding: 32px 16px; margin: 0;">
  <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
    <div style="background: ${campaignAccentColor}; padding: 32px 24px; text-align: center; color: #ffffff;">
      <h1 style="margin: 0; font-size: 26px; font-weight: bold;">🏈 ${campaignTitle}</h1>
      <p style="margin: 8px 0 0 0; font-size: 15px; opacity: 0.95;">${campaignSubtitle}</p>
    </div>
    <div style="padding: 32px 24px; color: #334155; line-height: 1.6; font-size: 14px;">
      <p style="margin: 0 0 20px 0;">Hello {customer_name},</p>
      <p style="margin: 0 0 24px 0; white-space: pre-line;">${campaignBody}</p>
      
      <div style="text-align: center; margin: 32px 0;">
        <a href="${campaignCtaUrl}" style="background: ${campaignAccentColor}; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: bold; font-size: 14px; display: inline-block; box-shadow: 0 4px 6px rgba(13,148,136,0.15);">${campaignCtaText}</a>
      </div>
    </div>
  </div>
</div>`;
  };

  const handleCreateCampaign = async () => {
    const compiledHtml = compileCampaignHtml();
    
    if (!campaignName || !campaignSubject || !compiledHtml) {
      showStatus("❌ Please fill in all campaign setup parameters.", "error");
      return;
    }
    
    setLoading(true);
    try {
      const payload = {
        name: campaignName,
        subject: campaignSubject,
        body_html: compiledHtml,
        store_id: campaignAudience === "all" ? "WaiRaiders Store" : campaignAudience,
        scheduled_at: campaignSchedule === "later" && campaignScheduledAt ? new Date(campaignScheduledAt).toISOString() : null
      };

      const res = await fetch(`${API_BASE}/api/marketing/campaigns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        showStatus(campaignSchedule === "later" 
          ? "✔️ Campaign scheduled for delayed send successfully!" 
          : "✔️ Campaign draft saved successfully!", "success");
        setCampaignModalOpen(false);
        setCampaignName("");
        setCampaignSubject("");
        setCampaignTitle("🏈 WaiRaiders Jersey Special!");
        setCampaignSubtitle("Get 25% off our exclusive custom drops this weekend only.");
        setCampaignBody("We are excited to share our latest premium custom NFL jersey mockups. Tailored with high-durability fabrics, bold colors, and customized lettering, these designs are ready to elevate your team spirit in style.");
        setCampaignCtaText("🛍️ Shop Jersey Collection");
        setCampaignCtaUrl("https://wairaiders.com/shop");
        setCampaignAccentColor("#0d9488");
        setCampaignSchedule("now");
        setCampaignScheduledAt("");
        loadCampaigns();
      } else {
        showStatus("❌ Failed to compile and save campaign.", "error");
      }
    } catch (err) {
      showStatus("❌ Network error connecting to API.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTemplate = async () => {
    if (!newTemplate.name || !newTemplate.subject || !newTemplate.body_html) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/marketing/templates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newTemplate),
      });
      if (res.ok) {
        showStatus("✔️ Template saved successfully!", "success");
        setTemplateModalOpen(false);
        setNewTemplate({ name: "", subject: "", body_html: "", store_id: "WaiRaiders Store" });
        loadTemplates();
      } else {
        showStatus("❌ Failed to save template.", "error");
      }
    } catch (err) {
      showStatus("❌ Network error connecting to API.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleTriggerSend = async (campaignId: number) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/marketing/campaigns/${campaignId}/send`, {
        method: "POST",
      });
      if (res.ok) {
        showStatus("🚀 Campaign queued in background successfully!", "success");
        loadCampaigns();
      } else {
        showStatus("❌ Failed to queue campaign send.", "error");
      }
    } catch (err) {
      showStatus("❌ Network error connecting to API.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleCsvImport = async () => {
    if (!csvText.trim()) return;
    setLoading(true);
    try {
      const rows = csvText.split("\n").map(r => r.split(","));
      const contactsToImport = [];
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (row && row.length >= 1 && row[0]) {
          const email = row[0].trim();
          if (email) {
            contactsToImport.push({
              email: email,
              first_name: row[1] ? row[1].trim() : "",
              last_name: row[2] ? row[2].trim() : "",
              consent_source: "csv_import"
            });
          }
        }
      }

      const res = await fetch(`${API_BASE}/api/marketing/contacts/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contacts: contactsToImport, store_id: "WaiRaiders Store" }),
      });
      if (res.ok) {
        const result = await res.json();
        showStatus(`✔️ Sync complete! Created ${result.created}, updated ${result.updated}.`, "success");
        setImportModalOpen(false);
        setCsvText("");
        loadContacts();
      } else {
        showStatus("❌ CSV import failed.", "error");
      }
    } catch (err) {
      showStatus("❌ Network error connecting to API.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ paddingBottom: 40 }}>
      {/* Navigation tabs */}
      <div className="card" style={{ marginBottom: 24, padding: 12 }}>
        <div style={{ display: "flex", gap: 8, overflowX: "auto" }}>
          <button className={`btn ${activeTab === "campaigns" ? "btn-primary" : "btn-secondary"}`} onClick={() => setActiveTab("campaigns")}>
            📧 Marketing Campaigns
          </button>
          <button className={`btn ${activeTab === "contacts" ? "btn-primary" : "btn-secondary"}`} onClick={() => setActiveTab("contacts")}>
            👥 Audience Contacts
          </button>
          <button className={`btn ${activeTab === "templates" ? "btn-primary" : "btn-secondary"}`} onClick={() => setActiveTab("templates")}>
            📝 Email Templates
          </button>
          <button className={`btn ${activeTab === "senders" ? "btn-primary" : "btn-secondary"}`} onClick={() => setActiveTab("senders")}>
            🔧 Mapped Domains & Workers
          </button>
        </div>
      </div>

      {message && (
        <div style={{ 
          fontSize: 13, 
          fontWeight: "500", 
          padding: "10px 16px", 
          borderRadius: 6, 
          marginBottom: 20,
          background: messageType === "success" ? "#d1fae5" : "#fee2e2",
          color: messageType === "success" ? "#065f46" : "#991b1b"
        }}>
          {message}
        </div>
      )}

      {/* Campaigns Section */}
      {activeTab === "campaigns" && (
        <div className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">Outbound Marketing Campaigns</h2>
              <p style={{ margin: "4px 0 0 0", color: "var(--text-secondary)", fontSize: 13 }}>
                Design promotional templates, target audience lists, and schedule high-delivery marketing campaigns.
              </p>
            </div>
            <button className="btn btn-primary" onClick={() => setCampaignModalOpen(true)}>➕ Create Campaign</button>
          </div>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Campaign Name</th>
                  <th>Subject Line</th>
                  <th>Timeline Status</th>
                  <th>Recipient Count</th>
                  <th>Scheduled Send Time</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", color: "var(--text-secondary)", padding: 24 }}>No campaigns found. Create one to get started!</td>
                  </tr>
                ) : (
                  campaigns.map((c) => (
                    <tr key={c.id}>
                      <td style={{ fontWeight: 600 }}>{c.name}</td>
                      <td style={{ fontSize: 13, color: "var(--text-secondary)" }}>{c.subject}</td>
                      <td>
                        <span className={`badge ${
                          c.status === "completed" ? "badge-success" : 
                          c.status === "sending" ? "badge-info" : 
                          c.status === "scheduled" ? "badge-warning" : "badge-secondary"
                        }`}>
                          {c.status.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ fontFamily: "monospace" }}>{c.sent_count}</td>
                      <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                        {c.scheduled_at ? new Date(c.scheduled_at).toLocaleString() : "Immediate"}
                      </td>
                      <td>
                        {c.status === "draft" && (
                          <button className="btn btn-primary" style={{ padding: "4px 8px", fontSize: 12 }} onClick={() => handleTriggerSend(c.id)} disabled={loading}>
                            🚀 Send Now
                          </button>
                        )}
                        {c.status === "scheduled" && (
                          <span style={{ fontSize: 12, color: "var(--warning)", fontWeight: 500 }}>⏳ Queued in Worker</span>
                        )}
                        {c.status === "completed" && (
                          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>✔️ Dispatched</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Contacts Section */}
      {activeTab === "contacts" && (
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Audience Contacts & Consent Sync</h2>
            <button className="btn btn-primary" onClick={() => setImportModalOpen(true)}>📥 Import CSV</button>
          </div>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Email</th>
                  <th>First Name</th>
                  <th>Last Name</th>
                  <th>Consent Status</th>
                  <th>Opt-in Source</th>
                </tr>
              </thead>
              <tbody>
                {contacts.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: "center", color: "var(--text-secondary)", padding: 24 }}>No audience contacts found. Import a subscriber CSV list!</td>
                  </tr>
                ) : (
                  contacts.map((c) => (
                    <tr key={c.id}>
                      <td style={{ fontWeight: 500 }}>{c.email}</td>
                      <td>{c.first_name || "-"}</td>
                      <td>{c.last_name || "-"}</td>
                      <td>
                        <span className={`badge ${
                          c.consent_status === "subscribed" ? "badge-success" : "badge-error"
                        }`}>
                          {c.consent_status}
                        </span>
                      </td>
                      <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>{c.consent_source}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Templates Section */}
      {activeTab === "templates" && (
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Email Templates</h2>
            <button className="btn btn-primary" onClick={() => setTemplateModalOpen(true)}>➕ Add Template</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16, marginTop: 16 }}>
            {templates.length === 0 ? (
              <div style={{ gridColumn: "1/-1", textAlign: "center", color: "var(--text-secondary)", padding: 24 }}>No templates found.</div>
            ) : (
              templates.map((t) => (
                <div key={t.id} className="card" style={{ border: "1px solid var(--border-default)", padding: 16, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                  <div>
                    <h3 style={{ margin: "0 0 8px 0", fontSize: 16, fontWeight: 600 }}>{t.name}</h3>
                    <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>Subject: {t.subject}</div>
                    <div style={{ background: "var(--bg-secondary)", borderRadius: 6, padding: 8, height: 100, overflow: "hidden", fontSize: 11, fontFamily: "monospace", color: "var(--text-secondary)", marginBottom: 12 }}>
                      {t.body_html.substring(0, 150)}...
                    </div>
                  </div>
                  <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
                    <button 
                      className="btn btn-secondary" 
                      style={{ padding: "4px 10px", fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}
                      onClick={() => {
                        setPreviewTemplate(t);
                        setPreviewModalOpen(true);
                      }}
                    >
                      👁️ Preview Template
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Redirect settings Tab */}
      {activeTab === "senders" && (
        <div className="card" style={{ padding: "48px 24px", textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🌐</div>
          <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, color: "var(--text-primary)" }}>
            Sender Domains & Workers have moved!
          </h3>
          <p style={{ color: "var(--text-secondary)", fontSize: 14, maxWidth: 480, margin: "0 auto 24px auto", lineHeight: "1.5" }}>
            All outbound email senders, Cloudflare Workers bindings, verified domains, and DNS records are now managed globally within Settings to serve both marketing campaigns and ticket automations across your whole storefront.
          </p>
          <a href="/settings" className="btn btn-primary" style={{ display: "inline-flex", fontWeight: "bold" }}>
            🔧 Configure Global Senders in Settings ➔
          </a>
        </div>
      )}

      {/* Visual Email Campaign Builder Modal */}
      {campaignModalOpen && (
        <div className="upload-modal-overlay" onClick={() => setCampaignModalOpen(false)}>
          <div className="upload-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 1080, width: "95vw" }}>
            <div className="upload-modal-header">
              <div className="upload-modal-title">📧 Visual Outbound Campaign Composer</div>
              <button className="upload-modal-close" onClick={() => setCampaignModalOpen(false)}>✕</button>
            </div>
            
            <div className="upload-modal-body" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, padding: "16px 20px" }}>
              {/* Left Column: Visual Settings & Fields */}
              <div style={{ display: "flex", flexDirection: "column", gap: 16, overflowY: "auto", maxHeight: "70vh", paddingRight: 10 }}>
                
                {/* 1. Basic Title Info */}
                <div style={{ borderBottom: "1px solid var(--border-default)", paddingBottom: 12 }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 600 }}>Campaign Name (Internal Ref)</label>
                    <input className="input" placeholder="e.g. WaiRaiders Season Opener Promo" value={campaignName} onChange={(e) => setCampaignName(e.target.value)} />
                  </div>
                  <div className="form-group" style={{ marginTop: 10 }}>
                    <label className="form-label" style={{ fontWeight: 600 }}>Email Subject Line</label>
                    <input className="input" placeholder="Exclusive gametime jersey drops inside!" value={campaignSubject} onChange={(e) => setCampaignSubject(e.target.value)} />
                  </div>
                </div>

                {/* 2. Choose Marketing template */}
                <div>
                  <label className="form-label" style={{ fontWeight: 600, display: "block", marginBottom: 8 }}>Choose Campaign Layout Style</label>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div 
                      onClick={() => setCampaignTemplate("promo")}
                      style={{ 
                        border: `2px solid ${campaignTemplate === "promo" ? "var(--accent)" : "var(--border-default)"}`,
                        borderRadius: 8, padding: 12, cursor: "pointer", background: "var(--bg-secondary)"
                      }}
                    >
                      <div style={{ fontWeight: 600, fontSize: 13 }}>🏈 Sports Promo</div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>Bold team-color headers, central CTA buttons, clean grids.</div>
                    </div>

                    <div 
                      onClick={() => setCampaignTemplate("elegant")}
                      style={{ 
                        border: `2px solid ${campaignTemplate === "elegant" ? "var(--accent)" : "var(--border-default)"}`,
                        borderRadius: 8, padding: 12, cursor: "pointer", background: "var(--bg-secondary)"
                      }}
                    >
                      <div style={{ fontWeight: 600, fontSize: 13 }}>✨ Minimalist Sleek</div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>Serif typography, clean lines, elegant signature signatures.</div>
                    </div>

                    <div 
                      onClick={() => setCampaignTemplate("bold")}
                      style={{ 
                        border: `2px solid ${campaignTemplate === "bold" ? "var(--accent)" : "var(--border-default)"}`,
                        borderRadius: 8, padding: 12, cursor: "pointer", background: "var(--bg-secondary)"
                      }}
                    >
                      <div style={{ fontWeight: 600, fontSize: 13 }}>🔥 Bold Alert</div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>Urgency warning theme, high-contrast, bold action layouts.</div>
                    </div>

                    <div 
                      onClick={() => setCampaignTemplate("custom")}
                      style={{ 
                        border: `2px solid ${campaignTemplate === "custom" ? "var(--accent)" : "var(--border-default)"}`,
                        borderRadius: 8, padding: 12, cursor: "pointer", background: "var(--bg-secondary)"
                      }}
                    >
                      <div style={{ fontWeight: 600, fontSize: 13 }}>📝 Custom HTML</div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>Standard HTML builder for custom newsletters envelopes.</div>
                    </div>
                  </div>
                </div>

                {/* 3. Dynamic Template Fields */}
                {campaignTemplate !== "custom" ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12, background: "var(--bg-secondary)", padding: 14, borderRadius: 8, border: "1px solid var(--border-default)" }}>
                    <div style={{ fontSize: 12, fontWeight: "bold", color: "var(--accent)", textTransform: "uppercase" }}>Layout Content parameters</div>
                    
                    <div className="form-group">
                      <label className="form-label">Email Header Title</label>
                      <input className="input" value={campaignTitle} onChange={(e) => setCampaignTitle(e.target.value)} />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Email Header Subheading</label>
                      <input className="input" value={campaignSubtitle} onChange={(e) => setCampaignSubtitle(e.target.value)} />
                    </div>

                    {campaignTemplate === "promo" && (
                      <div className="form-group">
                        <label className="form-label">Accent / Brand Color</label>
                        <input className="input" type="color" value={campaignAccentColor} onChange={(e) => setCampaignAccentColor(e.target.value)} style={{ height: 38, padding: "2px 6px", cursor: "pointer" }} />
                      </div>
                    )}

                    <div className="form-group">
                      <label className="form-label">Main Body Content Copy</label>
                      <textarea className="input" value={campaignBody} onChange={(e) => setCampaignBody(e.target.value)} style={{ minHeight: 100, fontSize: 13, resize: "vertical" }} />
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <div className="form-group">
                        <label className="form-label">CTA Button Label</label>
                        <input className="input" value={campaignCtaText} onChange={(e) => setCampaignCtaText(e.target.value)} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">CTA Link URL</label>
                        <input className="input" value={campaignCtaUrl} onChange={(e) => setCampaignCtaUrl(e.target.value)} />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="form-group">
                    <label className="form-label">Message HTML Content Editor</label>
                    <textarea 
                      className="input" 
                      placeholder="Type custom responsive newsletter HTML envelopes..." 
                      value={campaignBody} 
                      onChange={(e) => setCampaignBody(e.target.value)} 
                      style={{ minHeight: 220, fontFamily: "monospace", fontSize: 12 }} 
                    />
                  </div>
                )}

                {/* 4. Audience Segment */}
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600 }}>Target Campaign Audience</label>
                  <select className="input" value={campaignAudience} onChange={(e) => setCampaignAudience(e.target.value)} style={{ padding: "8px 12px" }}>
                    <option value="all">👥 All Subscribed Contacts (Global Segments)</option>
                    <option value="WaiRaiders Store">🏈 WaiRaiders Store Audience Only</option>
                    <option value="Vulius Store">🎽 Vulius Store Audience Only</option>
                  </select>
                </div>

                {/* 5. Schedule / Send Timeline */}
                <div style={{ borderTop: "1px solid var(--border-default)", paddingTop: 16 }}>
                  <label className="form-label" style={{ fontWeight: 600, display: "block", marginBottom: 8 }}>Schedule Delivery Timeline</label>
                  <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
                    <button 
                      className={`btn ${campaignSchedule === "now" ? "btn-primary" : "btn-secondary"}`} 
                      style={{ flex: 1, fontSize: 13, padding: "8px 12px" }}
                      onClick={() => setCampaignSchedule("now")}
                    >
                      🚀 Send Immediately
                    </button>
                    <button 
                      className={`btn ${campaignSchedule === "later" ? "btn-primary" : "btn-secondary"}`} 
                      style={{ flex: 1, fontSize: 13, padding: "8px 12px" }}
                      onClick={() => setCampaignSchedule("later")}
                    >
                      ⏳ Schedule for Later
                    </button>
                  </div>

                  {campaignSchedule === "later" && (
                    <div className="form-group" style={{ background: "var(--bg-secondary)", padding: 12, borderRadius: 6, border: "1px solid var(--border-default)" }}>
                      <label className="form-label" style={{ fontWeight: 500 }}>Select High-Conversion Send Time</label>
                      <input 
                        className="input" 
                        type="datetime-local" 
                        value={campaignScheduledAt} 
                        onChange={(e) => setCampaignScheduledAt(e.target.value)} 
                        style={{ padding: "4px 8px" }}
                      />
                      <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                        Campaign will automatically dispatch using your background queues at this exact timeframe.
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Live Mobile/Responsive Preview */}
              <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
                <label className="form-label" style={{ fontWeight: 600 }}>Real-Time Responsive Campaign Preview</label>
                <div style={{ 
                  flex: 1, 
                  border: "1px solid var(--border-default)", 
                  borderRadius: 12, 
                  background: "#f1f5f9", 
                  padding: 20, 
                  display: "flex", 
                  justifyContent: "center", 
                  alignItems: "center",
                  minHeight: 400
                }}>
                  <div style={{ 
                    width: "100%", 
                    maxWidth: 480, 
                    height: "100%", 
                    maxHeight: 520, 
                    background: "#ffffff", 
                    borderRadius: 8, 
                    boxShadow: "0 8px 24px rgba(0,0,0,0.06)", 
                    overflowY: "auto",
                    border: "1px solid var(--border-default)"
                  }}>
                    {/* Render dynamically compiled HTML preview */}
                    <div dangerouslySetInnerHTML={{ __html: compileCampaignHtml() }} />
                  </div>
                </div>
              </div>
            </div>

            <div className="upload-modal-footer">
              <button className="btn btn-secondary" onClick={() => setCampaignModalOpen(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleCreateCampaign} disabled={loading}>
                {campaignSchedule === "later" ? "💾 Schedule Outbound Campaign" : "🚀 Create Campaign Draft"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Template Modal */}
      {templateModalOpen && (
        <div className="upload-modal-overlay" onClick={() => setTemplateModalOpen(false)}>
          <div className="upload-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 600 }}>
            <div className="upload-modal-header">
              <div className="upload-modal-title">📝 Add Email Template</div>
              <button className="upload-modal-close" onClick={() => setTemplateModalOpen(false)}>✕</button>
            </div>
            <div className="upload-modal-body">
              <div className="form-group">
                <label className="form-label">Template Name</label>
                <input className="input" placeholder="Cart Recovery Layout" value={newTemplate.name} onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Default Subject Line</label>
                <input className="input" placeholder="Did you miss this?" value={newTemplate.subject} onChange={(e) => setNewTemplate({ ...newTemplate, subject: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Template HTML Content</label>
                <textarea className="input" placeholder="<h1>Branded Title</h1>\n<p>Body copy here...</p>" value={newTemplate.body_html} onChange={(e) => setNewTemplate({ ...newTemplate, body_html: e.target.value })} style={{ minHeight: 200, fontFamily: "monospace", fontSize: 13 }} />
              </div>
            </div>
            <div className="upload-modal-footer">
              <button className="btn btn-secondary" onClick={() => setTemplateModalOpen(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleCreateTemplate} disabled={loading}>
                💾 Save Template
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CSV Import Modal */}
      {importModalOpen && (
        <div className="upload-modal-overlay" onClick={() => setImportModalOpen(false)}>
          <div className="upload-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 500 }}>
            <div className="upload-modal-header">
              <div className="upload-modal-title">📥 Import Contact List (CSV)</div>
              <button className="upload-modal-close" onClick={() => setImportModalOpen(false)}>✕</button>
            </div>
            <div className="upload-modal-body">
              <div className="form-group">
                <label className="form-label">CSV Content (Header: <code>email,first_name,last_name</code>)</label>
                <textarea 
                  className="input" 
                  placeholder="email,first_name,last_name&#13;luke@example.com,Luke,Pham&#13;john@example.com,John,Doe" 
                  value={csvText} 
                  onChange={(e) => setCsvText(e.target.value)} 
                  style={{ minHeight: 180, fontFamily: "monospace", fontSize: 12 }} 
                />
              </div>
            </div>
            <div className="upload-modal-footer">
              <button className="btn btn-secondary" onClick={() => setImportModalOpen(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleCsvImport} disabled={loading}>
                🔄 Sync Contacts
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Template Modal */}
      {previewModalOpen && previewTemplate && (
        <div className="upload-modal-overlay" onClick={() => setPreviewModalOpen(false)}>
          <div className="upload-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 680, width: "90vw" }}>
            <div className="upload-modal-header">
              <div className="upload-modal-title">👁️ Preview: {previewTemplate.name}</div>
              <button className="upload-modal-close" onClick={() => setPreviewModalOpen(false)}>✕</button>
            </div>
            <div className="upload-modal-body" style={{ padding: "20px 24px" }}>
              <div style={{ marginBottom: 16, borderBottom: "1px solid var(--border-default)", paddingBottom: 12 }}>
                <strong style={{ color: "var(--text-primary)" }}>Subject Line:</strong> <span style={{ color: "var(--text-secondary)", marginLeft: 6 }}>{previewTemplate.subject}</span>
              </div>
              <div style={{ 
                border: "1px solid var(--border-default)", 
                borderRadius: 12, 
                background: "#f1f5f9", 
                padding: 16, 
                display: "flex", 
                justifyContent: "center"
              }}>
                <div style={{ 
                  width: "100%", 
                  maxWidth: 600, 
                  background: "#ffffff", 
                  borderRadius: 8, 
                  boxShadow: "0 4px 12px rgba(0,0,0,0.05)", 
                  maxHeight: 480,
                  overflowY: "auto",
                  border: "1px solid var(--border-default)"
                }}>
                  {/* Render template HTML directly */}
                  <div dangerouslySetInnerHTML={{ __html: previewTemplate.body_html.replace("{customer_name}", "John Doe") }} />
                </div>
              </div>
            </div>
            <div className="upload-modal-footer">
              <button className="btn btn-secondary" onClick={() => setPreviewModalOpen(false)}>Close Preview</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
