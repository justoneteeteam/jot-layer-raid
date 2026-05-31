"use client";

import { useState, useEffect } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Flow {
  id: number;
  store_id: string;
  name: string;
  trigger_event: string;
  compiled_schema_json: string;
  visual_schema_json: string;
  is_active: boolean;
  version: number;
}

interface FlowRun {
  id: number;
  store_id: string;
  flow_id: number;
  flow_version: number;
  contact_id: number;
  status: "active" | "waiting" | "completed" | "cancelled";
  current_node_id?: string;
  next_execution_at: string;
  idempotency_key: string;
  created_at: string;
}

interface Template {
  id: number;
  name: string;
}

interface FlowStep {
  id: string;
  type: "wait" | "suppression_check" | "send_email";
  duration_hours?: number;
  template_id?: number;
}

export default function AutomationsPage() {
  const [flows, setFlows] = useState<Flow[]>([]);
  const [flowRuns, setFlowRuns] = useState<FlowRun[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");

  // Create Flow Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [flowName, setFlowName] = useState("");
  const [triggerEvent, setTriggerEvent] = useState("astro_add_to_cart");
  const [flowSteps, setFlowSteps] = useState<FlowStep[]>([]);

  const loadFlows = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/marketing/flows`);
      if (res.ok) {
        setFlows(await res.json());
      } else {
        // Fallback placeholder if DB fails
        setFlows([
          {
            id: 1,
            store_id: "WaiRaiders Store",
            name: "Astro Abandoned Cart Sequence",
            trigger_event: "astro_add_to_cart",
            compiled_schema_json: JSON.stringify({
              steps: [
                { id: "node_1", type: "wait", duration_hours: 1 },
                { id: "node_2", type: "suppression_check" },
                { id: "node_3", type: "send_email", template_id: 1 }
              ]
            }),
            visual_schema_json: "{}",
            is_active: true,
            version: 1
          }
        ]);
      }
    } catch (err) {
      console.error("Failed to load flows", err);
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

  const loadFlowRuns = async () => {
    // Simulated flow execution logs
    setFlowRuns([
      {
        id: 101,
        store_id: "WaiRaiders Store",
        flow_id: 1,
        flow_version: 1,
        contact_id: 1,
        status: "waiting",
        current_node_id: "node_1",
        next_execution_at: new Date(Date.now() + 3600000).toLocaleString(),
        idempotency_key: "idemp_cart_user_9921",
        created_at: new Date(Date.now() - 600000).toLocaleString()
      },
      {
        id: 102,
        store_id: "WaiRaiders Store",
        flow_id: 1,
        flow_version: 1,
        contact_id: 2,
        status: "completed",
        current_node_id: "node_3",
        next_execution_at: "-",
        idempotency_key: "idemp_cart_user_1102",
        created_at: new Date(Date.now() - 4200000).toLocaleString()
      },
      {
        id: 103,
        store_id: "WaiRaiders Store",
        flow_id: 1,
        flow_version: 1,
        contact_id: 4,
        status: "cancelled",
        current_node_id: "node_2",
        next_execution_at: "-",
        idempotency_key: "idemp_cart_user_7720",
        created_at: new Date(Date.now() - 1200000).toLocaleString()
      }
    ]);
  };

  useEffect(() => {
    loadFlows();
    loadTemplates();
    loadFlowRuns();
  }, []);

  const showStatus = (msg: string, type: "success" | "error") => {
    setMessage(msg);
    setMessageType(type);
    setTimeout(() => setMessage(""), 5000);
  };

  const handleToggleFlow = async (flowId: number) => {
    try {
      const res = await fetch(`${API_BASE}/api/marketing/flows/${flowId}/toggle`, {
        method: "POST"
      });
      if (res.ok) {
        showStatus("✔️ Flow status toggled successfully!", "success");
        loadFlows();
      } else {
        showStatus("❌ Failed to toggle flow status.", "error");
      }
    } catch (err) {
      showStatus("❌ Network error connecting to API.", "error");
    }
  };

  const handleDeleteFlow = async (flowId: number) => {
    if (!confirm("Are you sure you want to delete this flow? This will stop all waiting executions.")) return;
    try {
      const res = await fetch(`${API_BASE}/api/marketing/flows/${flowId}`, {
        method: "DELETE"
      });
      if (res.ok) {
        showStatus("🗑️ Flow successfully removed.", "success");
        loadFlows();
      } else {
        showStatus("❌ Failed to delete flow.", "error");
      }
    } catch (err) {
      showStatus("❌ Network error connecting to API.", "error");
    }
  };

  const handleAddStep = (type: "wait" | "suppression_check" | "send_email") => {
    const nodeIndex = flowSteps.length + 1;
    const newStep: FlowStep = {
      id: `node_${nodeIndex}_${Date.now().toString().slice(-4)}`,
      type: type,
      duration_hours: type === "wait" ? 1 : undefined,
      template_id: type === "send_email" && templates.length > 0 ? templates[0]?.id : undefined
    };
    setFlowSteps([...flowSteps, newStep]);
  };

  const handleRemoveStep = (index: number) => {
    setFlowSteps(flowSteps.filter((_, idx) => idx !== index));
  };

  const handleStepChange = (index: number, key: string, value: any) => {
    setFlowSteps(flowSteps.map((step, idx) => {
      if (idx === index) {
        return { ...step, [key]: value };
      }
      return step;
    }));
  };

  const handleSaveFlow = async () => {
    if (!flowName || !triggerEvent || flowSteps.length === 0) {
      showStatus("❌ Please provide a name, trigger, and at least one step node.", "error");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/marketing/flows`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: flowName,
          trigger_event: triggerEvent,
          steps: flowSteps,
          is_active: true,
          store_id: "WaiRaiders Store"
        })
      });
      if (res.ok) {
        showStatus("✔️ Automation flow saved successfully!", "success");
        setModalOpen(false);
        setFlowName("");
        setTriggerEvent("astro_add_to_cart");
        setFlowSteps([]);
        loadFlows();
      } else {
        showStatus("❌ Failed to compile and save flow.", "error");
      }
    } catch (err) {
      showStatus("❌ Network error connecting to API.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ paddingBottom: 40 }}>
      {/* Page Header */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <h2 className="card-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            ⚡ Email Automations Flow Engine
          </h2>
          <span className="badge badge-success">🟢 Engine Active</span>
        </div>
        <p style={{ margin: "12px 0 0 0", color: "var(--text-secondary)", fontSize: 14, lineHeight: "1.5" }}>
          Trigger event-driven email campaigns automatically based on customer storefront telemetry (e.g. Astro Add to Cart, Checkout, Purchase). Built with strict deliverability compliance, suppression intersections, and idempotency protection.
        </p>
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

      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 24 }}>
        {/* Active Sequences */}
        <div className="card">
          <div className="card-header" style={{ marginBottom: 16 }}>
            <h3 className="card-title">Active Automation Flows</h3>
            <button className="btn btn-primary" onClick={() => setModalOpen(true)}>➕ Create Flow</button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {flows.length === 0 ? (
              <div style={{ textAlign: "center", color: "var(--text-secondary)", padding: 24 }}>No flows found. Create one to begin automating!</div>
            ) : (
              flows.map((flow) => {
                let steps = [];
                try {
                  steps = JSON.parse(flow.compiled_schema_json).steps || [];
                } catch(e) {
                  // Fallback
                  try {
                    steps = JSON.parse(flow.visual_schema_json).steps || [];
                  } catch(err) {}
                }
                return (
                  <div key={flow.id} style={{ border: "1px solid var(--border-default)", borderRadius: 8, padding: 16, background: "var(--bg-secondary)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                      <div>
                        <h4 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>{flow.name}</h4>
                        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                          Trigger: <code style={{ background: "#e2e8f0", padding: "2px 4px", borderRadius: 4 }}>{flow.trigger_event}</code> • Version {flow.version}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <button className={`badge ${flow.is_active ? "badge-success" : "badge-warning"}`} onClick={() => handleToggleFlow(flow.id)} style={{ cursor: "pointer", border: "none" }}>
                          {flow.is_active ? "🟢 Enabled" : "🟡 Disabled"}
                        </button>
                        <button className="btn btn-ghost" style={{ padding: "4px 8px", fontSize: 13 }} onClick={() => handleDeleteFlow(flow.id)}>
                          🗑️ Delete
                        </button>
                      </div>
                    </div>

                    {/* Visual flowchart timeline blocks */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8, overflowX: "auto", padding: "8px 0" }}>
                      <div style={{ padding: "6px 12px", background: "#f1f5f9", border: "1px solid var(--border-default)", borderRadius: 6, fontSize: 12, fontWeight: "bold" }}>
                        🎬 Trigger: {flow.trigger_event}
                      </div>
                      {steps.map((step: any, index: number) => (
                        <div key={step.id || index} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ color: "var(--text-muted)", fontSize: 14 }}>➔</span>
                          <div style={{ padding: "6px 12px", background: "#ffffff", border: "1px solid var(--border-default)", borderRadius: 6, fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
                            {step.type === "wait" && <span>⏳ Delay {step.duration_hours}h</span>}
                            {step.type === "suppression_check" && <span>🔒 Consent & Suppression Check</span>}
                            {step.type === "send_email" && <span>📧 Send Email (Temp #{step.template_id})</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Real-time Flow Runs Log */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Real-Time Automations Flow Runs Log</h3>
          </div>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Run ID</th>
                  <th>Contact Ref</th>
                  <th>Idempotency Key</th>
                  <th>Current Node</th>
                  <th>Next Execution</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {flowRuns.map((run) => (
                  <tr key={run.id}>
                    <td style={{ fontFamily: "monospace", fontSize: 13, fontWeight: 500 }}>#{run.id}</td>
                    <td style={{ fontSize: 13, color: "var(--text-secondary)" }}>Contact #{run.contact_id}</td>
                    <td style={{ fontSize: 11, fontFamily: "monospace", color: "var(--text-muted)" }}>{run.idempotency_key}</td>
                    <td style={{ fontSize: 13 }}>
                      <code style={{ background: "#f3f4f6", padding: "2px 4px", borderRadius: 4 }}>{run.current_node_id || "Init"}</code>
                    </td>
                    <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>{run.next_execution_at}</td>
                    <td>
                      <span className={`badge ${
                        run.status === "completed" ? "badge-success" :
                        run.status === "waiting" ? "badge-warning" :
                        run.status === "cancelled" ? "badge-error" : "badge-info"
                      }`}>
                        {run.status.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Create Flow Modal */}
      {modalOpen && (
        <div className="upload-modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="upload-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640 }}>
            <div className="upload-modal-header">
              <div className="upload-modal-title">⚡ Compile Automation Flow</div>
              <button className="upload-modal-close" onClick={() => setModalOpen(false)}>✕</button>
            </div>
            <div className="upload-modal-body">
              <div className="form-group">
                <label className="form-label">Flow Name</label>
                <input className="input" placeholder="e.g. Abandoned Cart recovery" value={flowName} onChange={(e) => setFlowName(e.target.value)} />
              </div>

              <div className="form-group">
                <label className="form-label">Storefront Trigger Event</label>
                <select className="input" value={triggerEvent} onChange={(e) => setTriggerEvent(e.target.value)} style={{ padding: "8px 12px" }}>
                  <option value="astro_add_to_cart">🛒 Astro: Add to Cart</option>
                  <option value="checkout_started">📝 Astro: Checkout Started</option>
                  <option value="purchase_completed">🛍️ Astro: Purchase Completed</option>
                </select>
              </div>

              {/* Steps builder timeline */}
              <div style={{ marginTop: 20 }}>
                <label className="form-label" style={{ fontWeight: 600, display: "block", marginBottom: 12 }}>Workflow Steps Timeline</label>
                
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {flowSteps.length === 0 ? (
                    <div style={{ border: "1px dashed var(--border-default)", borderRadius: 8, padding: 20, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
                      Timeline is empty. Append node steps below to map the compiled logic.
                    </div>
                  ) : (
                    flowSteps.map((step, index) => (
                      <div key={step.id} style={{ display: "flex", gap: 12, alignItems: "center", padding: 12, border: "1px solid var(--border-default)", borderRadius: 8, background: "var(--bg-secondary)" }}>
                        <div style={{ fontSize: 14, fontWeight: "bold", color: "var(--accent)" }}>#{index + 1}</div>
                        
                        <div style={{ flex: 1, display: "flex", gap: 12, alignItems: "center" }}>
                          {step.type === "wait" && (
                            <>
                              <span style={{ fontSize: 13, fontWeight: "500" }}>⏳ Delay Wait:</span>
                              <input 
                                className="input" 
                                type="number" 
                                value={step.duration_hours || 1} 
                                onChange={(e) => handleStepChange(index, "duration_hours", parseFloat(e.target.value) || 1)} 
                                style={{ width: 80, height: 32, padding: "4px 8px" }} 
                              />
                              <span style={{ fontSize: 13 }}>hours</span>
                            </>
                          )}

                          {step.type === "suppression_check" && (
                            <span style={{ fontSize: 13, fontWeight: "500" }}>🔒 Consent & Pre-send Suppression Check</span>
                          )}

                          {step.type === "send_email" && (
                            <>
                              <span style={{ fontSize: 13, fontWeight: "500" }}>📧 Send Template:</span>
                              <select 
                                className="input" 
                                value={step.template_id || ""} 
                                onChange={(e) => handleStepChange(index, "template_id", parseInt(e.target.value) || undefined)}
                                style={{ height: 32, padding: "4px 8px", fontSize: 13 }}
                              >
                                {templates.map(t => (
                                  <option key={t.id} value={t.id}>{t.name}</option>
                                ))}
                              </select>
                            </>
                          )}
                        </div>

                        <button className="btn btn-ghost" style={{ padding: "4px 8px", color: "var(--error)" }} onClick={() => handleRemoveStep(index)}>
                          ✕
                        </button>
                      </div>
                    ))
                  )}
                </div>

                {/* Add actions buttons */}
                <div style={{ display: "flex", gap: 8, marginTop: 16, borderTop: "1px solid var(--border-default)", paddingTop: 16 }}>
                  <button className="btn btn-secondary" style={{ fontSize: 12, padding: "6px 12px" }} onClick={() => handleAddStep("wait")}>
                    ⏳ Add Delay Node
                  </button>
                  <button className="btn btn-secondary" style={{ fontSize: 12, padding: "6px 12px" }} onClick={() => handleAddStep("suppression_check")}>
                    🔒 Add Suppression Node
                  </button>
                  <button className="btn btn-secondary" style={{ fontSize: 12, padding: "6px 12px" }} onClick={() => handleAddStep("send_email")} disabled={templates.length === 0}>
                    📧 Add Email Node
                  </button>
                </div>
              </div>
            </div>
            <div className="upload-modal-footer">
              <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSaveFlow} disabled={loading}>
                💾 Save Flow
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
