"use client";

import { useState, useEffect, useMemo, useRef } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://api-worker.justoneteeteam.workers.dev";

interface Campaign {
  id: number;
  name: string;
  subject: string;
  body_html: string;
  store_id?: string;
  sender_identity_id?: number;
  sender_name?: string;
  sender_email?: string;
  status: "draft" | "scheduled" | "sending" | "paused" | "completed";
  sent_count: number;
  total_contacts?: number;
  daily_limit: number;
  scheduled_at?: string;
  created_at: string;
}

interface Template {
  id: number;
  name: string;
  subject: string;
  body_html: string;
  store_id?: string;
  created_at?: string;
}

interface Contact {
  id: number;
  store_id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  consent_status: string;
  consent_source: string;
  is_valid?: boolean;
  validation_note?: string;
  created_at?: string;
}

interface SenderIdentity {
  id: number;
  store_id: string;
  provider: string;
  from_name: string;
  from_email: string;
  reply_to_email?: string;
  domain: string;
  status: string;
}

interface ScanResultItem {
  email: string;
  valid: boolean;
  reason?: string;
}

export default function MarketingPage() {
  const [activeTab, setActiveTab] = useState<"campaigns" | "contacts" | "templates" | "senders">("campaigns");
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [senders, setSenders] = useState<SenderIdentity[]>([]);
  
  // Pagination & metrics for Contacts
  const [contactPage, setContactPage] = useState(1);
  const [contactLimit] = useState(50);
  const [contactTotal, setContactTotal] = useState(0);
  const [contactValidCount, setContactValidCount] = useState(0);
  const [contactInvalidCount, setContactInvalidCount] = useState(0);
  const [contactPages, setContactPages] = useState(1);

  // Visual Campaign Builder states
  const [campaignModalOpen, setCampaignModalOpen] = useState(false);
  const [campaignName, setCampaignName] = useState("");
  const [campaignSubject, setCampaignSubject] = useState("");
  
  // Content Source Mode: 'template' | 'upload' | 'builder' | 'raw'
  const [contentSourceMode, setContentSourceMode] = useState<"template" | "upload" | "builder" | "raw">("template");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [attachedFileName, setAttachedFileName] = useState<string>("");
  const [attachedFileSize, setAttachedFileSize] = useState<string>("");
  const [customHtmlContent, setCustomHtmlContent] = useState<string>("");

  const [campaignTemplate, setCampaignTemplate] = useState<"promo" | "elegant" | "bold">("promo");
  const [campaignSenderId, setCampaignSenderId] = useState("");
  const [campaignDailyLimit, setCampaignDailyLimit] = useState(20);
  
  // Visual Builder fields
  const [campaignTitle, setCampaignTitle] = useState("🏈 WaiRaiders Jersey Special!");
  const [campaignSubtitle, setCampaignSubtitle] = useState("Get 25% off our exclusive custom drops this weekend only.");
  const [campaignBody, setCampaignBody] = useState("We are excited to share our latest premium custom NFL jersey mockups. Tailored with high-durability fabrics, bold colors, and customized lettering, these designs are ready to elevate your team spirit in style.");
  const [campaignCtaText, setCampaignCtaText] = useState("🛍️ Shop Jersey Collection");
  const [campaignCtaUrl, setCampaignCtaUrl] = useState("https://wairaiders.com/shop");
  const [campaignAccentColor, setCampaignAccentColor] = useState("#006A38");
  
  // Audience Targeting states
  const [campaignAudience, setCampaignAudience] = useState("all");
  const [campaignSchedule, setCampaignSchedule] = useState<"now" | "later">("now");
  const [campaignScheduledAt, setCampaignScheduledAt] = useState("");

  // Preview device toggle
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");

  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [newTemplate, setNewTemplate] = useState({ name: "", subject: "", body_html: "", store_id: "WaiRaiders Store" });
  
  // CSV Import states & Scanner results
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [scanResults, setScanResults] = useState<ScanResultItem[] | null>(null);
  const [scanSummary, setScanSummary] = useState<{ created: number; updated: number; invalid: number } | null>(null);
  
  // Stats Modal state
  const [statsModalOpen, setStatsModalOpen] = useState(false);
  const [activeCampaignStats, setActiveCampaignStats] = useState<any | null>(null);

  // Preview Modal state
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null);
  
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");

  const fileInputRef = useRef<HTMLInputElement>(null);

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
      if (res.ok) {
        const data = await res.json();
        setTemplates(data);
        if (data.length > 0 && data[0] && !selectedTemplateId) {
          setSelectedTemplateId(String(data[0].id));
          if (!customHtmlContent) {
            setCustomHtmlContent(data[0].body_html);
          }
        }
      }
    } catch (err) {
      console.error("Failed to load templates", err);
    }
  };

  const loadSenders = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/marketing/senders`);
      if (res.ok) {
        const data = await res.json();
        setSenders(data);
        if (data.length > 0 && !campaignSenderId) {
          setCampaignSenderId(String(data[0].id));
        }
      }
    } catch (err) {
      console.error("Failed to load senders", err);
    }
  };

  const loadContacts = async (page: number = contactPage) => {
    try {
      const res = await fetch(`${API_BASE}/api/marketing/contacts?page=${page}&limit=${contactLimit}`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.contacts) {
          setContacts(data.contacts);
          setContactTotal(data.total);
          setContactValidCount(data.valid_count);
          setContactInvalidCount(data.invalid_count);
          setContactPages(data.pages);
          setContactPage(data.page);
        } else if (Array.isArray(data)) {
          setContacts(data);
          setContactTotal(data.length);
          setContactValidCount(data.filter((c: any) => c.is_valid).length);
          setContactInvalidCount(data.filter((c: any) => !c.is_valid).length);
          setContactPages(1);
        }
      }
    } catch (err) {
      console.error("Failed to load contacts", err);
    }
  };

  useEffect(() => {
    loadCampaigns();
    loadTemplates();
    loadSenders();
    loadContacts(1);
  }, []);

  const showStatus = (msg: string, type: "success" | "error") => {
    setMessage(msg);
    setMessageType(type);
    setTimeout(() => setMessage(""), 5000);
  };

  // Audience Filtering & Live Calculation
  const audienceStats = useMemo(() => {
    let filtered = contacts;
    if (campaignAudience === "WaiRaiders Store") {
      filtered = contacts.filter(c => c.store_id === "WaiRaiders Store" || !c.store_id);
    } else if (campaignAudience === "Vulius Store") {
      filtered = contacts.filter(c => c.store_id === "Vulius Store");
    } else if (campaignAudience === "valid_only") {
      filtered = contacts.filter(c => c.is_valid);
    }

    const total = filtered.length > 0 ? filtered.length : contactTotal;
    const valid = filtered.filter(c => c.is_valid !== false).length;
    const invalid = total - valid;
    const sampleEmails = filtered.slice(0, 4).map(c => c.email);

    return { total, valid, invalid, sampleEmails };
  }, [contacts, campaignAudience, contactTotal]);

  // Handle template selection in Composer
  const handleSelectTemplate = (templateId: string) => {
    setSelectedTemplateId(templateId);
    const tmpl = templates.find(t => String(t.id) === templateId);
    if (tmpl) {
      setCustomHtmlContent(tmpl.body_html);
      if (!campaignSubject || campaignSubject === "Exclusive gametime jersey drops inside!") {
        setCampaignSubject(tmpl.subject);
      }
      if (!campaignName) {
        setCampaignName(`${tmpl.name} Campaign`);
      }
    }
  };

  // Handle HTML File Attachment / Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAttachedFileName(file.name);
    setAttachedFileSize((file.size / 1024).toFixed(1) + " KB");

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setCustomHtmlContent(content);
        setContentSourceMode("upload");
        
        // Auto-extract <title> as default subject if empty
        const titleMatch = content.match(/<title>(.*?)<\/title>/i);
        if (titleMatch && titleMatch[1] && (!campaignSubject || campaignSubject === "Exclusive gametime jersey drops inside!")) {
          setCampaignSubject(titleMatch[1].trim());
        }

        if (!campaignName) {
          const cleanName = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
          setCampaignName(cleanName.charAt(0).toUpperCase() + cleanName.slice(1));
        }

        showStatus(`📎 Attached HTML template: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`, "success");
      }
    };
    reader.readAsText(file);
  };

  // Compile final Campaign HTML
  const compileCampaignHtml = () => {
    if (contentSourceMode === "template" || contentSourceMode === "upload" || contentSourceMode === "raw") {
      return customHtmlContent || `<div style="padding: 40px; text-align: center; color: #64748B; font-family: sans-serif;">Select or upload an HTML template to preview.</div>`;
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
        <a href="${campaignCtaUrl}" style="background: ${campaignAccentColor}; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: bold; font-size: 14px; display: inline-block; box-shadow: 0 4px 6px rgba(0,106,56,0.2);">${campaignCtaText}</a>
      </div>
    </div>
  </div>
</div>`;
  };

  const handleOpenComposerWithTemplate = (tmpl: Template) => {
    setSelectedTemplateId(String(tmpl.id));
    setCustomHtmlContent(tmpl.body_html);
    setContentSourceMode("template");
    setCampaignSubject(tmpl.subject);
    setCampaignName(`${tmpl.name} Campaign`);
    setCampaignModalOpen(true);
  };

  const handleCreateCampaign = async () => {
    const compiledHtml = compileCampaignHtml();
    
    if (!campaignName || !campaignSubject || !compiledHtml) {
      showStatus("❌ Please fill in campaign name, subject line, and email template content.", "error");
      return;
    }
    
    setLoading(true);
    try {
      const payload = {
        name: campaignName,
        subject: campaignSubject,
        body_html: compiledHtml,
        store_id: campaignAudience === "all" ? "WaiRaiders Store" : campaignAudience,
        sender_identity_id: campaignSenderId ? parseInt(campaignSenderId, 10) : null,
        daily_limit: campaignDailyLimit || 20,
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
        setAttachedFileName("");
        setAttachedFileSize("");
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
        const result = await res.json();
        showStatus(`🚀 ${result.message || "Campaign queued and initial drip batch dispatched!"}`, "success");
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

  const handleTogglePause = async (campaignId: number) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/marketing/campaigns/${campaignId}/pause`, {
        method: "POST"
      });
      if (res.ok) {
        const result = await res.json();
        showStatus(`✔️ ${result.message}`, "success");
        loadCampaigns();
      } else {
        showStatus("❌ Failed to change campaign status.", "error");
      }
    } catch (err) {
      showStatus("❌ Network error connecting to API.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenStats = async (campaignId: number) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/marketing/campaigns/${campaignId}/stats`);
      if (res.ok) {
        setActiveCampaignStats(await res.json());
        setStatsModalOpen(true);
      } else {
        showStatus("❌ Failed to load campaign statistics.", "error");
      }
    } catch (err) {
      showStatus("❌ Network error fetching stats.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleCsvImport = async () => {
    if (!csvText.trim()) return;
    setLoading(true);
    setScanResults(null);
    setScanSummary(null);
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
        setScanSummary({ created: result.created, updated: result.updated, invalid: result.invalid });
        setScanResults(result.scan_results || []);
        showStatus(`✔️ Sync complete! Created ${result.created}, updated ${result.updated}. ${result.invalid > 0 ? `⚠️ ${result.invalid} invalid/spam trap emails detected.` : 'All emails valid!'}`, "success");
        loadContacts(1);
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
            👥 Audience Contacts ({contactTotal})
          </button>
          <button className={`btn ${activeTab === "templates" ? "btn-primary" : "btn-secondary"}`} onClick={() => setActiveTab("templates")}>
            📝 Email Templates ({templates.length})
          </button>
          <button className={`btn ${activeTab === "senders" ? "btn-primary" : "btn-secondary"}`} onClick={() => setActiveTab("senders")}>
            🔧 Mapped Domains & Workers
          </button>
        </div>
      </div>

      {message && (
        <div style={{ 
          fontSize: 13, 
          padding: "10px 16px", 
          borderRadius: 8, 
          marginBottom: 16,
          background: messageType === "success" ? "#ecfdf5" : "#fef2f2",
          color: messageType === "success" ? "#065f46" : "#991b1b",
          border: `1px solid ${messageType === "success" ? "#a7f3d0" : "#fecaca"}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between"
        }}>
          <div>{message}</div>
          <button onClick={() => setMessage("")} style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", fontWeight: "bold" }}>✕</button>
        </div>
      )}

      {/* Campaigns Section */}
      {activeTab === "campaigns" && (
        <div className="card">
          <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
            <div>
              <h2 className="card-title" style={{ margin: 0 }}>Outbound Marketing Campaigns</h2>
              <p style={{ margin: "4px 0 0 0", fontSize: 13, color: "var(--text-secondary)" }}>
                Drip-feed campaigns with anti-spam deliverability throttle, real jersey attachments & rich HTML templates.
              </p>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-primary" onClick={() => {
                if (templates.length > 0 && templates[0] && !selectedTemplateId) {
                  handleSelectTemplate(String(templates[0].id));
                }
                setCampaignModalOpen(true);
              }}>
                ➕ New Visual Outbound Campaign
              </button>
            </div>
          </div>

          <div style={{ overflowX: "auto", marginTop: 16 }}>
            <table style={{ width: "100%", textAlign: "left", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid var(--border-default)", background: "var(--bg-secondary)" }}>
                  <th style={{ padding: "10px 12px" }}>Campaign Name</th>
                  <th style={{ padding: "10px 12px" }}>Subject Line</th>
                  <th style={{ padding: "10px 12px" }}>Sender Identity</th>
                  <th style={{ padding: "10px 12px" }}>Status</th>
                  <th style={{ padding: "10px 12px" }}>Progress / Limit</th>
                  <th style={{ padding: "10px 12px", textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", padding: 32, color: "var(--text-secondary)" }}>
                      No campaigns created yet. Click <strong>"New Visual Outbound Campaign"</strong> to compose and launch your first jersey campaign!
                    </td>
                  </tr>
                ) : (
                  campaigns.map((c) => (
                    <tr key={c.id} style={{ borderBottom: "1px solid var(--border-default)" }}>
                      <td style={{ padding: "12px", fontWeight: 600 }}>{c.name}</td>
                      <td style={{ padding: "12px", color: "var(--text-secondary)", fontSize: 13 }}>{c.subject}</td>
                      <td style={{ padding: "12px", fontSize: 12 }}>
                        {c.sender_name ? `${c.sender_name} <${c.sender_email}>` : "Default Sender"}
                      </td>
                      <td style={{ padding: "12px" }}>
                        <span className={`badge ${
                          c.status === "completed" ? "badge-success" : 
                          c.status === "sending" ? "badge-info" : 
                          c.status === "paused" ? "badge-warning" : "badge-secondary"
                        }`}>
                          {c.status.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ padding: "12px", fontSize: 12 }}>
                        <div><strong>{c.sent_count}</strong> sent</div>
                        <div style={{ color: "var(--text-muted)", fontSize: 11 }}>Throttle: {c.daily_limit}/day</div>
                      </td>
                      <td style={{ padding: "12px", textAlign: "right" }}>
                        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                          {c.status === "draft" && (
                            <button className="btn btn-primary" style={{ padding: "4px 8px", fontSize: 11 }} onClick={() => handleTriggerSend(c.id)} disabled={loading}>
                              🚀 Start Drip
                            </button>
                          )}
                          {(c.status === "sending" || c.status === "paused") && (
                            <button className="btn btn-secondary" style={{ padding: "4px 8px", fontSize: 11 }} onClick={() => handleTogglePause(c.id)} disabled={loading}>
                              {c.status === "sending" ? "⏸️ Pause" : "▶️ Resume"}
                            </button>
                          )}
                          <button className="btn btn-secondary" style={{ padding: "4px 8px", fontSize: 11 }} onClick={() => handleOpenStats(c.id)} disabled={loading}>
                            📊 Stats
                          </button>
                        </div>
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
          <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
            <div>
              <h2 className="card-title" style={{ margin: 0 }}>Audience Contacts & Subscribers</h2>
              <div style={{ display: "flex", gap: 16, marginTop: 4, fontSize: 13 }}>
                <span style={{ color: "#065f46" }}>✅ {contactValidCount} Valid Deliverable</span>
                <span style={{ color: "#991b1b" }}>⚠️ {contactInvalidCount} Invalid / Unverified</span>
              </div>
            </div>
            <button className="btn btn-primary" onClick={() => setImportModalOpen(true)}>
              📥 Import CSV Contacts
            </button>
          </div>

          <div style={{ overflowX: "auto", marginTop: 16 }}>
            <table style={{ width: "100%", textAlign: "left", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid var(--border-default)", background: "var(--bg-secondary)" }}>
                  <th style={{ padding: "10px 12px" }}>Email</th>
                  <th style={{ padding: "10px 12px" }}>Validation</th>
                  <th style={{ padding: "10px 12px" }}>First Name</th>
                  <th style={{ padding: "10px 12px" }}>Last Name</th>
                  <th style={{ padding: "10px 12px" }}>Consent</th>
                  <th style={{ padding: "10px 12px" }}>Source</th>
                </tr>
              </thead>
              <tbody>
                {contacts.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", padding: 32, color: "var(--text-secondary)" }}>
                      No contacts found. Click <strong>"Import CSV Contacts"</strong> to upload your subscriber list.
                    </td>
                  </tr>
                ) : (
                  contacts.map((c) => (
                    <tr key={c.id} style={{ borderBottom: "1px solid var(--border-default)" }}>
                      <td style={{ padding: "10px 12px", fontWeight: 500 }}>{c.email}</td>
                      <td style={{ padding: "10px 12px" }}>
                        {c.is_valid !== false ? (
                          <span className="badge badge-success" style={{ fontSize: 11 }}>✅ Valid MX</span>
                        ) : (
                          <span className="badge badge-error" style={{ fontSize: 11 }} title={c.validation_note || "Invalid"}>
                            ⚠️ {c.validation_note || "Invalid"}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: "10px 12px" }}>{c.first_name || "-"}</td>
                      <td style={{ padding: "10px 12px" }}>{c.last_name || "-"}</td>
                      <td style={{ padding: "10px 12px" }}>
                        <span className={`badge ${
                          c.consent_status === "subscribed" ? "badge-success" : "badge-error"
                        }`}>
                          {c.consent_status}
                        </span>
                      </td>
                      <td style={{ padding: "10px 12px", fontSize: 12, color: "var(--text-secondary)" }}>{c.consent_source}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {contactPages > 1 && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16, paddingTop: 12, borderTop: "1px solid var(--border-default)" }}>
              <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                Showing page {contactPage} of {contactPages} ({contactTotal} total contacts)
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button 
                  className="btn btn-secondary" 
                  disabled={contactPage <= 1 || loading}
                  onClick={() => loadContacts(contactPage - 1)}
                  style={{ padding: "6px 12px", fontSize: 12 }}
                >
                  ◀ Previous
                </button>
                <span style={{ display: "flex", alignItems: "center", padding: "0 8px", fontSize: 13, fontWeight: 600 }}>
                  {contactPage} / {contactPages}
                </span>
                <button 
                  className="btn btn-secondary" 
                  disabled={contactPage >= contactPages || loading}
                  onClick={() => loadContacts(contactPage + 1)}
                  style={{ padding: "6px 12px", fontSize: 12 }}
                >
                  Next ▶
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Templates Section */}
      {activeTab === "templates" && (
        <div className="card">
          <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
            <div>
              <h2 className="card-title" style={{ margin: 0 }}>Email Templates Library</h2>
              <p style={{ margin: "4px 0 0 0", fontSize: 13, color: "var(--text-secondary)" }}>
                Rich responsive HTML email templates with real database jersey photography and custom brand styles.
              </p>
            </div>
            <button className="btn btn-primary" onClick={() => setTemplateModalOpen(true)}>
              ➕ Add Email Template
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 20, marginTop: 20 }}>
            {templates.length === 0 ? (
              <div style={{ gridColumn: "1/-1", textAlign: "center", color: "var(--text-secondary)", padding: 32 }}>
                No templates found. Click <strong>"Add Email Template"</strong> to create or sync your first template.
              </div>
            ) : (
              templates.map((t) => (
                <div key={t.id} className="card" style={{ border: "1px solid var(--border-default)", padding: 18, display: "flex", flexDirection: "column", justifyContent: "space-between", borderRadius: 10, boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>{t.name}</h3>
                      <span className="badge badge-info" style={{ fontSize: 10 }}>HTML TEMPLATE</span>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>
                      <strong>Subject:</strong> {t.subject}
                    </div>
                    <div style={{ background: "var(--bg-secondary)", borderRadius: 8, padding: 10, height: 110, overflow: "hidden", fontSize: 11, fontFamily: "monospace", color: "var(--text-secondary)", marginBottom: 16, border: "1px solid var(--border-default)" }}>
                      {t.body_html.substring(0, 180)}...
                    </div>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, borderTop: "1px solid var(--border-default)", paddingTop: 12 }}>
                    <button 
                      className="btn btn-secondary" 
                      style={{ padding: "6px 12px", fontSize: 12 }}
                      onClick={() => {
                        setPreviewTemplate(t);
                        setPreviewModalOpen(true);
                      }}
                    >
                      👁️ Preview
                    </button>
                    <button 
                      className="btn btn-primary" 
                      style={{ padding: "6px 12px", fontSize: 12, fontWeight: "bold" }}
                      onClick={() => handleOpenComposerWithTemplate(t)}
                    >
                      🚀 Send Campaign ➔
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Senders Tab */}
      {activeTab === "senders" && (
        <div className="card" style={{ padding: "48px 24px", textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🌐</div>
          <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, color: "var(--text-primary)" }}>
            Sender Domains & Cloudflare Workers Configurations
          </h3>
          <p style={{ color: "var(--text-secondary)", fontSize: 14, maxWidth: 480, margin: "0 auto 24px auto", lineHeight: "1.5" }}>
            All outbound email senders, Cloudflare Workers bindings, verified domains, and DNS records are managed globally within Settings to serve both marketing campaigns and ticket automations across your whole storefront.
          </p>
          <a href="/settings" className="btn btn-primary" style={{ display: "inline-flex", fontWeight: "bold" }}>
            🔧 Configure Global Senders in Settings ➔
          </a>
        </div>
      )}

      {/* ================= VISUAL OUTBOUND CAMPAIGN COMPOSER MODAL ================= */}
      {campaignModalOpen && (
        <div className="upload-modal-overlay" onClick={() => setCampaignModalOpen(false)}>
          <div className="upload-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 1200, width: "96vw", maxHeight: "92vh" }}>
            <div className="upload-modal-header" style={{ borderBottom: "1px solid var(--border-default)", padding: "16px 24px" }}>
              <div>
                <div className="upload-modal-title" style={{ fontSize: 18, fontWeight: 800 }}>📧 Visual Outbound Campaign Composer</div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
                  Compose, attach HTML templates, select target audience lists, and schedule throttled deliveries.
                </div>
              </div>
              <button className="upload-modal-close" onClick={() => setCampaignModalOpen(false)}>✕</button>
            </div>
            
            <div className="upload-modal-body" style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 24, padding: "20px 24px", maxHeight: "calc(92vh - 140px)", overflowY: "auto" }}>
              {/* Left Column: Campaign Setup & Content Parameters */}
              <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                
                {/* 1. Basic Title & Subject */}
                <div style={{ background: "#FFFFFF", padding: 16, borderRadius: 10, border: "1px solid var(--border-default)" }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: "var(--accent)", textTransform: "uppercase", marginBottom: 12, letterSpacing: "0.5px" }}>
                    1. Campaign Identity & Subject
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 600 }}>Campaign Name (Internal Reference)</label>
                    <input className="input" placeholder="e.g. WaiRaiders Custom Super Bowl Jersey Showcase" value={campaignName} onChange={(e) => setCampaignName(e.target.value)} />
                  </div>
                  <div className="form-group" style={{ marginTop: 12 }}>
                    <label className="form-label" style={{ fontWeight: 600 }}>Email Subject Line (Customer Facing)</label>
                    <input className="input" placeholder="Exclusive gametime jersey drops inside!" value={campaignSubject} onChange={(e) => setCampaignSubject(e.target.value)} />
                  </div>
                </div>

                {/* 2. TARGET AUDIENCE & RECIPIENT LIST (PROMINENT IN UI) */}
                <div style={{ background: "#F0FDF4", padding: 16, borderRadius: 10, border: "1px solid #BBF7D0" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: "#166534", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                      🎯 2. Target Audience & Recipient List
                    </div>
                    <span className="badge badge-success" style={{ fontSize: 11, fontWeight: "bold" }}>
                      {audienceStats.valid} Reachable
                    </span>
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 600, color: "#166534" }}>Select Target Segment</label>
                    <select 
                      className="input" 
                      value={campaignAudience} 
                      onChange={(e) => setCampaignAudience(e.target.value)} 
                      style={{ padding: "8px 12px", borderColor: "#86EFAC", background: "#FFFFFF" }}
                    >
                      <option value="all">👥 All Subscribed Contacts (Global Segments - {contactTotal} contacts)</option>
                      <option value="WaiRaiders Store">🏈 WaiRaiders Store Audience Only</option>
                      <option value="Vulius Store">🎽 Vulius Store Audience Only</option>
                      <option value="valid_only">✅ Verified MX Contacts Only ({contactValidCount} valid)</option>
                    </select>
                  </div>

                  {/* Live Audience Metrics Pill Bar */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginTop: 12 }}>
                    <div style={{ background: "#FFFFFF", padding: "8px 10px", borderRadius: 6, border: "1px solid #DCFCE7", textAlign: "center" }}>
                      <div style={{ fontSize: 10, color: "#166534", fontWeight: "bold" }}>TOTAL IN LIST</div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: "#166534" }}>{audienceStats.total}</div>
                    </div>
                    <div style={{ background: "#FFFFFF", padding: "8px 10px", borderRadius: 6, border: "1px solid #DCFCE7", textAlign: "center" }}>
                      <div style={{ fontSize: 10, color: "#15803D", fontWeight: "bold" }}>VALID DELIVERABLE</div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: "#15803D" }}>{audienceStats.valid}</div>
                    </div>
                    <div style={{ background: "#FFFFFF", padding: "8px 10px", borderRadius: 6, border: "1px solid #DCFCE7", textAlign: "center" }}>
                      <div style={{ fontSize: 10, color: "#991B1B", fontWeight: "bold" }}>AUTO-EXCLUDED</div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: "#991B1B" }}>{audienceStats.invalid}</div>
                    </div>
                  </div>

                  {/* Sample Recipients Preview */}
                  {audienceStats.sampleEmails.length > 0 && (
                    <div style={{ marginTop: 10, fontSize: 11, color: "#166534" }}>
                      <strong>Sample Recipients:</strong> {audienceStats.sampleEmails.join(", ")}
                      {audienceStats.total > 4 ? ` + ${audienceStats.total - 4} more` : ""}
                    </div>
                  )}
                </div>

                {/* 3. Sender Identity & Deliverability Throttle */}
                <div style={{ background: "var(--bg-secondary)", padding: 16, borderRadius: 10, border: "1px solid var(--border-default)" }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: "var(--accent)", textTransform: "uppercase", marginBottom: 12, letterSpacing: "0.5px" }}>
                    3. Sender Identity & Deliverability Throttle
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 600 }}>Choose Outbound Email Sender</label>
                    <select 
                      className="input" 
                      value={campaignSenderId} 
                      onChange={(e) => setCampaignSenderId(e.target.value)}
                      style={{ padding: "8px 12px" }}
                    >
                      {senders.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.from_name} &lt;{s.from_email}&gt; ({s.provider.toUpperCase()})
                        </option>
                      ))}
                    </select>
                    {senders.length === 0 && (
                      <div style={{ fontSize: 11, color: "var(--warning)", marginTop: 4 }}>
                        ⚠️ No senders found. Please configure a sender in Settings.
                      </div>
                    )}
                  </div>

                  <div className="form-group" style={{ marginTop: 12 }}>
                    <label className="form-label" style={{ fontWeight: 600 }}>Daily Send Throttle (Emails / Day)</label>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <input 
                        type="number" 
                        className="input" 
                        min={5} 
                        max={200} 
                        value={campaignDailyLimit} 
                        onChange={(e) => setCampaignDailyLimit(Math.max(1, parseInt(e.target.value) || 20))}
                        style={{ width: 100 }}
                      />
                      <div style={{ display: "flex", gap: 6 }}>
                        <button type="button" className={`btn ${campaignDailyLimit === 10 ? 'btn-primary' : 'btn-secondary'}`} style={{ padding: "4px 8px", fontSize: 11 }} onClick={() => setCampaignDailyLimit(10)}>10/d</button>
                        <button type="button" className={`btn ${campaignDailyLimit === 20 ? 'btn-primary' : 'btn-secondary'}`} style={{ padding: "4px 8px", fontSize: 11 }} onClick={() => setCampaignDailyLimit(20)}>20/d</button>
                        <button type="button" className={`btn ${campaignDailyLimit === 50 ? 'btn-primary' : 'btn-secondary'}`} style={{ padding: "4px 8px", fontSize: 11 }} onClick={() => setCampaignDailyLimit(50)}>50/d</button>
                        <button type="button" className={`btn ${campaignDailyLimit === 200 ? 'btn-primary' : 'btn-secondary'}`} style={{ padding: "4px 8px", fontSize: 11 }} onClick={() => setCampaignDailyLimit(200)}>200/d</button>
                      </div>
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                      💡 Start with 10–20/day for domain warmup. Scale to 50–200/day once delivery is steady.
                    </div>
                  </div>
                </div>

                {/* 4. EMAIL CONTENT SOURCE & ATTACHMENT SYNC */}
                <div style={{ background: "#FFFFFF", padding: 16, borderRadius: 10, border: "1px solid var(--border-default)" }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: "var(--accent)", textTransform: "uppercase", marginBottom: 12, letterSpacing: "0.5px" }}>
                    4. Email Template Source & Attachments
                  </div>

                  {/* Mode Tabs */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 16 }}>
                    <button 
                      type="button" 
                      className={`btn ${contentSourceMode === "template" ? "btn-primary" : "btn-secondary"}`}
                      style={{ fontSize: 12, padding: "8px 6px" }}
                      onClick={() => setContentSourceMode("template")}
                    >
                      📁 Saved Templates
                    </button>
                    <button 
                      type="button" 
                      className={`btn ${contentSourceMode === "upload" ? "btn-primary" : "btn-secondary"}`}
                      style={{ fontSize: 12, padding: "8px 6px" }}
                      onClick={() => {
                        setContentSourceMode("upload");
                        fileInputRef.current?.click();
                      }}
                    >
                      📎 Attach HTML File
                    </button>
                    <button 
                      type="button" 
                      className={`btn ${contentSourceMode === "builder" ? "btn-primary" : "btn-secondary"}`}
                      style={{ fontSize: 12, padding: "8px 6px" }}
                      onClick={() => setContentSourceMode("builder")}
                    >
                      🎨 Visual Builder
                    </button>
                    <button 
                      type="button" 
                      className={`btn ${contentSourceMode === "raw" ? "btn-primary" : "btn-secondary"}`}
                      style={{ fontSize: 12, padding: "8px 6px" }}
                      onClick={() => setContentSourceMode("raw")}
                    >
                      ✏️ Raw HTML Code
                    </button>
                  </div>

                  {/* Hidden file input for attachment */}
                  <input 
                    ref={fileInputRef} 
                    type="file" 
                    accept=".html,.htm,.txt" 
                    style={{ display: "none" }} 
                    onChange={handleFileUpload} 
                  />

                  {/* SUB-PANEL A: Saved Templates */}
                  {contentSourceMode === "template" && (
                    <div style={{ background: "var(--bg-secondary)", padding: 14, borderRadius: 8, border: "1px solid var(--border-default)" }}>
                      <div className="form-group">
                        <label className="form-label" style={{ fontWeight: 600 }}>Choose from Synced Email Templates</label>
                        <select 
                          className="input" 
                          value={selectedTemplateId} 
                          onChange={(e) => handleSelectTemplate(e.target.value)}
                          style={{ padding: "8px 12px" }}
                        >
                          {templates.map(t => (
                            <option key={t.id} value={t.id}>
                              {t.name} — ({t.subject})
                            </option>
                          ))}
                        </select>
                        {templates.length === 0 && (
                          <div style={{ fontSize: 12, color: "var(--warning)", marginTop: 6 }}>
                            ⚠️ No saved templates found. You can attach an HTML template file below or use the Visual Builder!
                          </div>
                        )}
                      </div>

                      <div style={{ marginTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                          ✓ Loads full responsive HTML layout with high-res jersey imagery.
                        </span>
                        <button 
                          type="button" 
                          className="btn btn-secondary" 
                          style={{ padding: "4px 8px", fontSize: 11 }}
                          onClick={() => {
                            setContentSourceMode("upload");
                            fileInputRef.current?.click();
                          }}
                        >
                          📎 Attach Local .HTML file instead
                        </button>
                      </div>
                    </div>
                  )}

                  {/* SUB-PANEL B: Attached File info */}
                  {contentSourceMode === "upload" && (
                    <div style={{ background: "#FEF3C7", padding: 16, borderRadius: 8, border: "1px dashed #D97706", textAlign: "center" }}>
                      <div style={{ fontSize: 28, marginBottom: 8 }}>📎</div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: "#92400E" }}>
                        {attachedFileName ? `Attached: ${attachedFileName}` : "Attach Custom HTML Email Template"}
                      </div>
                      {attachedFileSize && (
                        <div style={{ fontSize: 12, color: "#B45309", marginTop: 2 }}>
                          File size: {attachedFileSize} &bull; Synced with live email preview
                        </div>
                      )}
                      <div style={{ marginTop: 12 }}>
                        <button 
                          type="button" 
                          className="btn btn-primary" 
                          style={{ fontSize: 12, padding: "6px 16px" }}
                          onClick={() => fileInputRef.current?.click()}
                        >
                          {attachedFileName ? "🔄 Choose Different .HTML File" : "📂 Browse HTML File from Computer"}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* SUB-PANEL C: Visual Builder Layouts */}
                  {contentSourceMode === "builder" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 12, background: "var(--bg-secondary)", padding: 14, borderRadius: 8, border: "1px solid var(--border-default)" }}>
                      <div>
                        <label className="form-label" style={{ fontWeight: 600, display: "block", marginBottom: 6 }}>Layout Style</label>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                          <div 
                            onClick={() => setCampaignTemplate("promo")}
                            style={{ 
                              border: `2px solid ${campaignTemplate === "promo" ? "var(--accent)" : "var(--border-default)"}`,
                              borderRadius: 6, padding: 8, cursor: "pointer", background: "#FFFFFF", textAlign: "center"
                            }}
                          >
                            <div style={{ fontWeight: 600, fontSize: 12 }}>🏈 Sports Promo</div>
                          </div>
                          <div 
                            onClick={() => setCampaignTemplate("elegant")}
                            style={{ 
                              border: `2px solid ${campaignTemplate === "elegant" ? "var(--accent)" : "var(--border-default)"}`,
                              borderRadius: 6, padding: 8, cursor: "pointer", background: "#FFFFFF", textAlign: "center"
                            }}
                          >
                            <div style={{ fontWeight: 600, fontSize: 12 }}>✨ Minimalist</div>
                          </div>
                          <div 
                            onClick={() => setCampaignTemplate("bold")}
                            style={{ 
                              border: `2px solid ${campaignTemplate === "bold" ? "var(--accent)" : "var(--border-default)"}`,
                              borderRadius: 6, padding: 8, cursor: "pointer", background: "#FFFFFF", textAlign: "center"
                            }}
                          >
                            <div style={{ fontWeight: 600, fontSize: 12 }}>🔥 Bold Alert</div>
                          </div>
                        </div>
                      </div>

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
                        <textarea className="input" value={campaignBody} onChange={(e) => setCampaignBody(e.target.value)} style={{ minHeight: 80, fontSize: 13, resize: "vertical" }} />
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
                  )}

                  {/* SUB-PANEL D: Raw HTML Editor */}
                  {contentSourceMode === "raw" && (
                    <div className="form-group">
                      <label className="form-label">Message HTML Content Code Editor</label>
                      <textarea 
                        className="input" 
                        placeholder="Paste full responsive email HTML here..." 
                        value={customHtmlContent} 
                        onChange={(e) => setCustomHtmlContent(e.target.value)} 
                        style={{ minHeight: 220, fontFamily: "monospace", fontSize: 12 }} 
                      />
                    </div>
                  )}
                </div>

                {/* 5. Schedule / Send Timeline */}
                <div style={{ background: "#FFFFFF", padding: 16, borderRadius: 10, border: "1px solid var(--border-default)" }}>
                  <label className="form-label" style={{ fontWeight: 600, display: "block", marginBottom: 8 }}>Delivery Timeline</label>
                  <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
                    <button 
                      type="button"
                      className={`btn ${campaignSchedule === "now" ? "btn-primary" : "btn-secondary"}`} 
                      style={{ flex: 1, fontSize: 13, padding: "8px 12px" }}
                      onClick={() => setCampaignSchedule("now")}
                    >
                      🚀 Send Immediately
                    </button>
                    <button 
                      type="button"
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
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <label className="form-label" style={{ fontWeight: 600, margin: 0 }}>Live Real-Time Campaign Preview</label>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button 
                      type="button"
                      className={`btn ${previewDevice === "desktop" ? "btn-primary" : "btn-secondary"}`}
                      style={{ padding: "3px 8px", fontSize: 11 }}
                      onClick={() => setPreviewDevice("desktop")}
                    >
                      🖥️ Desktop
                    </button>
                    <button 
                      type="button"
                      className={`btn ${previewDevice === "mobile" ? "btn-primary" : "btn-secondary"}`}
                      style={{ padding: "3px 8px", fontSize: 11 }}
                      onClick={() => setPreviewDevice("mobile")}
                    >
                      📱 Mobile
                    </button>
                  </div>
                </div>

                <div style={{ 
                  flex: 1, 
                  border: "1px solid var(--border-default)", 
                  borderRadius: 12, 
                  background: "#F1F5F9", 
                  padding: 16, 
                  display: "flex", 
                  justifyContent: "center", 
                  alignItems: "flex-start",
                  minHeight: 480,
                  overflowY: "auto"
                }}>
                  <div style={{ 
                    width: previewDevice === "desktop" ? "100%" : "375px", 
                    maxWidth: previewDevice === "desktop" ? 600 : 375, 
                    minHeight: 480, 
                    background: "#FFFFFF", 
                    borderRadius: 8, 
                    boxShadow: "0 8px 24px rgba(0,0,0,0.08)", 
                    overflowY: "auto",
                    border: "1px solid var(--border-default)",
                    transition: "all 0.2s ease"
                  }}>
                    {/* Render dynamically compiled HTML preview */}
                    <div dangerouslySetInnerHTML={{ __html: compileCampaignHtml() }} />
                  </div>
                </div>
              </div>
            </div>

            <div className="upload-modal-footer" style={{ borderTop: "1px solid var(--border-default)", padding: "14px 24px" }}>
              <button className="btn btn-secondary" onClick={() => setCampaignModalOpen(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleCreateCampaign} disabled={loading} style={{ fontWeight: "bold" }}>
                {campaignSchedule === "later" ? "💾 Schedule Outbound Campaign" : "🚀 Create Campaign Draft"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Campaign Stats Modal */}
      {statsModalOpen && activeCampaignStats && (
        <div className="upload-modal-overlay" onClick={() => setStatsModalOpen(false)}>
          <div className="upload-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640 }}>
            <div className="upload-modal-header">
              <div className="upload-modal-title">📊 Campaign Stats: {activeCampaignStats.name}</div>
              <button className="upload-modal-close" onClick={() => setStatsModalOpen(false)}>✕</button>
            </div>
            <div className="upload-modal-body" style={{ padding: "20px 24px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
                <div style={{ background: "#ecfdf5", padding: 12, borderRadius: 8, textAlign: "center" }}>
                  <div style={{ fontSize: 11, color: "#065f46", fontWeight: "bold" }}>SENT (DELIVERED)</div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: "#065f46", marginTop: 4 }}>{activeCampaignStats.sent}</div>
                </div>
                <div style={{ background: "#f1f5f9", padding: 12, borderRadius: 8, textAlign: "center" }}>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: "bold" }}>DAILY THROTTLE</div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: "var(--text-primary)", marginTop: 4 }}>{activeCampaignStats.daily_limit}/d</div>
                </div>
                <div style={{ background: activeCampaignStats.failed > 0 ? "#fef2f2" : "#f1f5f9", padding: 12, borderRadius: 8, textAlign: "center" }}>
                  <div style={{ fontSize: 11, color: activeCampaignStats.failed > 0 ? "#991b1b" : "var(--text-secondary)", fontWeight: "bold" }}>FAILED / SUPPRESSED</div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: activeCampaignStats.failed > 0 ? "#991b1b" : "var(--text-primary)", marginTop: 4 }}>
                    {activeCampaignStats.failed + activeCampaignStats.suppressed}
                  </div>
                </div>
              </div>

              <div style={{ marginBottom: 12, fontSize: 13, color: "var(--text-secondary)" }}>
                <strong>Status:</strong> <span className="badge badge-info" style={{ marginLeft: 6 }}>{activeCampaignStats.status?.toUpperCase()}</span>
                <span style={{ marginLeft: 16 }}><strong>Remaining:</strong> {activeCampaignStats.remaining} contacts</span>
              </div>

              <div style={{ marginTop: 16 }}>
                <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Recent Drip Send Logs</h4>
                <div style={{ maxHeight: 200, overflowY: "auto", border: "1px solid var(--border-default)", borderRadius: 6 }}>
                  {activeCampaignStats.recent_sends?.length === 0 ? (
                    <div style={{ padding: 16, textAlign: "center", color: "var(--text-muted)", fontSize: 12 }}>No send events recorded yet.</div>
                  ) : (
                    <table style={{ width: "100%", fontSize: 12 }}>
                      <thead>
                        <tr style={{ background: "var(--bg-secondary)", textAlign: "left" }}>
                          <th style={{ padding: "6px 10px" }}>Recipient</th>
                          <th style={{ padding: "6px 10px" }}>Status</th>
                          <th style={{ padding: "6px 10px" }}>Timestamp</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeCampaignStats.recent_sends.map((s: any) => (
                          <tr key={s.id} style={{ borderTop: "1px solid var(--border-default)" }}>
                            <td style={{ padding: "6px 10px", fontFamily: "monospace" }}>{s.to_email || s.toEmail}</td>
                            <td style={{ padding: "6px 10px" }}>
                              <span className={`badge ${s.status === "sent" ? "badge-success" : s.status === "suppressed" ? "badge-warning" : "badge-error"}`}>
                                {s.status}
                              </span>
                            </td>
                            <td style={{ padding: "6px 10px", color: "var(--text-secondary)" }}>
                              {s.sent_at || s.sentAt ? new Date(s.sent_at || s.sentAt).toLocaleTimeString() : "-"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
            <div className="upload-modal-footer">
              <button className="btn btn-secondary" onClick={() => setStatsModalOpen(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Create Template Modal */}
      {templateModalOpen && (
        <div className="upload-modal-overlay" onClick={() => setTemplateModalOpen(false)}>
          <div className="upload-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640 }}>
            <div className="upload-modal-header">
              <div className="upload-modal-title">📝 Add Email Template</div>
              <button className="upload-modal-close" onClick={() => setTemplateModalOpen(false)}>✕</button>
            </div>
            <div className="upload-modal-body">
              <div className="form-group">
                <label className="form-label">Template Name</label>
                <input className="input" placeholder="WaiRaiders Custom Jersey Showcase" value={newTemplate.name} onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })} />
              </div>
              <div className="form-group" style={{ marginTop: 12 }}>
                <label className="form-label">Default Subject Line</label>
                <input className="input" placeholder="Customize Your Ultimate Game Jersey | WaiRaiders" value={newTemplate.subject} onChange={(e) => setNewTemplate({ ...newTemplate, subject: e.target.value })} />
              </div>
              <div className="form-group" style={{ marginTop: 12 }}>
                <label className="form-label">Template HTML Content</label>
                <textarea className="input" placeholder="<!DOCTYPE html>..." value={newTemplate.body_html} onChange={(e) => setNewTemplate({ ...newTemplate, body_html: e.target.value })} style={{ minHeight: 220, fontFamily: "monospace", fontSize: 12 }} />
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

      {/* Preview Template Modal */}
      {previewModalOpen && previewTemplate && (
        <div className="upload-modal-overlay" onClick={() => setPreviewModalOpen(false)}>
          <div className="upload-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 800 }}>
            <div className="upload-modal-header">
              <div>
                <div className="upload-modal-title">👁️ Preview: {previewTemplate.name}</div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>Subject: {previewTemplate.subject}</div>
              </div>
              <button className="upload-modal-close" onClick={() => setPreviewModalOpen(false)}>✕</button>
            </div>
            <div className="upload-modal-body" style={{ maxHeight: "70vh", overflowY: "auto", background: "#F1F5F9", padding: 20 }}>
              <div style={{ maxWidth: 600, margin: "0 auto", background: "#FFFFFF", borderRadius: 8, boxShadow: "0 4px 12px rgba(0,0,0,0.06)", overflow: "hidden" }}>
                <div dangerouslySetInnerHTML={{ __html: previewTemplate.body_html }} />
              </div>
            </div>
            <div className="upload-modal-footer" style={{ display: "flex", justifyContent: "space-between" }}>
              <button className="btn btn-secondary" onClick={() => setPreviewModalOpen(false)}>Close</button>
              <button className="btn btn-primary" onClick={() => {
                setPreviewModalOpen(false);
                handleOpenComposerWithTemplate(previewTemplate);
              }}>
                🚀 Use this Template in Campaign ➔
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CSV Import Modal with Real-time Deliverability Scanner */}
      {importModalOpen && (
        <div className="upload-modal-overlay" onClick={() => setImportModalOpen(false)}>
          <div className="upload-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 620 }}>
            <div className="upload-modal-header">
              <div className="upload-modal-title">📥 Import Contacts with Deliverability Scanner</div>
              <button className="upload-modal-close" onClick={() => setImportModalOpen(false)}>✕</button>
            </div>
            <div className="upload-modal-body">
              <div className="form-group">
                <label className="form-label">CSV Content (Header: <code>email,first_name,last_name</code>)</label>
                <textarea 
                  className="input" 
                  placeholder="email,first_name,last_name&#13;Airbnbaccvn01@gmail.com,Test,User&#13;john@example.com,John,Doe" 
                  value={csvText} 
                  onChange={(e) => setCsvText(e.target.value)} 
                  style={{ minHeight: 160, fontFamily: "monospace", fontSize: 12 }} 
                />
              </div>

              {scanSummary && (
                <div style={{ marginTop: 16, background: "var(--bg-secondary)", padding: 12, borderRadius: 6, fontSize: 13 }}>
                  <div><strong>Import Result:</strong></div>
                  <div>✅ Created: {scanSummary.created}</div>
                  <div>🔄 Updated: {scanSummary.updated}</div>
                  <div style={{ color: scanSummary.invalid > 0 ? "var(--warning)" : "inherit" }}>
                    ⚠️ Invalid MX / Disposable: {scanSummary.invalid}
                  </div>
                </div>
              )}
            </div>
            <div className="upload-modal-footer">
              <button className="btn btn-secondary" onClick={() => setImportModalOpen(false)}>Close</button>
              <button className="btn btn-primary" onClick={handleCsvImport} disabled={loading}>
                {loading ? "Scanning & Importing..." : "🚀 Scan & Import Contacts"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
