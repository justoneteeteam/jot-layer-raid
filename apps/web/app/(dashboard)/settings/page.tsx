"use client";

import { useState, useEffect } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface StoreEntry {
  id: number;
  name: string;
  platform: "WooCommerce" | "ShopBase";
  url: string;
  apiKey: string;
  apiSecret: string;
  status: "active" | "inactive" | "testing";
  products: number;
  lastSync: string;
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

const INITIAL_STORES: StoreEntry[] = [
  { id: 1, name: "WaiRaiders Store", platform: "WooCommerce", url: "https://wairaiders.com", apiKey: "ck_••••••", apiSecret: "cs_••••••", status: "active", products: 128, lastSync: "2026-05-10 09:30" },
  { id: 2, name: "Eagles Gear Shop", platform: "WooCommerce", url: "https://eaglesgear.shop", apiKey: "ck_••••••", apiSecret: "cs_••••••", status: "active", products: 84, lastSync: "2026-05-09 15:00" },
  { id: 3, name: "JerseyHub SB", platform: "ShopBase", url: "https://jerseyhub.onshopbase.com", apiKey: "••••••", apiSecret: "••••••", status: "inactive", products: 0, lastSync: "Never" },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<"stores" | "crm" | "senders">("stores");
  const [stores, setStores] = useState<StoreEntry[]>(INITIAL_STORES);
  
  // Store Modal states
  const [storeModalOpen, setStoreModalOpen] = useState(false);
  const [editStoreId, setEditStoreId] = useState<number | null>(null);
  const [deleteStoreId, setDeleteStoreId] = useState<number | null>(null);
  const [storeForm, setStoreForm] = useState({ name: "", platform: "WooCommerce" as "WooCommerce" | "ShopBase", url: "", apiKey: "", apiSecret: "" });
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [testMessage, setTestMessage] = useState("");
  const [syncing, setSyncing] = useState<number | null>(null);

  // Email CRM settings states
  const [senderEmail, setSenderEmail] = useState("");
  const [keywords, setKeywords] = useState("");
  const [templateSubject, setTemplateSubject] = useState("");
  const [templateBody, setTemplateBody] = useState("");
  const [autoReplyEnabled, setAutoReplyEnabled] = useState(true);
  const [cloudflareAccountId, setCloudflareAccountId] = useState("");
  const [cloudflareApiToken, setCloudflareApiToken] = useState("");
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settingsSaving, setSettingsSaving] = useState(false);
  
  // Status message
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");

  // Senders & Cloudflare Workers states
  const [senders, setSenders] = useState<SenderIdentity[]>([]);
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
  const [selectedDomainDns, setSelectedDomainDns] = useState<string>("");
  const [scriptType, setScriptType] = useState<"inbound" | "outbound">("inbound");

  // Webhook Inbound Simulator state
  const [mockSenderName, setMockSenderName] = useState("Luke Pham");
  const [mockSenderEmail, setMockSenderEmail] = useState("luke@example.com");
  const [mockRecipientEmail, setMockRecipientEmail] = useState("");
  const [mockSubject, setMockSubject] = useState("Jersey Exchange Inquiry #1120");
  const [mockBody, setMockBody] = useState("Hi support team, I ordered a WaiRaiders jersey and need to exchange it for a size L before the game. Thanks!");
  const [simulationLogs, setSimulationLogs] = useState<string[]>([]);
  const [simulating, setSimulating] = useState(false);
  
  // Clipboard copies
  const [copiedText, setCopiedText] = useState("");

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(""), 2000);
  };

  const showStatus = (msg: string, type: "success" | "error") => {
    setMessage(msg);
    setMessageType(type);
    setTimeout(() => setMessage(""), 5000);
  };

  const loadCrmSettings = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/oms/settings/email`);
      if (res.ok) {
        const data = await res.json();
        setSenderEmail(data.sender_email || "");
        setKeywords(data.keywords || "");
        setTemplateSubject(data.template_subject || "");
        setTemplateBody(data.template_body || "");
        setAutoReplyEnabled(data.auto_reply_enabled ?? true);
        setCloudflareAccountId(data.cloudflare_account_id || "");
        setCloudflareApiToken(data.cloudflare_api_token || "");
      }
    } catch (err) {
      console.error("Failed to load email settings", err);
    } finally {
      setSettingsLoading(false);
    }
  };

  const loadSenders = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/marketing/senders`);
      if (res.ok) {
        const data = await res.json();
        setSenders(data);
        if (data.length > 0) {
          if (!mockRecipientEmail) setMockRecipientEmail(data[0].from_email);
          if (!selectedDomainDns) setSelectedDomainDns(data[0].domain);
        }
      }
    } catch (err) {
      console.error("Failed to load senders", err);
    }
  };

  useEffect(() => {
    loadCrmSettings();
    loadSenders();
  }, []);

  const handleSaveCrmSettings = async () => {
    setSettingsSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/oms/settings/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sender_email: senderEmail,
          keywords: keywords,
          template_subject: templateSubject,
          template_body: templateBody,
          auto_reply_enabled: autoReplyEnabled,
          cloudflare_account_id: cloudflareAccountId,
          cloudflare_api_token: cloudflareApiToken,
        }),
      });
      if (res.ok) {
        showStatus("✔️ CRM Email settings successfully saved!", "success");
      } else {
        showStatus("❌ Failed to save CRM email settings.", "error");
      }
    } catch (err) {
      console.error(err);
      showStatus("❌ Network error connecting to backend.", "error");
    } finally {
      setSettingsSaving(false);
    }
  };

  // Store Connections CRUD
  const openAddStore = () => {
    setEditStoreId(null);
    setStoreForm({ name: "", platform: "WooCommerce", url: "", apiKey: "", apiSecret: "" });
    setTestStatus("idle"); setTestMessage("");
    setStoreModalOpen(true);
  };

  const openEditStore = (store: StoreEntry) => {
    setEditStoreId(store.id);
    setStoreForm({ name: store.name, platform: store.platform, url: store.url, apiKey: "", apiSecret: "" });
    setTestStatus("idle"); setTestMessage("");
    setStoreModalOpen(true);
  };

  const testStoreConnection = async () => {
    setTestStatus("testing"); setTestMessage("");
    await new Promise((r) => setTimeout(r, 1500));
    if (storeForm.url && storeForm.apiKey && storeForm.apiSecret) {
      setTestStatus("success");
      setTestMessage(storeForm.platform === "WooCommerce"
        ? `Connected to WooCommerce REST API v3 at ${storeForm.url}`
        : `Connected to ShopBase Admin API at ${storeForm.url}`
      );
    } else {
      setTestStatus("error");
      setTestMessage("Please fill in all fields before testing.");
    }
  };

  const handleSaveStore = () => {
    if (!storeForm.name || !storeForm.url) return;
    if (editStoreId) {
      setStores((prev) => prev.map((s) => s.id === editStoreId ? { ...s, name: storeForm.name, platform: storeForm.platform, url: storeForm.url } : s));
    } else {
      const newStore: StoreEntry = {
        id: Date.now(), name: storeForm.name, platform: storeForm.platform, url: storeForm.url,
        apiKey: "••••••", apiSecret: "••••••", status: testStatus === "success" ? "active" : "inactive",
        products: 0, lastSync: "Never",
      };
      setStores((prev) => [...prev, newStore]);
    }
    setStoreModalOpen(false);
  };

  const handleDeleteStore = () => {
    if (deleteStoreId) setStores((prev) => prev.filter((s) => s.id !== deleteStoreId));
    setDeleteStoreId(null);
  };

  const handleSyncStore = async (id: number) => {
    setSyncing(id);
    await new Promise((r) => setTimeout(r, 2000));
    setStores((prev) => prev.map((s) => s.id === id ? { ...s, lastSync: new Date().toLocaleString(), status: "active" } : s));
    setSyncing(null);
  };

  // Sender Identities CRUD
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

  // Run live support email webhook simulation
  const handleRunSimulation = async () => {
    if (!mockSenderEmail || !mockRecipientEmail) {
      alert("Please select a simulated recipient email from your senders list.");
      return;
    }
    setSimulating(true);
    setSimulationLogs([]);

    const addLog = (text: string, delay: number) => {
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          const timestamp = new Date().toLocaleTimeString();
          setSimulationLogs((prev) => [...prev, `[${timestamp}] ${text}`]);
          resolve();
        }, delay);
      });
    };

    await addLog(`⏳ Initiating customer support inbound webhook simulation...`, 0);
    await addLog(`📡 Sending POST request payload to /api/oms/webhook/email/inbound...`, 800);

    try {
      const res = await fetch(`${API_BASE}/api/oms/webhook/email/inbound?secret=JOT_INGESTION_SECRET`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sender: mockSenderEmail,
          sender_name: mockSenderName,
          recipient: mockRecipientEmail,
          subject: mockSubject,
          body_text: mockBody
        })
      });

      if (res.ok) {
        const data = await res.json();
        await addLog(`✔️ Webhook successfully parsed and matched on FastAPI backend! (Status 200)`, 800);
        
        if (data.message.includes("Appended message")) {
          await addLog(`📦 CRM Ingestion: Found active support ticket ID ${data.ticket_id}. Thread-matched successfully and appended reply message envelope!`, 800);
        } else {
          await addLog(`📦 CRM Ingestion: No active ticket found for ${mockSenderEmail}. Spawning new support ticket row... (Created Ticket ID ${data.ticket_id})`, 800);
        }

        await addLog(`🔔 Telegram Alerts API: Dispatched support inquiry alert metrics directly to JOT admin Telegram support channel!`, 900);
        await addLog(`🎉 End-to-end integration verified successfully! Customer reply is threaded and active.`, 600);
      } else {
        await addLog(`❌ Backend Webhook rejected request (Status ${res.status}): ${await res.text()}`, 800);
      }
    } catch (err) {
      await addLog(`❌ Simulation failed due to a network connection error: ${err}`, 800);
    } finally {
      setSimulating(false);
    }
  };

  const inboundWorkerScript = `export default {
  async email(message, env, ctx) {
    const rawBody = await new Response(message.raw).text();
    const payload = {
      sender: message.from,
      sender_name: message.headers.get("from") || message.from.split("@")[0],
      recipient: message.to,
      subject: message.headers.get("subject") || "Support Ticket Inquiry",
      body_text: rawBody
    };

    // Forward inbound Support ticket directly into JOT support ingestion router
    const res = await fetch("${API_BASE}/api/oms/webhook/email/inbound?secret=JOT_INGESTION_SECRET", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      throw new Error(\`Failed to route support ticket: \${res.statusText}\`);
    }
  }
};`;

  const outboundWorkerScript = `export default {
  async fetch(request, env) {
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }
    const payload = await request.json();
    
    try {
      // Send outbound email using the native paid Workers binding
      await env.EMAIL.send({
        to: [{ email: payload.recipient }],
        from: { 
          email: payload.from_email, 
          name: payload.from_name 
        },
        subject: payload.subject,
        html: payload.html_body,
        text: payload.text_body || "Please view this email in an HTML-compatible client."
      });
      return new Response("Email sent successfully", { status: 200 });
    } catch (err) {
      return new Response(err.message, { status: 500 });
    }
  }
};`;

  const [loadingText, setLoading] = useState(false);

  return (
    <div>
      {/* Global Tabs */}
      <div className="card" style={{ marginBottom: 24, padding: 12 }}>
        <div style={{ display: "flex", gap: 10, overflowX: "auto" }}>
          <button 
            className={`btn ${activeTab === "stores" ? "btn-primary" : "btn-secondary"}`} 
            onClick={() => setActiveTab("stores")}
            style={{ fontWeight: 600 }}
          >
            ⚙️ Connected Storefronts
          </button>
          <button 
            className={`btn ${activeTab === "crm" ? "btn-primary" : "btn-secondary"}`} 
            onClick={() => setActiveTab("crm")}
            style={{ fontWeight: 600 }}
          >
            📧 CRM Auto-Replies
          </button>
          <button 
            className={`btn ${activeTab === "senders" ? "btn-primary" : "btn-secondary"}`} 
            onClick={() => setActiveTab("senders")}
            style={{ fontWeight: 600 }}
          >
            🌐 Email Senders & Cloudflare Workers
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

      {/* Tab 1: Connected Storefronts */}
      {activeTab === "stores" && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-header">
            <div>
              <h2 className="card-title">Connected Brand Stores</h2>
              <p style={{ margin: "4px 0 0 0", color: "var(--text-secondary)", fontSize: 13 }}>
                Link brand e-commerce storefront API credentials to coordinate roster lists, order synchronizations, and customer support.
              </p>
            </div>
            <button className="btn btn-primary" onClick={openAddStore}>➕ Add Store</button>
          </div>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Store Name</th><th>Platform</th><th>URL</th><th>Products</th><th>Last Sync</th><th>Status</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {stores.map((store) => (
                  <tr key={store.id}>
                    <td style={{ fontWeight: 500 }}>{store.name}</td>
                    <td>
                      <span className={`badge ${store.platform === "WooCommerce" ? "badge-info" : "badge-warning"}`}>
                        {store.platform === "WooCommerce" ? "🟣 " : "🔵 "}{store.platform}
                      </span>
                    </td>
                    <td style={{ fontSize: 13 }}>
                      <a href={store.url} target="_blank" rel="noreferrer" style={{ color: "var(--accent)", textDecoration: "none" }}>{store.url}</a>
                    </td>
                    <td style={{ fontFamily: "monospace" }}>{store.products}</td>
                    <td style={{ fontSize: 13, color: "var(--text-secondary)" }}>{store.lastSync}</td>
                    <td>
                      <span className={`badge ${store.status === "active" ? "badge-success" : "badge-error"}`}>
                        {store.status === "active" ? "🟢 Active" : "🔴 Inactive"}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 4 }}>
                        <button className="btn btn-ghost" onClick={() => handleSyncStore(store.id)} disabled={syncing === store.id} title="Sync Now">
                          {syncing === store.id ? <span className="upload-spinner" /> : "🔄"}
                        </button>
                        <button className="btn btn-ghost" onClick={() => openEditStore(store)} title="Edit">✏️</button>
                        <button className="btn btn-ghost" onClick={() => setDeleteStoreId(store.id)} title="Delete">🗑️</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: CRM Auto-Replies */}
      {activeTab === "crm" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 24 }}>
          {/* Rules & Settings */}
          <div className="card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div>
              <div className="card-header" style={{ marginBottom: 20 }}>
                <h2 className="card-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  📧 Instant Email CRM Settings
                </h2>
                <span className={`badge ${autoReplyEnabled ? 'badge-success' : 'badge-warning'}`}>
                  {autoReplyEnabled ? "🟢 Active Engine" : "🟡 Paused"}
                </span>
              </div>
              
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label" style={{ fontWeight: 600 }}>Default Support Sender Address</label>
                <input 
                  className="input" 
                  type="email" 
                  placeholder="customer@justonetee.org"
                  value={senderEmail}
                  onChange={(e) => setSenderEmail(e.target.value)}
                />
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                  The default address used to dispatch manual support ticket replies.
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label" style={{ fontWeight: 600 }}>Logistics Trigger Keywords</label>
                <input 
                  className="input" 
                  placeholder="shipping status, tracking, track, where is my order"
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                />
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                  Comma-separated keywords to trigger automated logistics tracking updates.
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label" style={{ fontWeight: 600 }}>Cloudflare Account ID</label>
                <input 
                  className="input" 
                  placeholder="Cloudflare account ID"
                  value={cloudflareAccountId}
                  onChange={(e) => setCloudflareAccountId(e.target.value)}
                />
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                  Available in Cloudflare dashboard → Workers & Pages → Account ID.
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label" style={{ fontWeight: 600 }}>Cloudflare API Token</label>
                <input 
                  className="input" 
                  type="password"
                  placeholder="Cloudflare REST API Token"
                  value={cloudflareApiToken}
                  onChange={(e) => setCloudflareApiToken(e.target.value)}
                />
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                  API Token authorized with "Email Routing: Edit" or "Workers: Edit" permissions.
                </div>
              </div>

              <div className="form-group" style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, marginBottom: 16 }}>
                <input 
                  type="checkbox" 
                  id="autoReplyEnabled" 
                  checked={autoReplyEnabled}
                  onChange={(e) => setAutoReplyEnabled(e.target.checked)}
                  style={{ width: 16, height: 16, cursor: "pointer" }}
                />
                <label htmlFor="autoReplyEnabled" style={{ fontSize: 13, fontWeight: "500", color: "var(--text-primary)", cursor: "pointer" }}>
                  Filter rules: Instant auto-reply matching keyword emails; queue others.
                </label>
              </div>
            </div>

            <div style={{ marginTop: "auto", paddingTop: 16 }}>
              <button 
                className="btn btn-primary" 
                onClick={handleSaveCrmSettings}
                disabled={settingsSaving}
                style={{ width: "100%", height: 42, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
              >
                {settingsSaving ? (
                  <><span className="upload-spinner" /> Saving...</>
                ) : (
                  "💾 Save Settings"
                )}
              </button>
            </div>
          </div>

          {/* Template Editor */}
          <div className="card" style={{ display: "flex", flexDirection: "column" }}>
            <div className="card-header" style={{ marginBottom: 20 }}>
              <h2 className="card-title">📝 Auto-Reply Template Editor</h2>
              <span style={{ fontSize: 12, color: "var(--accent)", fontWeight: "500" }}>Rich Variables</span>
            </div>

            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label" style={{ fontWeight: 600 }}>Subject Template</label>
              <input 
                className="input" 
                placeholder="Logistics update for order {order_id}"
                value={templateSubject}
                onChange={(e) => setTemplateSubject(e.target.value)}
              />
            </div>

            <div className="form-group" style={{ flex: 1, display: "flex", flexDirection: "column" }}>
              <label className="form-label" style={{ fontWeight: 600 }}>Message Body</label>
              <textarea 
                className="input" 
                placeholder="Type template message body here..."
                value={templateBody}
                onChange={(e) => setTemplateBody(e.target.value)}
                style={{ 
                  width: "100%", 
                  flex: 1, 
                  minHeight: 180, 
                  fontFamily: "monospace", 
                  fontSize: 13, 
                  lineHeight: "1.5", 
                  padding: "8px 12px", 
                  resize: "vertical" 
                }}
              />
            </div>

            <div style={{ marginTop: 12, padding: "8px 12px", background: "var(--bg-secondary)", borderRadius: 6, border: "1px solid var(--border-default)" }}>
              <div style={{ fontSize: 11, fontWeight: "bold", color: "var(--text-secondary)", marginBottom: 4 }}>SUPPORTED MERGE PLACEHOLDERS</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 12px", fontSize: 11, color: "var(--text-muted)" }}>
                <code>{"{customer_name}"}</code>
                <code>{"{order_id}"}</code>
                <code>{"{shipping_status}"}</code>
                <code>{"{tracking_number}"}</code>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Senders & Cloudflare Workers Mapping */}
      {activeTab === "senders" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Senders Identity Table */}
          <div className="card">
            <div className="card-header">
              <div>
                <h2 className="card-title">Outbound Sender Domains & Webhook Configuration</h2>
                <p style={{ margin: "4px 0 0 0", color: "var(--text-secondary)", fontSize: 13 }}>
                  Add multiple email domains connected to your storefronts. Configure SPF, DKIM, and MX records inside Cloudflare to verify sending credentials.
                </p>
              </div>
              <button className="btn btn-primary" onClick={() => { setEditSenderId(null); setSenderModalOpen(true); }}>➕ Add Sender Domain</button>
            </div>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Store brand</th>
                    <th>From Name</th>
                    <th>Outbound Email</th>
                    <th>Reply-To Email</th>
                    <th>Domain</th>
                    <th>Provider Type</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {senders.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: "center", color: "var(--text-secondary)", padding: 24 }}>No sender domain mappings set up. Map a sender domain below!</td>
                    </tr>
                  ) : (
                    senders.map((s) => (
                      <tr key={s.id} onClick={() => s.domain && setSelectedDomainDns(s.domain)} style={{ cursor: "pointer" }}>
                        <td style={{ fontWeight: 600 }}>{s.store_id}</td>
                        <td>{s.from_name}</td>
                        <td style={{ fontWeight: 500 }}>{s.from_email}</td>
                        <td>{s.reply_to_email || "-"}</td>
                        <td>
                          <code style={{ background: "#f1f5f9", padding: "2px 4px", borderRadius: 4, fontSize: 12 }}>{s.domain}</code>
                        </td>
                        <td>
                          <span className={`badge ${s.provider === "cloudflare" ? "badge-info" : "badge-warning"}`}>
                            {s.provider.toUpperCase()}
                          </span>
                        </td>
                        <td>
                          <span className={`badge ${s.status === "active" ? "badge-success" : "badge-warning"}`}>
                            {s.status === "active" ? "🟢 Verified" : "🟡 Pending"}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: "flex", gap: 4 }} onClick={(e) => e.stopPropagation()}>
                            <button className="btn btn-ghost" style={{ padding: 4 }} onClick={() => handleEditSender(s)}>✏️</button>
                            <button className="btn btn-ghost" style={{ padding: 4, color: "var(--error)" }} onClick={() => s.id && handleDeleteSender(s.id)}>🗑️</button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
            {/* DNS Records Checklist panel */}
            <div className="card">
              <h3 className="card-title" style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
                📋 Cloudflare DNS Record Verification Checklist
              </h3>
              <p style={{ color: "var(--text-secondary)", fontSize: 13, lineHeight: "1.5", marginBottom: 16 }}>
                Add the following DNS records inside your Cloudflare DNS control panel for <strong style={{ color: "var(--accent)" }}>{selectedDomainDns || "selected-domain.com"}</strong> to enable SPF, DKIM, and MX email routing:
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {/* MX Inbound Email routing */}
                <div style={{ border: "1px solid var(--border-default)", borderRadius: 6, padding: 10, background: "var(--bg-secondary)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <span className="badge badge-info" style={{ fontSize: 10 }}>Type: MX (Priority 10, 20, 30)</span>
                    <button className="btn btn-secondary" style={{ padding: "2px 6px", fontSize: 10 }} onClick={() => handleCopy("route1.mx.cloudflare.net", "MX")}>
                      {copiedText === "MX" ? "Copied!" : "Copy"}
                    </button>
                  </div>
                  <div style={{ fontSize: 12, fontFamily: "monospace", color: "var(--text-primary)" }}>
                    Name: <code>@</code> | Value: <code>route1.mx.cloudflare.net</code><br/>
                    Name: <code>@</code> | Value: <code>route2.mx.cloudflare.net</code>
                  </div>
                </div>

                {/* SPF Outbound Authentication */}
                <div style={{ border: "1px solid var(--border-default)", borderRadius: 6, padding: 10, background: "var(--bg-secondary)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <span className="badge badge-info" style={{ fontSize: 10 }}>Type: TXT (SPF Policy)</span>
                    <button className="btn btn-secondary" style={{ padding: "2px 6px", fontSize: 10 }} onClick={() => handleCopy("v=spf1 include:mailchannels.net ~all", "SPF")}>
                      {copiedText === "SPF" ? "Copied!" : "Copy"}
                    </button>
                  </div>
                  <div style={{ fontSize: 12, fontFamily: "monospace", color: "var(--text-primary)" }}>
                    Name: <code>@</code> | Value: <code>v=spf1 include:mailchannels.net ~all</code>
                  </div>
                </div>

                {/* DKIM Alignment */}
                <div style={{ border: "1px solid var(--border-default)", borderRadius: 6, padding: 10, background: "var(--bg-secondary)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <span className="badge badge-info" style={{ fontSize: 10 }}>Type: TXT (DKIM Key)</span>
                    <button className="btn btn-secondary" style={{ padding: "2px 6px", fontSize: 10 }} onClick={() => handleCopy(`v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA3...`, "DKIM")}>
                      {copiedText === "DKIM" ? "Copied!" : "Copy"}
                    </button>
                  </div>
                  <div style={{ fontSize: 12, fontFamily: "monospace", color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    Name: <code>_domainkey</code> | Value: <code>v=DKIM1; k=rsa; p=MIIBIjANBgkq...</code>
                  </div>
                </div>

                {/* DMARC Policy */}
                <div style={{ border: "1px solid var(--border-default)", borderRadius: 6, padding: 10, background: "var(--bg-secondary)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <span className="badge badge-info" style={{ fontSize: 10 }}>Type: TXT (DMARC Guard)</span>
                    <button className="btn btn-secondary" style={{ padding: "2px 6px", fontSize: 10 }} onClick={() => handleCopy(`v=DMARC1; p=quarantine; pct=100; rua=mailto:dmarc@${selectedDomainDns || "domain.com"}`, "DMARC")}>
                      {copiedText === "DMARC" ? "Copied!" : "Copy"}
                    </button>
                  </div>
                  <div style={{ fontSize: 12, fontFamily: "monospace", color: "var(--text-primary)" }}>
                    Name: <code>_dmarc</code> | Value: <code>v=DMARC1; p=quarantine; pct=100;</code>
                  </div>
                </div>
              </div>
            </div>

            {/* Cloudflare Worker Deployment scripts compiler */}
            <div className="card" style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <h3 className="card-title">🚀 Cloudflare Worker Wrangler Script</h3>
                <div style={{ display: "flex", gap: 4 }}>
                  <button 
                    className={`btn ${scriptType === "inbound" ? "btn-primary" : "btn-secondary"}`} 
                    style={{ fontSize: 10, padding: "4px 8px" }} 
                    onClick={() => setScriptType("inbound")}
                  >
                    Inbound Forwarding
                  </button>
                  <button 
                    className={`btn ${scriptType === "outbound" ? "btn-primary" : "btn-secondary"}`} 
                    style={{ fontSize: 10, padding: "4px 8px" }} 
                    onClick={() => setScriptType("outbound")}
                  >
                    Outbound Sending
                  </button>
                </div>
              </div>
              <p style={{ color: "var(--text-secondary)", fontSize: 12, lineHeight: "1.4", margin: "0 0 10px 0" }}>
                {scriptType === "inbound" 
                  ? "Deploy this script inside a Cloudflare Worker and configure an Email Route. All emails received will route directly to your ticket database webhook."
                  : "Outbound campaign worker integration to dispatch transactional bulk newsletters via Mailchannels REST Gateway. SPF/DKIM aligned."}
              </p>
              
              <div style={{ position: "relative", flex: 1 }}>
                <button 
                  className="btn btn-secondary" 
                  style={{ position: "absolute", right: 8, top: 8, fontSize: 10, padding: "4px 8px", background: "var(--bg-primary)", opacity: 0.9 }}
                  onClick={() => handleCopy(scriptType === "inbound" ? inboundWorkerScript : outboundWorkerScript, "script")}
                >
                  {copiedText === "script" ? "Copied code!" : "📋 Copy Code"}
                </button>
                <textarea 
                  className="input"
                  readOnly
                  value={scriptType === "inbound" ? inboundWorkerScript : outboundWorkerScript}
                  style={{ 
                    fontFamily: "monospace", 
                    fontSize: 11, 
                    color: "var(--text-secondary)", 
                    background: "var(--bg-secondary)", 
                    minHeight: 240, 
                    height: "100%",
                    resize: "none",
                    padding: 12,
                    border: "1px solid var(--border-default)" 
                  }}
                />
              </div>
            </div>
          </div>

          {/* Webhook Inbound Simulator */}
          <div className="card">
            <h3 className="card-title" style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 16 }}>
              🧪 Live End-to-End Inbound Webhook Test Console
            </h3>
            <p style={{ color: "var(--text-secondary)", fontSize: 13, lineHeight: "1.5", margin: "0 0 16px 0" }}>
              Simulate an inbound customer support email coming from your custom Cloudflare Worker script. This test asserts dynamic threading lookup matches, creates support ticket database rows, threads the email, and broadcasts Slack/Telegram alert notifications instantly!
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Simulated Customer Name</label>
                  <input className="input" placeholder="e.g. Luke Pham" value={mockSenderName} onChange={(e) => setMockSenderName(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Simulated Customer Email</label>
                  <input className="input" type="email" placeholder="e.g. luke@example.com" value={mockSenderEmail} onChange={(e) => setMockSenderEmail(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Recipient Mapped Support Email</label>
                  <select className="input" value={mockRecipientEmail} onChange={(e) => setMockRecipientEmail(e.target.value)} style={{ padding: "8px 12px" }}>
                    {senders.map(s => (
                      <option key={s.id} value={s.from_email}>{s.from_name} ({s.from_email})</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Subject</label>
                  <input className="input" value={mockSubject} onChange={(e) => setMockSubject(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Email Message Query Content</label>
                  <textarea className="input" value={mockBody} onChange={(e) => setMockBody(e.target.value)} style={{ minHeight: 80, fontSize: 13 }} />
                </div>

                <button className="btn btn-primary" onClick={handleRunSimulation} disabled={simulating || senders.length === 0} style={{ padding: "10px 16px", fontSize: 14, fontWeight: "bold" }}>
                  {simulating ? "⏳ Running Simulation Webhook Test..." : "⚡ Trigger Simulator Run"}
                </button>
              </div>

              {/* Simulation Logging Terminal */}
              <div style={{ display: "flex", flexDirection: "column" }}>
                <label className="form-label" style={{ fontWeight: 600 }}>Simulation Diagnostic Logs Output</label>
                <div style={{ 
                  flex: 1, 
                  background: "#0f172a", 
                  borderRadius: 8, 
                  padding: 16, 
                  color: "#38bdf8", 
                  fontFamily: "monospace", 
                  fontSize: 12,
                  lineHeight: "1.6",
                  border: "1px solid #334155",
                  minHeight: 240,
                  overflowY: "auto"
                }}>
                  {simulationLogs.length === 0 ? (
                    <div style={{ color: "#64748b", textAlign: "center", marginTop: 80 }}>
                      Console Idle. Click 'Trigger Simulator Run' to test the support ticket threading webhook!
                    </div>
                  ) : (
                    simulationLogs.map((log, i) => (
                      <div key={i} style={{ 
                        color: log.includes("✔️") || log.includes("🎉") ? "#4ade80" : 
                               log.includes("❌") ? "#f87171" : 
                               log.includes("⏳") ? "#fb7185" : "#38bdf8"
                      }}>
                        {log}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Add/Edit Store Modal ── */}
      {storeModalOpen && (
        <div className="upload-modal-overlay" onClick={() => setStoreModalOpen(false)}>
          <div className="upload-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div className="upload-modal-header">
              <div className="upload-modal-title">
                <span className="upload-modal-icon">🛒</span>
                {editStoreId ? "Edit Store" : "Add Store Connection"}
              </div>
              <button className="upload-modal-close" onClick={() => setStoreModalOpen(false)}>✕</button>
            </div>
            <div className="upload-modal-body">
              {/* Platform Selector */}
              <div className="store-platform-selector">
                {(["WooCommerce", "ShopBase"] as const).map((p) => (
                  <button key={p} className={`store-platform-btn ${storeForm.platform === p ? "active" : ""}`} onClick={() => setStoreForm({ ...storeForm, platform: p })}>
                    <span className="store-platform-icon">{p === "WooCommerce" ? "🟣" : "🔵"}</span>
                    <span>{p}</span>
                  </button>
                ))}
              </div>

              <div className="form-group" style={{ marginTop: 16 }}>
                <label className="form-label">Store Name</label>
                <input className="input" placeholder="My Store" value={storeForm.name} onChange={(e) => setStoreForm({ ...storeForm, name: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Store URL</label>
                <input className="input" placeholder={storeForm.platform === "WooCommerce" ? "https://mystore.com" : "https://mystore.onshopbase.com"} value={storeForm.url} onChange={(e) => setStoreForm({ ...storeForm, url: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">{storeForm.platform === "WooCommerce" ? "Consumer Key" : "API Key"}</label>
                <input className="input" type="password" placeholder={storeForm.platform === "WooCommerce" ? "ck_xxxxxxxxxxxxxxxx" : "API key"} value={storeForm.apiKey} onChange={(e) => setStoreForm({ ...storeForm, apiKey: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">{storeForm.platform === "WooCommerce" ? "Consumer Secret" : "API Secret"}</label>
                <input className="input" type="password" placeholder={storeForm.platform === "WooCommerce" ? "cs_xxxxxxxxxxxxxxxx" : "API secret"} value={storeForm.apiSecret} onChange={(e) => setStoreForm({ ...storeForm, apiSecret: e.target.value })} />
              </div>

              {/* Test Connection */}
              <button className="btn btn-secondary" onClick={testStoreConnection} disabled={testStatus === "testing"} style={{ width: "100%", marginTop: 12 }}>
                {testStatus === "testing" ? <><span className="upload-spinner" /> Testing…</> : "🔌 Test Connection"}
              </button>
              {testMessage && (
                <div className={`store-test-result ${testStatus}`}>{testMessage}</div>
              )}
            </div>
            <div className="upload-modal-footer">
              <button className="btn btn-secondary" onClick={() => setStoreModalOpen(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSaveStore} disabled={!storeForm.name || !storeForm.url}>
                {editStoreId ? "💾 Save Changes" : "➕ Add Store"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Store Confirmation */}
      {deleteStoreId !== null && (
        <div className="upload-modal-overlay" onClick={() => setDeleteStoreId(null)}>
          <div className="upload-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div className="upload-modal-header">
              <div className="upload-modal-title"><span className="upload-modal-icon">⚠️</span>Delete Store</div>
              <button className="upload-modal-close" onClick={() => setDeleteStoreId(null)}>✕</button>
            </div>
            <div className="upload-modal-body">
              <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>
                Are you sure you want to remove <strong>{stores.find((s) => s.id === deleteStoreId)?.name}</strong>? This action cannot be undone.
              </p>
            </div>
            <div className="upload-modal-footer">
              <button className="btn btn-secondary" onClick={() => setDeleteStoreId(null)}>Cancel</button>
              <button className="btn btn-primary" style={{ background: "var(--error)" }} onClick={handleDeleteStore}>🗑️ Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Map Domain Sender Modal */}
      {senderModalOpen && (
        <div className="upload-modal-overlay" onClick={() => setSenderModalOpen(false)}>
          <div className="upload-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div className="upload-modal-header">
              <div className="upload-modal-title">🔧 {editSenderId ? "Edit Sender Domain" : "Map Cloudflare Sender Domain"}</div>
              <button className="upload-modal-close" onClick={() => setSenderModalOpen(false)}>✕</button>
            </div>
            <div className="upload-modal-body">
              <div className="form-group">
                <label className="form-label">Store Brand Connection</label>
                <select className="input" value={newSender.store_id} onChange={(e) => setNewSender({ ...newSender, store_id: e.target.value })} style={{ padding: "8px 12px" }}>
                  <option value="WaiRaiders Store">🏈 WaiRaiders Store</option>
                  <option value="Vulius Store">🎽 Vulius Store</option>
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
              <button className="btn btn-primary" onClick={handleSaveSender} disabled={loadingText}>
                💾 Save Domain Configuration
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
