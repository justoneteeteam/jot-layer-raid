"use client";

import { useState } from "react";

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

const INITIAL_STORES: StoreEntry[] = [
  { id: 1, name: "WaiRaiders Store", platform: "WooCommerce", url: "https://wairaiders.com", apiKey: "ck_••••••", apiSecret: "cs_••••••", status: "active", products: 128, lastSync: "2026-05-10 09:30" },
  { id: 2, name: "Eagles Gear Shop", platform: "WooCommerce", url: "https://eaglesgear.shop", apiKey: "ck_••••••", apiSecret: "cs_••••••", status: "active", products: 84, lastSync: "2026-05-09 15:00" },
  { id: 3, name: "JerseyHub SB", platform: "ShopBase", url: "https://jerseyhub.onshopbase.com", apiKey: "••••••", apiSecret: "••••••", status: "inactive", products: 0, lastSync: "Never" },
];

export default function SettingsPage() {
  const [stores, setStores] = useState<StoreEntry[]>(INITIAL_STORES);
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [form, setForm] = useState({ name: "", platform: "WooCommerce" as "WooCommerce" | "ShopBase", url: "", apiKey: "", apiSecret: "" });
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [testMessage, setTestMessage] = useState("");
  const [syncing, setSyncing] = useState<number | null>(null);

  const openAdd = () => {
    setEditId(null);
    setForm({ name: "", platform: "WooCommerce", url: "", apiKey: "", apiSecret: "" });
    setTestStatus("idle"); setTestMessage("");
    setModalOpen(true);
  };

  const openEdit = (store: StoreEntry) => {
    setEditId(store.id);
    setForm({ name: store.name, platform: store.platform, url: store.url, apiKey: "", apiSecret: "" });
    setTestStatus("idle"); setTestMessage("");
    setModalOpen(true);
  };

  const testConnection = async () => {
    setTestStatus("testing"); setTestMessage("");
    await new Promise((r) => setTimeout(r, 1500));
    if (form.url && form.apiKey && form.apiSecret) {
      setTestStatus("success");
      setTestMessage(form.platform === "WooCommerce"
        ? `Connected to WooCommerce REST API v3 at ${form.url}`
        : `Connected to ShopBase Admin API at ${form.url}`
      );
    } else {
      setTestStatus("error");
      setTestMessage("Please fill in all fields before testing.");
    }
  };

  const handleSave = () => {
    if (!form.name || !form.url) return;
    if (editId) {
      setStores((prev) => prev.map((s) => s.id === editId ? { ...s, name: form.name, platform: form.platform, url: form.url } : s));
    } else {
      const newStore: StoreEntry = {
        id: Date.now(), name: form.name, platform: form.platform, url: form.url,
        apiKey: "••••••", apiSecret: "••••••", status: testStatus === "success" ? "active" : "inactive",
        products: 0, lastSync: "Never",
      };
      setStores((prev) => [...prev, newStore]);
    }
    setModalOpen(false);
  };

  const handleDelete = () => {
    if (deleteId) setStores((prev) => prev.filter((s) => s.id !== deleteId));
    setDeleteId(null);
  };

  const handleSync = async (id: number) => {
    setSyncing(id);
    await new Promise((r) => setTimeout(r, 2000));
    setStores((prev) => prev.map((s) => s.id === id ? { ...s, lastSync: new Date().toLocaleString(), status: "active" } : s));
    setSyncing(null);
  };

  return (
    <div>
      {/* Connected Stores */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <h2 className="card-title">Connected Stores</h2>
          <button className="btn btn-primary" onClick={openAdd}>➕ Add Store</button>
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
                      <button className="btn btn-ghost" onClick={() => handleSync(store.id)} disabled={syncing === store.id} title="Sync Now">
                        {syncing === store.id ? <span className="upload-spinner" /> : "🔄"}
                      </button>
                      <button className="btn btn-ghost" onClick={() => openEdit(store)} title="Edit">✏️</button>
                      <button className="btn btn-ghost" onClick={() => setDeleteId(store.id)} title="Delete">🗑️</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* API Configuration Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Qwen API</h2>
            <span className="badge badge-success">Connected</span>
          </div>
          <div className="form-group"><label className="form-label">API Key</label><input className="input" type="password" value="sk-••••••••••••••••" readOnly /></div>
          <div className="form-group"><label className="form-label">Endpoint</label><input className="input" value="https://dashscope.aliyuncs.com/api/v1" readOnly /></div>
          <button className="btn btn-secondary" style={{ marginTop: 8 }}>🔄 Update Key</button>
        </div>
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Cloudflare R2</h2>
            <span className="badge badge-success">Connected</span>
          </div>
          <div className="form-group"><label className="form-label">Account ID</label><input className="input" type="password" value="••••••••••••" readOnly /></div>
          <div className="form-group"><label className="form-label">Bucket</label><input className="input" value="jotlayerraid-assets" readOnly /></div>
          <button className="btn btn-secondary" style={{ marginTop: 8 }}>🔄 Update Credentials</button>
        </div>
      </div>

      {/* ── Add/Edit Store Modal ── */}
      {modalOpen && (
        <div className="upload-modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="upload-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div className="upload-modal-header">
              <div className="upload-modal-title">
                <span className="upload-modal-icon">🛒</span>
                {editId ? "Edit Store" : "Add Store Connection"}
              </div>
              <button className="upload-modal-close" onClick={() => setModalOpen(false)}>✕</button>
            </div>
            <div className="upload-modal-body">
              {/* Platform Selector */}
              <div className="store-platform-selector">
                {(["WooCommerce", "ShopBase"] as const).map((p) => (
                  <button key={p} className={`store-platform-btn ${form.platform === p ? "active" : ""}`} onClick={() => setForm({ ...form, platform: p })}>
                    <span className="store-platform-icon">{p === "WooCommerce" ? "🟣" : "🔵"}</span>
                    <span>{p}</span>
                  </button>
                ))}
              </div>

              <div className="form-group" style={{ marginTop: 16 }}>
                <label className="form-label">Store Name</label>
                <input className="input" placeholder="My Store" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Store URL</label>
                <input className="input" placeholder={form.platform === "WooCommerce" ? "https://mystore.com" : "https://mystore.onshopbase.com"} value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">{form.platform === "WooCommerce" ? "Consumer Key" : "API Key"}</label>
                <input className="input" type="password" placeholder={form.platform === "WooCommerce" ? "ck_xxxxxxxxxxxxxxxx" : "API key"} value={form.apiKey} onChange={(e) => setForm({ ...form, apiKey: e.target.value })} />
                {form.platform === "WooCommerce" && <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>WooCommerce → Settings → Advanced → REST API → Add Key</div>}
              </div>
              <div className="form-group">
                <label className="form-label">{form.platform === "WooCommerce" ? "Consumer Secret" : "API Secret"}</label>
                <input className="input" type="password" placeholder={form.platform === "WooCommerce" ? "cs_xxxxxxxxxxxxxxxx" : "API secret"} value={form.apiSecret} onChange={(e) => setForm({ ...form, apiSecret: e.target.value })} />
              </div>

              {/* API Info */}
              <div className="store-api-info">
                {form.platform === "WooCommerce" ? (
                  <>
                    <div className="store-api-info-title">WooCommerce REST API v3</div>
                    <div>Auth: Basic Auth (consumer key + secret)</div>
                    <div>Endpoint: <code>{form.url || "https://..."}/wp-json/wc/v3</code></div>
                  </>
                ) : (
                  <>
                    <div className="store-api-info-title">ShopBase Admin REST API</div>
                    <div>Auth: API key + secret in request header</div>
                    <div>Endpoint: <code>{form.url || "https://..."}/admin/products.json</code></div>
                  </>
                )}
              </div>

              {/* Test Connection */}
              <button className="btn btn-secondary" onClick={testConnection} disabled={testStatus === "testing"} style={{ width: "100%", marginTop: 12 }}>
                {testStatus === "testing" ? <><span className="upload-spinner" /> Testing…</> : "🔌 Test Connection"}
              </button>
              {testMessage && (
                <div className={`store-test-result ${testStatus}`}>{testMessage}</div>
              )}
            </div>
            <div className="upload-modal-footer">
              <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={!form.name || !form.url}>
                {editId ? "💾 Save Changes" : "➕ Add Store"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation ── */}
      {deleteId !== null && (
        <div className="upload-modal-overlay" onClick={() => setDeleteId(null)}>
          <div className="upload-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div className="upload-modal-header">
              <div className="upload-modal-title"><span className="upload-modal-icon">⚠️</span>Delete Store</div>
              <button className="upload-modal-close" onClick={() => setDeleteId(null)}>✕</button>
            </div>
            <div className="upload-modal-body">
              <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>
                Are you sure you want to remove <strong>{stores.find((s) => s.id === deleteId)?.name}</strong>? This action cannot be undone.
              </p>
            </div>
            <div className="upload-modal-footer">
              <button className="btn btn-secondary" onClick={() => setDeleteId(null)}>Cancel</button>
              <button className="btn btn-primary" style={{ background: "var(--error)" }} onClick={handleDelete}>🗑️ Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
