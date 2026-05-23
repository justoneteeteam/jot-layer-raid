"use client";

import { useState, useEffect } from "react";
import { 
  Team, 
  Template, 
  Player, 
  Font, 
  Patch, 
  Store, 
  fetchTeams, 
  fetchTemplates, 
  fetchPlayers, 
  fetchFonts, 
  fetchPatches, 
  fetchStores 
} from "../../lib/api";

const WIZARD_STEPS = [
  { num: 1, label: "Team & Template" },
  { num: 2, label: "Players" },
  { num: 3, label: "Font & Style" },
  { num: 4, label: "Variant Selection" },
  { num: 5, label: "Store & SEO" },
  { num: 6, label: "Review & Run" },
];

const MEN_SIZES = ["S", "M", "L", "XL", "2XL", "3XL", "4XL", "5XL", "Custom Size"];
const WOMEN_SIZES = ["XS", "S", "M", "L", "2XL", "3XL", "Custom Size"];
const YOUTH_SIZES = ["XS", "M", "L", "2XL", "3XL", "Custom Size"];

export default function BulkPage() {
  const [showWizard, setShowWizard] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [loading, setLoading] = useState(true);

  // Data from API
  const [teams, setTeams] = useState<Team[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [fonts, setFonts] = useState<Font[]>([]);
  const [patches, setPatches] = useState<Patch[]>([]);
  const [stores, setStores] = useState<Store[]>([]);

  // Wizard State
  const [jobName, setJobName] = useState("");
  const [selectedTeamId, setSelectedTeamId] = useState<number | "">("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | "">("");
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<number[]>([]);
  
  const [nameFontId, setNameFontId] = useState<number | "">("");
  const [numberFontId, setNumberFontId] = useState<number | "">("");
  const [nameColor, setNameColor] = useState("#FFFFFF");
  const [numberColor, setNumberColor] = useState("#FFFFFF");
  const [selectedPatchId, setSelectedPatchId] = useState<number | "">("");
  
  // Sizing checkbox state
  const [selectedMenSizes, setSelectedMenSizes] = useState<string[]>(["S", "M", "L", "XL", "2XL", "3XL", "4XL", "5XL"]);
  const [selectedWomenSizes, setSelectedWomenSizes] = useState<string[]>(["XS", "S", "M", "L", "2XL", "3XL"]);
  const [selectedYouthSizes, setSelectedYouthSizes] = useState<string[]>(["XS", "M", "L", "2XL", "3XL"]);
  const [customMenSize, setCustomMenSize] = useState("");
  const [customWomenSize, setCustomWomenSize] = useState("");
  const [customYouthSize, setCustomYouthSize] = useState("");

  // Store & SEO selection state
  const [selectedStoreId, setSelectedStoreId] = useState<number | "">("");
  const [seoTitlePattern, setSeoTitlePattern] = useState("{player_name} - {team_name} {template_name} Jersey");
  const [seoDescriptionHtml, setSeoDescriptionHtml] = useState(
`<p>Gear up with the official <strong>{player_name}</strong> jersey! Custom crafted featuring high-quality fabric, athletic font styling, and team graphics.</p>
<ul>
  <li><strong>Player:</strong> {player_name} (#{player_number})</li>
  <li><strong>Team:</strong> {team_name}</li>
  <li><strong>Style:</strong> {template_name}</li>
  <li><strong>Care:</strong> Machine wash cold, tumble dry low</li>
</ul>`
  );
  const [seoCategory, setSeoCategory] = useState("Jerseys");
  const [seoTags, setSeoTags] = useState("Jersey, {team_name}, {player_name}");

  const mockJobs = [
    { id: 1, name: "Eagles Full Roster 2026", team: "Philadelphia Eagles", template: "Eagles Home Green", status: "completed", total: 53, done: 53, created: "2026-05-08" },
    { id: 2, name: "Cowboys Legends Pack", team: "Dallas Cowboys", template: "Cowboys Away White", status: "running", total: 30, done: 18, created: "2026-05-10" },
  ];

  // Load initial data (Teams, Templates, Patches, Stores)
  useEffect(() => {
    Promise.all([
      fetchTeams(),
      fetchTemplates(),
      fetchPatches(),
      fetchStores().catch(() => [])
    ]).then(([teamsData, templatesData, patchesData, storesData]) => {
      setTeams(teamsData);
      setTemplates(templatesData);
      setPatches(patchesData);
      setStores(storesData);
      
      // Auto select first store if available
      const firstStore = storesData[0];
      if (firstStore) {
        setSelectedStoreId(firstStore.id);
      }
      
      setLoading(false);
    }).catch(err => {
      console.error(err);
      setLoading(false);
    });
  }, []);

  // When team changes, fetch players and fonts for that team
  useEffect(() => {
    if (selectedTeamId) {
      setAllPlayers([]);
      setFonts([]);
      Promise.all([
        fetchPlayers(Number(selectedTeamId)),
        fetchFonts(Number(selectedTeamId))
      ]).then(([playersData, fontsData]) => {
        setAllPlayers(playersData);
        // Fetch global fonts
        fetchFonts().then(globalFonts => {
          const combined = [...fontsData];
          globalFonts.forEach(gf => {
            if (!combined.find(f => f.id === gf.id)) combined.push(gf);
          });
          setFonts(combined);
        });
      });
    }
  }, [selectedTeamId]);

  const togglePlayer = (id: number) => {
    setSelectedPlayerIds(prev => 
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };
  
  const toggleAllPlayers = () => {
    if (selectedPlayerIds.length === allPlayers.length && allPlayers.length > 0) {
      setSelectedPlayerIds([]);
    } else {
      setSelectedPlayerIds(allPlayers.map(p => p.id));
    }
  };

  const handleNext = () => {
    // Basic validation per step
    if (wizardStep === 1 && (!selectedTeamId || !selectedTemplateId)) {
      alert("Please select a team and a template.");
      return;
    }
    if (wizardStep === 2 && selectedPlayerIds.length === 0) {
      alert("Please select at least one player.");
      return;
    }
    if (wizardStep === 4) {
      const totalChecked = selectedMenSizes.length + selectedWomenSizes.length + selectedYouthSizes.length;
      if (totalChecked === 0) {
        alert("Please select at least one size variant.");
        return;
      }
    }
    if (wizardStep === 5 && !selectedStoreId) {
      alert("Please select a store to map the products.");
      return;
    }
    if (wizardStep < WIZARD_STEPS.length) setWizardStep(s => s + 1);
  };

  const handleStart = () => {
    const selectedStore = stores.find(s => s.id === selectedStoreId);
    alert(`🚀 Started bulk generation job "${jobName || "Untitled"}" for ${selectedPlayerIds.length} players!\n\nStore Connection: ${selectedStore?.name || "Unknown"} (${selectedStore?.platform.toUpperCase()})\nTitle Pattern: ${seoTitlePattern}\nCategory: ${seoCategory}\nTags: ${seoTags}\n\nProducts and mockups will automatically generate and push to your store storefront!`);
    setShowWizard(false);
  };

  // Helper to compile final selected sizes list
  const getSelectedSizesSummary = () => {
    const list: string[] = [];
    selectedMenSizes.forEach(s => {
      if (s === "Custom Size") {
        if (customMenSize) list.push(`Men ${customMenSize}`);
      } else {
        list.push(`Men ${s}`);
      }
    });
    selectedWomenSizes.forEach(s => {
      if (s === "Custom Size") {
        if (customWomenSize) list.push(`Women ${customWomenSize}`);
      } else {
        list.push(`Women ${s}`);
      }
    });
    selectedYouthSizes.forEach(s => {
      if (s === "Custom Size") {
        if (customYouthSize) list.push(`Youth ${customYouthSize}`);
      } else {
        list.push(`Youth ${s}`);
      }
    });
    return list;
  };

  const activeSizes = getSelectedSizesSummary();

  return (
    <div>
      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">📋</div>
          <div className="stat-label">Total Jobs</div>
          <div className="stat-value">2</div>
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
            background: "var(--bg-primary)", borderRadius: 12, width: 850,
            maxHeight: "90vh", minHeight: 620, overflow: "hidden", boxShadow: "var(--shadow-lg)",
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
              {WIZARD_STEPS.map(step => (
                <div key={step.num} style={{
                  flex: 1, textAlign: "center", padding: "8px 4px", borderRadius: 6, fontSize: 10, fontWeight: 600,
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
              {loading ? (
                 <div style={{ textAlign: "center", padding: 48 }}>Loading wizard data...</div>
              ) : (
                <>
                  {wizardStep === 1 && (
                    <div style={{ maxWidth: 600, margin: "0 auto" }}>
                      <div className="form-group">
                        <label className="form-label">Job Name (Optional)</label>
                        <input className="input" placeholder="e.g. Eagles Full Roster 2026" value={jobName} onChange={e => setJobName(e.target.value)} />
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                        <div className="form-group">
                          <label className="form-label">Select Team</label>
                           <select className="input" value={selectedTeamId} onChange={e => setSelectedTeamId(e.target.value ? Number(e.target.value) : "")}>
                            <option value="">-- Choose a Team --</option>
                            {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                          </select>
                        </div>
                        <div className="form-group">
                          <label className="form-label">Mockup Template</label>
                          <select className="input" value={selectedTemplateId} onChange={e => setSelectedTemplateId(e.target.value ? Number(e.target.value) : "")}>
                            <option value="">-- Choose a Template --</option>
                            {templates.filter(t => !selectedTeamId || t.team_id === selectedTeamId || !t.team_id).map(t => (
                              <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      {selectedTemplateId && (
                        <div style={{ marginTop: 16, padding: 16, border: "1px solid var(--border-default)", borderRadius: 8, textAlign: "center" }}>
                          <div style={{ fontSize: 48, marginBottom: 8 }}>🎽</div>
                          <div style={{ fontWeight: 500 }}>{templates.find(t => t.id === selectedTemplateId)?.name}</div>
                        </div>
                      )}
                    </div>
                  )}

                  {wizardStep === 2 && (
                    <div>
                      <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 16 }}>Select players to include in this bulk run.</p>
                      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                        <button className="btn btn-secondary" onClick={toggleAllPlayers}>
                          {selectedPlayerIds.length === allPlayers.length && allPlayers.length > 0 ? "Deselect All" : "Select All"}
                        </button>
                        <span style={{ marginLeft: 16, fontWeight: 500, alignSelf: "center" }}>{selectedPlayerIds.length} Selected</span>
                      </div>
                      <div className="table-wrapper">
                        <table>
                          <thead><tr><th style={{ width: 40 }}></th><th>Player Name</th><th>#</th><th>Type</th></tr></thead>
                          <tbody>
                            {allPlayers.length === 0 ? (
                              <tr><td colSpan={4} style={{ textAlign: "center", padding: 32 }}>No players found for this team.</td></tr>
                            ) : (
                              allPlayers.map((p) => (
                                <tr key={p.id}>
                                  <td><input type="checkbox" checked={selectedPlayerIds.includes(p.id)} onChange={() => togglePlayer(p.id)} /></td>
                                  <td style={{ fontWeight: 500 }}>{p.display_name}</td>
                                  <td style={{ fontFamily: "monospace" }}>{p.number}</td>
                                  <td><span className={`badge ${p.type === "Legend" ? "badge-warning" : "badge-info"}`}>{p.type}</span></td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {wizardStep === 3 && (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32 }}>
                      <div>
                        <h4 style={{ marginBottom: 16, fontSize: 16, fontWeight: 600 }}>Typography</h4>
                        <div className="form-group">
                          <label className="form-label">Name Font</label>
                          <select className="input" value={nameFontId} onChange={e => setNameFontId(e.target.value ? Number(e.target.value) : "")}>
                            <option value="">-- Template Default --</option>
                            {fonts.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                          </select>
                        </div>
                        <div className="form-group">
                          <label className="form-label">Number Font</label>
                          <select className="input" value={numberFontId} onChange={e => setNumberFontId(e.target.value ? Number(e.target.value) : "")}>
                            <option value="">-- Template Default --</option>
                            {fonts.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                          </select>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                          <div className="form-group">
                            <label className="form-label">Name Color</label>
                            <input className="input" type="color" value={nameColor} onChange={e => setNameColor(e.target.value)} style={{ height: 40, padding: 4 }} />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Number Color</label>
                            <input className="input" type="color" value={numberColor} onChange={e => setNumberColor(e.target.value)} style={{ height: 40, padding: 4 }} />
                          </div>
                        </div>
                      </div>
                      
                      <div>
                        <h4 style={{ marginBottom: 16, fontSize: 16, fontWeight: 600 }}>Patches & Accents</h4>
                        <div className="form-group">
                          <label className="form-label">Patch (optional)</label>
                          <select className="input" value={selectedPatchId} onChange={e => setSelectedPatchId(e.target.value ? Number(e.target.value) : "")}>
                            <option value="">No patch</option>
                            {patches.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                          </select>
                        </div>
                        {selectedPatchId && (
                          <div style={{ padding: 16, border: "1px dashed var(--border-default)", borderRadius: 8, textAlign: "center" }}>
                            <img src={patches.find(p => p.id === selectedPatchId)?.image_url} alt="Patch" style={{ height: 80, objectFit: "contain" }} onError={(e) => { e.currentTarget.src = "https://placehold.co/80x80?text=Error" }} />
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {wizardStep === 4 && (
                    <div>
                      <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 20 }}>
                        Select the output sizes to generate variants for each player (multi-select checkboxes).
                      </p>
                      
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20 }}>
                        {/* Men Size column */}
                        <div style={{ padding: 16, borderRadius: 8, border: "1px solid var(--border-default)", backgroundColor: "var(--bg-secondary)" }}>
                          <h4 style={{ fontWeight: 600, fontSize: 14, marginBottom: 12, borderBottom: "1px solid var(--border-default)", paddingBottom: 6 }}>🚹 Men Sizes</h4>
                          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            {MEN_SIZES.map(size => {
                              const isChecked = selectedMenSizes.includes(size);
                              return (
                                <div key={size} style={{ display: "flex", flexDirection: "column" }}>
                                  <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13 }}>
                                    <input 
                                      type="checkbox" 
                                      checked={isChecked} 
                                      onChange={() => {
                                        setSelectedMenSizes(prev => 
                                          prev.includes(size) ? prev.filter(s => s !== size) : [...prev, size]
                                        );
                                      }}
                                    />
                                    <span>{size === "Custom Size" ? size : `Men ${size}`}</span>
                                  </label>
                                  {size === "Custom Size" && isChecked && (
                                    <input 
                                      className="input" 
                                      style={{ marginTop: 6, fontSize: 12, height: 32, padding: "4px 8px" }} 
                                      placeholder="e.g. 6XL, 7XL" 
                                      value={customMenSize} 
                                      onChange={e => setCustomMenSize(e.target.value)}
                                    />
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Women Size column */}
                        <div style={{ padding: 16, borderRadius: 8, border: "1px solid var(--border-default)", backgroundColor: "var(--bg-secondary)" }}>
                          <h4 style={{ fontWeight: 600, fontSize: 14, marginBottom: 12, borderBottom: "1px solid var(--border-default)", paddingBottom: 6 }}>🚺 Women Sizes</h4>
                          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            {WOMEN_SIZES.map(size => {
                              const isChecked = selectedWomenSizes.includes(size);
                              return (
                                <div key={size} style={{ display: "flex", flexDirection: "column" }}>
                                  <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13 }}>
                                    <input 
                                      type="checkbox" 
                                      checked={isChecked} 
                                      onChange={() => {
                                        setSelectedWomenSizes(prev => 
                                          prev.includes(size) ? prev.filter(s => s !== size) : [...prev, size]
                                        );
                                      }}
                                    />
                                    <span>{size === "Custom Size" ? size : `Women ${size}`}</span>
                                  </label>
                                  {size === "Custom Size" && isChecked && (
                                    <input 
                                      className="input" 
                                      style={{ marginTop: 6, fontSize: 12, height: 32, padding: "4px 8px" }} 
                                      placeholder="e.g. XXS" 
                                      value={customWomenSize} 
                                      onChange={e => setCustomWomenSize(e.target.value)}
                                    />
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Youth Size column */}
                        <div style={{ padding: 16, borderRadius: 8, border: "1px solid var(--border-default)", backgroundColor: "var(--bg-secondary)" }}>
                          <h4 style={{ fontWeight: 600, fontSize: 14, marginBottom: 12, borderBottom: "1px solid var(--border-default)", paddingBottom: 6 }}>🧒 Youth Sizes</h4>
                          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            {YOUTH_SIZES.map(size => {
                              const isChecked = selectedYouthSizes.includes(size);
                              return (
                                <div key={size} style={{ display: "flex", flexDirection: "column" }}>
                                  <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13 }}>
                                    <input 
                                      type="checkbox" 
                                      checked={isChecked} 
                                      onChange={() => {
                                        setSelectedYouthSizes(prev => 
                                          prev.includes(size) ? prev.filter(s => s !== size) : [...prev, size]
                                        );
                                      }}
                                    />
                                    <span>{size === "Custom Size" ? size : `Youth ${size}`}</span>
                                  </label>
                                  {size === "Custom Size" && isChecked && (
                                    <input 
                                      className="input" 
                                      style={{ marginTop: 6, fontSize: 12, height: 32, padding: "4px 8px" }} 
                                      placeholder="e.g. YS, YM" 
                                      value={customYouthSize} 
                                      onChange={e => setCustomYouthSize(e.target.value)}
                                    />
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {wizardStep === 5 && (
                    <div style={{ maxWidth: 800, margin: "0 auto", display: "flex", flexDirection: "column", gap: 24 }}>
                      <div>
                        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>🏪 Store Connection</h3>
                        <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 16 }}>
                          Select the store connection to push the generated jersey mockup products to.
                        </p>
                        
                        {stores.length === 0 ? (
                          <div style={{ padding: 24, border: "1px dashed var(--border-default)", borderRadius: 12, textAlign: "center" }}>
                            <div style={{ fontSize: 32, marginBottom: 12 }}>🏪</div>
                            <h4 style={{ fontWeight: 600, marginBottom: 6 }}>No connected stores found</h4>
                            <p style={{ color: "var(--text-secondary)", fontSize: 12, marginBottom: 16 }}>
                              Please connect a WooCommerce or ShopBase store in settings first.
                            </p>
                            <a href="/settings" className="btn btn-secondary" style={{ padding: "6px 12px", fontSize: 13 }}>
                              ⚙️ Go to Store Settings
                            </a>
                          </div>
                        ) : (
                          <div className="form-group">
                            <select 
                              className="input" 
                              value={selectedStoreId} 
                              onChange={e => setSelectedStoreId(e.target.value ? Number(e.target.value) : "")}
                            >
                              <option value="">-- Choose a Connected Store --</option>
                              {stores.map(s => (
                                <option key={s.id} value={s.id}>
                                  {s.name} ({s.platform.toUpperCase()}) - {s.url}
                                </option>
                              ))}
                            </select>
                            
                            {selectedStoreId && (
                              <div style={{ 
                                marginTop: 12, padding: 12, borderRadius: 8, 
                                border: "1px solid var(--border-default)", backgroundColor: "var(--bg-secondary)",
                                display: "flex", alignItems: "center", gap: 12
                              }}>
                                <div style={{ fontSize: 24 }}>🏪</div>
                                <div>
                                  <div style={{ fontWeight: 600, fontSize: 13 }}>
                                    {stores.find(s => s.id === selectedStoreId)?.name}
                                  </div>
                                  <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>
                                    Platform: <span className="badge badge-info" style={{ textTransform: "uppercase", fontSize: 9 }}>{stores.find(s => s.id === selectedStoreId)?.platform}</span>
                                    <span style={{ margin: "0 8px" }}>|</span>
                                    URL: <a href={stores.find(s => s.id === selectedStoreId)?.url} target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>{stores.find(s => s.id === selectedStoreId)?.url}</a>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {selectedStoreId && (
                        <div style={{ borderTop: "1px solid var(--border-default)", paddingTop: 24 }}>
                          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>🌐 SEO & E-commerce Listing Settings</h3>
                          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 20 }}>
                            Configure the titles, descriptions, categories, and tags to push to your storefront. Use dynamic tags to substitute player-specific metadata.
                          </p>

                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                            <div className="form-group">
                              <label className="form-label" style={{ fontWeight: 600, fontSize: 13 }}>Product Title Pattern</label>
                              <input 
                                className="input" 
                                value={seoTitlePattern} 
                                onChange={e => setSeoTitlePattern(e.target.value)} 
                                placeholder="e.g. {player_name} Jersey"
                              />
                              <span style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4, display: "block" }}>
                                Example: <em>John Doe - Eagles Home Green Jersey</em>
                              </span>
                            </div>
                            
                            <div className="form-group" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                              <div>
                                <label className="form-label" style={{ fontWeight: 600, fontSize: 13 }}>Product Category</label>
                                <input 
                                  className="input" 
                                  value={seoCategory} 
                                  onChange={e => setSeoCategory(e.target.value)} 
                                  placeholder="e.g. Jerseys, NFL Apparel"
                                />
                              </div>
                              <div>
                                <label className="form-label" style={{ fontWeight: 600, fontSize: 13 }}>Product Tags</label>
                                  <input 
                                  className="input" 
                                  value={seoTags} 
                                  onChange={e => setSeoTags(e.target.value)} 
                                  placeholder="e.g. jerseys, NFL, fanwear"
                                />
                              </div>
                            </div>
                          </div>

                          <div className="form-group">
                            <label className="form-label" style={{ fontWeight: 600, fontSize: 13 }}>
                              Description HTML Setup
                            </label>
                            
                            {/* Variable chips helper */}
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8, alignItems: "center" }}>
                              <span style={{ fontSize: 11, color: "var(--text-secondary)", marginRight: 4 }}>Available placeholders (click to insert):</span>
                              {["{player_name}", "{player_number}", "{team_name}", "{template_name}"].map(token => (
                                <button 
                                  key={token}
                                  type="button"
                                  className="badge badge-info"
                                  style={{ border: "none", cursor: "pointer", padding: "2px 6px", fontSize: 10, textTransform: "none" }}
                                  onClick={() => {
                                    setSeoDescriptionHtml(prev => prev + " " + token);
                                  }}
                                >
                                  {token}
                                </button>
                              ))}
                            </div>

                            <textarea 
                              className="input" 
                              style={{ 
                                height: 160, fontFamily: "Consolas, Monaco, monospace", fontSize: 12, lineHeight: "1.5",
                                backgroundColor: "var(--bg-tertiary)", color: "var(--text-primary)", padding: "12px", borderRadius: 8
                              }}
                              value={seoDescriptionHtml} 
                              onChange={e => setSeoDescriptionHtml(e.target.value)}
                              placeholder="Write standard HTML description templates..."
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {wizardStep === 6 && (
                    <div style={{ maxWidth: 600, margin: "0 auto" }}>
                      <div style={{ padding: 24, backgroundColor: "var(--bg-secondary)", borderRadius: 12, border: "1px solid var(--border-default)" }}>
                        <h3 style={{ fontSize: 20, fontWeight: 600, marginBottom: 24 }}>Ready to Generate</h3>
                        
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12, borderBottom: "1px solid var(--border-default)", paddingBottom: 12 }}>
                          <span style={{ color: "var(--text-secondary)" }}>Job Name</span>
                          <span style={{ fontWeight: 500 }}>{jobName || "Untitled"}</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12, borderBottom: "1px solid var(--border-default)", paddingBottom: 12 }}>
                          <span style={{ color: "var(--text-secondary)" }}>Team</span>
                          <span style={{ fontWeight: 500 }}>{teams.find(t => t.id === selectedTeamId)?.name || "None"}</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12, borderBottom: "1px solid var(--border-default)", paddingBottom: 12 }}>
                          <span style={{ color: "var(--text-secondary)" }}>Template</span>
                          <span style={{ fontWeight: 500 }}>{templates.find(t => t.id === selectedTemplateId)?.name || "None"}</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12, borderBottom: "1px solid var(--border-default)", paddingBottom: 12 }}>
                          <span style={{ color: "var(--text-secondary)" }}>Target Store</span>
                          <span style={{ fontWeight: 600, color: "var(--accent)" }}>
                            🏪 {stores.find(s => s.id === selectedStoreId)?.name || "None Selected"}
                          </span>
                        </div>
                        
                        {/* SEO Fields in Review */}
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12, borderBottom: "1px solid var(--border-default)", paddingBottom: 12 }}>
                          <span style={{ color: "var(--text-secondary)" }}>Title Pattern</span>
                          <span style={{ fontWeight: 500, fontFamily: "monospace", fontSize: 11 }}>{seoTitlePattern}</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12, borderBottom: "1px solid var(--border-default)", paddingBottom: 12 }}>
                          <span style={{ color: "var(--text-secondary)" }}>Category & Tags</span>
                          <div style={{ textAlign: "right" }}>
                            <span className="badge badge-info" style={{ marginRight: 6 }}>📁 {seoCategory}</span>
                            <span className="badge badge-secondary" style={{ fontSize: 10 }}>🏷️ {seoTags}</span>
                          </div>
                        </div>
                        
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12, borderBottom: "1px solid var(--border-default)", paddingBottom: 12 }}>
                          <span style={{ color: "var(--text-secondary)" }}>Players Selected</span>
                          <span style={{ fontWeight: 500 }}>{selectedPlayerIds.length}</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12, borderBottom: "1px solid var(--border-default)", paddingBottom: 12 }}>
                          <span style={{ color: "var(--text-secondary)" }}>Selected Size Variants ({activeSizes.length})</span>
                          <div style={{ textAlign: "right", maxWidth: 300, display: "flex", flexWrap: "wrap", gap: 4, justifyContent: "flex-end" }}>
                            {activeSizes.map(s => (
                              <span key={s} className="badge badge-info" style={{ fontSize: 10 }}>{s}</span>
                            ))}
                          </div>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12, borderBottom: "1px solid var(--border-default)", paddingBottom: 12 }}>
                          <span style={{ color: "var(--text-secondary)" }}>Total Products</span>
                          <span style={{ fontWeight: 600, color: "var(--primary)" }}>
                            {selectedPlayerIds.length} Products
                          </span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12, borderBottom: "1px solid var(--border-default)", paddingBottom: 12 }}>
                          <span style={{ color: "var(--text-secondary)" }}>Mockup Images</span>
                          <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                            {selectedPlayerIds.length} Images (1 per product)
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </>
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
                onClick={() => wizardStep === WIZARD_STEPS.length ? handleStart() : handleNext()}
                style={wizardStep === WIZARD_STEPS.length ? { backgroundColor: "#2e7d32", color: "#fff", border: "none" } : {}}
              >
                {wizardStep === WIZARD_STEPS.length ? "🚀 Start Bulk Job" : "Next →"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

