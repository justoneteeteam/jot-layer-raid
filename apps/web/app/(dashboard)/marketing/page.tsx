"use client";

import { useState, useEffect } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Campaign {
  id: number;
  name: string;
  subject: string;
  body_html: string;
  status: "draft" | "sending" | "completed";
  sent_count: number;
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

interface SenderIdentity {
  id?: number;
  store_id: string;
  provider: "cloudflare" | "resend" | "ses" | "smtp";
  from_name: string;
  from_email: string;
  reply_to_email?: string;
  domain: string;
  status: "pending" | "verified" | "active" | "disabled";
  provider_config_ref?: string;
}

export default function MarketingPage() {
  const [activeTab, setActiveTab] = useState<"campaigns" | "contacts" | "templates" | "senders">("campaigns");
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [senders, setSenders] = useState<SenderIdentity[]>([]);
  
  // Modals and Forms
  const [campaignModalOpen, setCampaignModalOpen] = useState(false);
  const [newCampaign, setNewCampaign] = useState({ name: "", subject: "", body_html: "", store_id: "WaiRaiders Store" });
  
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [newTemplate, setNewTemplate] = useState({ name: "", subject: "", body_html: "", store_id: "WaiRaiders Store" });
  
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [csvText, setCsvText] = useState("");

  const [senderModalOpen, setSenderModalOpen] = useState(false);
  const [editSenderId, setEditSenderId] = useState<number | null>(null);
  const [newSender, setNewSender] = useState<SenderIdentity>({
    store_id: "WaiRaiders Store",
    provider: "cloudflare",
    from_name: "",
    from_email: "",
    reply_to_email: "",
    domain: "",
    status: "active",
    provider_config_ref: ""
  });
  
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

  const loadSenders = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/marketing/senders`);
      if (res.ok) setSenders(await res.json());
    } catch (err) {
      console.error("Failed to load sender identities", err);
    }
  };

  useEffect(() => {
    loadCampaigns();
    loadTemplates();
    loadContacts();
    loadSenders();
  }, []);

  const showStatus = (msg: string, type: "success" | "error") => {
    setMessage(msg);
    setMessageType(type);
    setTimeout(() => setMessage(""), 5000);
  };

  const handleCreateCampaign = async () => {
    if (!newCampaign.name || !newCampaign.subject || !newCampaign.body_html) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/marketing/campaigns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newCampaign),
      });
      if (res.ok) {
        showStatus("✔️ Campaign created successfully!", "success");
        setCampaignModalOpen(false);
        setNewCampaign({ name: "", subject: "", body_html: "", store_id: "WaiRaiders Store" });
        loadCampaigns();
      } else {
        showStatus("❌ Failed to create campaign.", "error");
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

  const handleSaveSender = async () => {
    if (!newSender.from_email || !newSender.domain || !newSender.from_name) {
      showStatus("❌ Please fill in required sender parameters.", "error");
      return;
    }
    setLoading(true);
    try {
      const payload = {
        ...newSender,
        id: editSenderId || undefined
      };
      const res = await fetch(`${API_BASE}/api/marketing/senders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        showStatus("✔️ Sender identity successfully verified and active!", "success");
        setSenderModalOpen(false);
        setEditSenderId(null);
        setNewSender({
          store_id: "WaiRaiders Store",
          provider: "cloudflare",
          from_name: "",
          from_email: "",
          reply_to_email: "",
          domain: "",
          status: "active",
          provider_config_ref: ""
        });
        loadSenders();
      } else {
        showStatus("❌ Failed to save sender identity configuration.", "error");
      }
    } catch (err) {
      showStatus("❌ Network error connecting to API.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSender = async (id: number) => {
    if (!confirm("Are you sure you want to remove this domain sender identity?")) return;
    try {
      const res = await fetch(`${API_BASE}/api/marketing/senders/${id}`, {
        method: "DELETE"
      });
      if (res.ok) {
        showStatus("🗑️ Sender identity removed successfully.", "success");
        loadSenders();
      } else {
        showStatus("❌ Failed to remove sender identity.", "error");
      }
    } catch (err) {
      showStatus("❌ Network error connecting to API.", "error");
    }
  };

  const handleEditSender = (s: SenderIdentity) => {
    setEditSenderId(s.id || null);
    setNewSender({
      store_id: s.store_id,
      provider: s.provider,
      from_name: s.from_name,
      from_email: s.from_email,
      reply_to_email: s.reply_to_email || "",
      domain: s.domain,
      status: s.status,
      provider_config_ref: s.provider_config_ref || ""
    });
    setSenderModalOpen(true);
  };

  const handleApplyTemplate = (temp: Template) => {
    setNewCampaign({
      ...newCampaign,
      subject: temp.subject,
      body_html: temp.body_html
    });
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
            🔧 Sender Domains & Workers
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
            <h2 className="card-title">Outbound Marketing Campaigns</h2>
            <button className="btn btn-primary" onClick={() => setCampaignModalOpen(true)}>➕ Create Campaign</button>
          </div>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Campaign Name</th>
                  <th>Subject Line</th>
                  <th>Status</th>
                  <th>Recipient Count</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: "center", color: "var(--text-secondary)", padding: 24 }}>No campaigns found. Create one to get started!</td>
                  </tr>
                ) : (
                  campaigns.map((c) => (
                    <tr key={c.id}>
                      <td style={{ fontWeight: 500 }}>{c.name}</td>
                      <td style={{ fontSize: 13, color: "var(--text-secondary)" }}>{c.subject}</td>
                      <td>
                        <span className={`badge ${
                          c.status === "completed" ? "badge-success" : 
                          c.status === "sending" ? "badge-info" : "badge-warning"
                        }`}>
                          {c.status.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ fontFamily: "monospace" }}>{c.sent_count}</td>
                      <td>
                        {c.status === "draft" && (
                          <button className="btn btn-primary" style={{ padding: "4px 8px", fontSize: 12 }} onClick={() => handleTriggerSend(c.id)} disabled={loading}>
                            🚀 Send Now
                          </button>
                        )}
                        {c.status !== "draft" && (
                          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Dispatched</span>
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
                <div key={t.id} className="card" style={{ border: "1px solid var(--border-default)", padding: 16 }}>
                  <h3 style={{ margin: "0 0 8px 0", fontSize: 16, fontWeight: 600 }}>{t.name}</h3>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>Subject: {t.subject}</div>
                  <div style={{ background: "var(--bg-secondary)", borderRadius: 6, padding: 8, height: 100, overflow: "hidden", fontSize: 11, fontFamily: "monospace", color: "var(--text-secondary)", marginBottom: 12 }}>
                    {t.body_html.substring(0, 150)}...
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Senders Section */}
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

      {/* Create Campaign Modal */}
      {campaignModalOpen && (
        <div className="upload-modal-overlay" onClick={() => setCampaignModalOpen(false)}>
          <div className="upload-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 680 }}>
            <div className="upload-modal-header">
              <div className="upload-modal-title">📧 Create Outbound Campaign</div>
              <button className="upload-modal-close" onClick={() => setCampaignModalOpen(false)}>✕</button>
            </div>
            <div className="upload-modal-body">
              <div className="form-group">
                <label className="form-label">Campaign Name</label>
                <input className="input" placeholder="WaiRaiders Promo Newsletter" value={newCampaign.name} onChange={(e) => setNewCampaign({ ...newCampaign, name: e.target.value })} />
              </div>

              {templates.length > 0 && (
                <div className="form-group" style={{ marginBottom: 16 }}>
                  <label className="form-label" style={{ fontWeight: 600 }}>Apply Prebuilt Template</label>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {templates.map(t => (
                      <button key={t.id} className="btn btn-secondary" style={{ padding: "4px 8px", fontSize: 12 }} onClick={() => handleApplyTemplate(t)}>
                        📄 {t.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Subject Line</label>
                <input className="input" placeholder="Exclusive NFL design drop inside!" value={newCampaign.subject} onChange={(e) => setNewCampaign({ ...newCampaign, subject: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Message HTML Content</label>
                <textarea className="input" placeholder="Type customized HTML template body..." value={newCampaign.body_html} onChange={(e) => setNewCampaign({ ...newCampaign, body_html: e.target.value })} style={{ minHeight: 200, fontFamily: "monospace", fontSize: 13 }} />
              </div>
            </div>
            <div className="upload-modal-footer">
              <button className="btn btn-secondary" onClick={() => setCampaignModalOpen(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleCreateCampaign} disabled={loading}>
                💾 Create Draft
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

      {/* Mapped Domain Sender Modal */}
      {senderModalOpen && (
        <div className="upload-modal-overlay" onClick={() => setSenderModalOpen(false)}>
          <div className="upload-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div className="upload-modal-header">
              <div className="upload-modal-title">🔧 {editSenderId ? "Edit Sender Domain" : "Map Cloudflare Sender Domain"}</div>
              <button className="upload-modal-close" onClick={() => setSenderModalOpen(false)}>✕</button>
            </div>
            <div className="upload-modal-body">
              <div className="form-group">
                <label className="form-label">Store Connection</label>
                <select className="input" value={newSender.store_id} onChange={(e) => setNewSender({ ...newSender, store_id: e.target.value })} style={{ padding: "8px 12px" }}>
                  <option value="WaiRaiders Store">WaiRaiders Store</option>
                  <option value="Vulius Store">Vulius Store</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Sender Display Name</label>
                <input className="input" placeholder="e.g. WaiRaiders Support" value={newSender.from_name} onChange={(e) => setNewSender({ ...newSender, from_name: e.target.value })} />
              </div>

              <div className="form-group">
                <label className="form-label">Outbound Sending Email</label>
                <input className="input" type="email" placeholder="e.g. support@wairaiders.com" value={newSender.from_email} onChange={(e) => setNewSender({ ...newSender, from_email: e.target.value })} />
              </div>

              <div className="form-group">
                <label className="form-label">Inbound Reply-To Email</label>
                <input className="input" type="email" placeholder="e.g. customer@wairaiders.com" value={newSender.reply_to_email} onChange={(e) => setNewSender({ ...newSender, reply_to_email: e.target.value })} />
              </div>

              <div className="form-group">
                <label className="form-label">Outbound Verified Domain</label>
                <input className="input" placeholder="e.g. wairaiders.com" value={newSender.domain} onChange={(e) => setNewSender({ ...newSender, domain: e.target.value })} />
              </div>

              <div className="form-group">
                <label className="form-label">Outbound Gateway Provider</label>
                <select className="input" value={newSender.provider} onChange={(e) => setNewSender({ ...newSender, provider: e.target.value as any })} style={{ padding: "8px 12px" }}>
                  <option value="cloudflare">Cloudflare Workers Binding (paid)</option>
                  <option value="resend">Resend API REST Adapter</option>
                  <option value="smtp">Standard SMTP Gateway</option>
                </select>
              </div>

              {newSender.provider !== "cloudflare" && (
                <div className="form-group">
                  <label className="form-label">{newSender.provider === "resend" ? "Resend API Token" : "SMTP Host String (host:port:user:pass)"}</label>
                  <input className="input" type="password" placeholder={newSender.provider === "resend" ? "re_xxxxxxxxx" : "smtp.server.com:587:user:pass"} value={newSender.provider_config_ref} onChange={(e) => setNewSender({ ...newSender, provider_config_ref: e.target.value })} />
                </div>
              )}
            </div>
            <div className="upload-modal-footer">
              <button className="btn btn-secondary" onClick={() => setSenderModalOpen(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSaveSender} disabled={loading}>
                💾 Save sender Domain
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
