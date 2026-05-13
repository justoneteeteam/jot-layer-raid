"use client";

import { useState } from "react";

export default function BulkPage() {
  const [showWizard, setShowWizard] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);

  const mockJobs = [
    { id: 1, name: "Eagles Full Roster 2026", team: "Philadelphia Eagles", template: "Eagles Home Green", status: "completed", total: 53, done: 53, created: "2026-05-08" },
    { id: 2, name: "Cowboys Legends Pack", team: "Dallas Cowboys", template: "Cowboys Away White", status: "running", total: 30, done: 18, created: "2026-05-10" },
    { id: 3, name: "Ravens Current Roster", team: "Baltimore Ravens", template: "Ravens Alternate Black", status: "queued", total: 45, done: 0, created: "2026-05-10" },
  ];

  const wizardSteps = [
    { num: 1, label: "Team & Template" },
    { num: 2, label: "Players" },
    { num: 3, label: "Font & Style" },
    { num: 4, label: "Category & SEO" },
    { num: 5, label: "Target Stores" },
    { num: 6, label: "Review & Run" },
    { num: 7, label: "Sheets Export" },
  ];

  return (
    <div>
      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">📋</div>
          <div className="stat-label">Total Jobs</div>
          <div className="stat-value">3</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">✅</div>
          <div className="stat-label">Completed</div>
          <div className="stat-value">1</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">⏳</div>
          <div className="stat-label">Running</div>
          <div className="stat-value">1</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">🖼️</div>
          <div className="stat-label">Images Generated</div>
          <div className="stat-value">71</div>
        </div>
      </div>

      {/* Jobs Table */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Bulk Jobs</h2>
          <button className="btn btn-primary" onClick={() => { setShowWizard(true); setWizardStep(1); }}>
            ➕ New Bulk Job
          </button>
        </div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Job Name</th>
                <th>Team</th>
                <th>Template</th>
                <th>Progress</th>
                <th>Status</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {mockJobs.map(job => (
                <tr key={job.id}>
                  <td style={{ fontWeight: 500 }}>{job.name}</td>
                  <td>{job.team}</td>
                  <td>{job.template}</td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ flex: 1, height: 6, borderRadius: 999, background: "var(--bg-tertiary)", overflow: "hidden" }}>
                        <div style={{
                          width: `${(job.done / job.total) * 100}%`,
                          height: "100%",
                          borderRadius: 999,
                          background: job.status === "completed" ? "var(--success)" : "var(--accent)",
                          transition: "width 300ms ease"
                        }} />
                      </div>
                      <span style={{ fontSize: 12, color: "var(--text-secondary)", whiteSpace: "nowrap" }}>{job.done}/{job.total}</span>
                    </div>
                  </td>
                  <td>
                    <span className={`badge ${job.status === "completed" ? "badge-success" : job.status === "running" ? "badge-info" : "badge-warning"}`}>
                      {job.status === "running" ? "⏳ Running" : job.status === "completed" ? "✅ Done" : "🕐 Queued"}
                    </span>
                  </td>
                  <td style={{ fontSize: 13, color: "var(--text-secondary)" }}>{job.created}</td>
                  <td>
                    <button className="btn btn-ghost">👁️</button>
                    <button className="btn btn-ghost">🗑️</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── New Bulk Job Wizard Modal ── */}
      {showWizard && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 100,
          display: "flex", alignItems: "center", justifyContent: "center",
        }} onClick={() => setShowWizard(false)}>
          <div style={{
            background: "var(--bg-primary)", borderRadius: 12, width: 720,
            maxHeight: "85vh", overflow: "hidden", boxShadow: "var(--shadow-lg)",
            display: "flex", flexDirection: "column",
          }} onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border-default)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, fontWeight: 700 }}>
                ➕ New Bulk Job
              </h2>
              <button className="btn btn-ghost" onClick={() => setShowWizard(false)} style={{ fontSize: 18 }}>✕</button>
            </div>

            {/* Step Indicator */}
            <div style={{ padding: "16px 24px", borderBottom: "1px solid var(--border-default)", display: "flex", gap: 4 }}>
              {wizardSteps.map(step => (
                <div key={step.num} style={{
                  flex: 1, textAlign: "center", padding: "8px 4px", borderRadius: 6, fontSize: 11, fontWeight: 600,
                  background: wizardStep === step.num ? "var(--accent)" : wizardStep > step.num ? "var(--accent-light)" : "var(--bg-tertiary)",
                  color: wizardStep === step.num ? "white" : wizardStep > step.num ? "var(--accent)" : "var(--text-muted)",
                  cursor: "pointer", transition: "all 150ms ease",
                }} onClick={() => setWizardStep(step.num)}>
                  {step.num}. {step.label}
                </div>
              ))}
            </div>

            {/* Step Content */}
            <div style={{ padding: 24, flex: 1, overflowY: "auto" }}>

              {wizardStep === 1 && (
                <div>
                  <div className="form-group">
                    <label className="form-label">Job Name</label>
                    <input className="input" placeholder="e.g. Eagles Full Roster 2026" />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                    <div className="form-group">
                      <label className="form-label">Team</label>
                      <select className="input">
                        <option value="">Select team...</option>
                        <option>Philadelphia Eagles</option>
                        <option>Dallas Cowboys</option>
                        <option>Baltimore Ravens</option>
                        <option>Las Vegas Raiders</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Mockup Template</label>
                      <select className="input">
                        <option value="">Select template...</option>
                        <option>Eagles Home Green</option>
                        <option>Cowboys Away White</option>
                        <option>Ravens Alternate Black</option>
                      </select>
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Variants</label>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {["Men", "Women", "Youth"].map(v => (
                        <label key={v} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", border: "1px solid var(--border-default)", borderRadius: 8, cursor: "pointer", fontSize: 14 }}>
                          <input type="checkbox" defaultChecked={v === "Men"} /> {v}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {wizardStep === 2 && (
                <div>
                  <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 16 }}>Select players to include in this bulk run. Players are pulled from the team database.</p>
                  <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                    <button className="btn btn-secondary">☑️ Select All (53)</button>
                    <button className="btn btn-secondary">🔄 Current Only</button>
                    <button className="btn btn-secondary">⭐ Legends Only</button>
                  </div>
                  <div className="table-wrapper">
                    <table>
                      <thead><tr><th style={{ width: 40 }}></th><th>Player</th><th>#</th><th>Type</th></tr></thead>
                      <tbody>
                        {[{ n: "Jalen Hurts", num: 1, t: "Current" }, { n: "A.J. Brown", num: 11, t: "Current" }, { n: "DeVonta Smith", num: 6, t: "Current" }, { n: "Jason Kelce", num: 62, t: "Legend" }].map((p, i) => (
                          <tr key={i}>
                            <td><input type="checkbox" defaultChecked /></td>
                            <td style={{ fontWeight: 500 }}>{p.n}</td>
                            <td style={{ fontFamily: "monospace" }}>{p.num}</td>
                            <td><span className={`badge ${p.t === "Legend" ? "badge-warning" : "badge-info"}`}>{p.t}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {wizardStep === 3 && (
                <div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                    <div className="form-group">
                      <label className="form-label">Name Font</label>
                      <select className="input">
                        <option>NFL Block Bold</option>
                        <option>Eagles Custom</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Number Font</label>
                      <select className="input">
                        <option>NFL Block Bold</option>
                        <option>Eagles Custom</option>
                      </select>
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                    <div className="form-group">
                      <label className="form-label">Name Color</label>
                      <input className="input" type="color" defaultValue="#FFFFFF" style={{ height: 40, padding: 4 }} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Number Color</label>
                      <input className="input" type="color" defaultValue="#FFFFFF" style={{ height: 40, padding: 4 }} />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Patch (optional)</label>
                    <select className="input">
                      <option value="">No patch</option>
                      <option>Super Bowl LVII</option>
                      <option>Captain Patch (C)</option>
                    </select>
                  </div>
                </div>
              )}

              {wizardStep === 4 && (
                <div>
                  <div className="form-group">
                    <label className="form-label">Product Category Format</label>
                    <input className="input" value="{domain}-{player-name}-{team}-{number}-jersey" readOnly style={{ background: "var(--bg-secondary)" }} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Title Template</label>
                    <input className="input" defaultValue="{player_name} #{number} {team} Jersey - {variant}" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Description Keywords</label>
                    <textarea className="input" style={{ height: 80, padding: 10, resize: "vertical" }} defaultValue="NFL, jersey, custom, authentic, football, fan gear" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Internal Links (future)</label>
                    <input className="input" placeholder="Configured per store later..." disabled />
                  </div>
                </div>
              )}

              {wizardStep === 5 && (
                <div>
                  <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 16 }}>Choose which stores to publish this batch to. Each variant becomes a separate product.</p>
                  {[
                    { name: "WaiRaiders Store", platform: "WooCommerce", url: "wairaiders.com" },
                    { name: "Eagles Gear Shop", platform: "WooCommerce", url: "eaglesgear.shop" },
                    { name: "JerseyHub SB", platform: "Shopbase", url: "jerseyhub.onshopbase.com" },
                  ].map((s, i) => (
                    <label key={i} style={{
                      display: "flex", alignItems: "center", gap: 12, padding: 16,
                      border: "1px solid var(--border-default)", borderRadius: 8, marginBottom: 8, cursor: "pointer",
                    }}>
                      <input type="checkbox" defaultChecked={i < 2} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 500 }}>{s.name}</div>
                        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{s.platform} · {s.url}</div>
                      </div>
                      <span className={`badge ${s.platform === "WooCommerce" ? "badge-info" : "badge-warning"}`}>{s.platform}</span>
                    </label>
                  ))}
                </div>
              )}

              {wizardStep === 6 && (
                <div>
                  <h3 style={{ marginBottom: 16 }}>Review Summary</h3>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    {[
                      ["Team", "Philadelphia Eagles"],
                      ["Template", "Eagles Home Green"],
                      ["Players", "53 selected"],
                      ["Variants", "Men, Women, Youth"],
                      ["Total Images", "159"],
                      ["Total Products", "159"],
                      ["Stores", "2 selected"],
                      ["Font", "NFL Block Bold"],
                    ].map(([k, v]) => (
                      <div key={k} style={{ padding: "12px 16px", background: "var(--bg-secondary)", borderRadius: 8 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 4 }}>{k}</div>
                        <div style={{ fontWeight: 500 }}>{v}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop: 20, padding: 16, background: "#DCFCE7", borderRadius: 8, fontSize: 14, color: "var(--success)" }}>
                    ✅ Ready to generate! This will create <strong>159 product images</strong> and push them to <strong>2 stores</strong>.
                  </div>
                </div>
              )}

              {wizardStep === 7 && (
                <div>
                  <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 16 }}>After publishing, all product data will be logged to Google Sheets for tracking.</p>
                  <div className="form-group">
                    <label className="form-label">Google Sheets URL</label>
                    <input className="input" placeholder="https://docs.google.com/spreadsheets/d/..." />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Sheet Tab Name</label>
                    <input className="input" defaultValue="Products" />
                  </div>
                  <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 8 }}>Columns exported: Product Name, URL, SKU, Store, Team, Player, Number, Variant, Published Date</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{ padding: "16px 24px", borderTop: "1px solid var(--border-default)", display: "flex", justifyContent: "space-between" }}>
              <button
                className="btn btn-secondary"
                onClick={() => wizardStep === 1 ? setShowWizard(false) : setWizardStep(wizardStep - 1)}
              >
                {wizardStep === 1 ? "Cancel" : "← Back"}
              </button>
              <button
                className="btn btn-primary"
                onClick={() => wizardStep === 7 ? setShowWizard(false) : setWizardStep(wizardStep + 1)}
              >
                {wizardStep === 7 ? "🚀 Start Bulk Job" : wizardStep === 6 ? "Next → Sheets" : "Next →"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
