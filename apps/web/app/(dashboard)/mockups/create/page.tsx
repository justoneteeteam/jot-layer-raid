"use client";

import { useState, useCallback } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// Pipeline step definitions for progress display
const PIPELINE_STEPS = [
  { key: "starting", label: "Initializing", icon: "⏳", pct: 5 },
  { key: "init", label: "Loading image", icon: "📷", pct: 10 },
  { key: "detecting_text", label: "Detecting text regions (Qwen VL)", icon: "🔍", pct: 25 },
  { key: "generating_mask", label: "Generating binary mask", icon: "🎭", pct: 40 },
  { key: "inpainting", label: "Removing text (Qwen Image Edit)", icon: "🧹", pct: 65 },
  { key: "extracting_layers", label: "Extracting text layers", icon: "✂️", pct: 85 },
  { key: "done", label: "Separation complete!", icon: "✅", pct: 100 },
];

interface LayerData {
  blank?: string;
  name?: string;
  number?: string;
}

interface SeparationResult {
  template_id: number;
  text_positions: Record<string, { x: number; y: number; width: number; height: number }>;
  detected_regions: Array<{ label: string; bbox: number[]; text: string }>;
  cost_cents: number;
  layers: LayerData;
}

export default function AICreatorPage() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [currentStep, setCurrentStep] = useState("");
  const [progressPct, setProgressPct] = useState(0);
  const [statusMessage, setStatusMessage] = useState("");
  const [result, setResult] = useState<SeparationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [templateName, setTemplateName] = useState("");
  const [teamId, setTeamId] = useState("");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected && selected.size <= 10 * 1024 * 1024) {
      setFile(selected);
      setPreview(URL.createObjectURL(selected));
      setResult(null);
      setError(null);
    } else {
      alert("File must be PNG/JPEG and under 10 MB");
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      setFile(droppedFile);
      setPreview(URL.createObjectURL(droppedFile));
      setResult(null);
      setError(null);
    }
  }, []);

  const handleSeparate = async () => {
    if (!file) return;
    setProcessing(true);
    setError(null);
    setResult(null);
    setCurrentStep("starting");
    setProgressPct(5);
    setStatusMessage("Uploading image...");

    try {
      // Build form data
      const formData = new FormData();
      formData.append("file", file);
      formData.append("template_name", templateName || file.name.replace(/\.[^.]+$/, ""));
      if (teamId) formData.append("team_id", teamId);

      // Start separation — this call is synchronous and takes ~30-60s
      // We simulate progress steps based on expected timing
      const progressInterval = simulateProgress();

      const response = await fetch(`${API_BASE}/api/mockups/separate`, {
        method: "POST",
        body: formData,
      });

      clearInterval(progressInterval);

      if (!response.ok) {
        const errData = await response.json().catch(() => ({ detail: "Separation failed" }));
        throw new Error(errData.detail || "Separation failed");
      }

      const data = await response.json();

      // Now fetch the actual layer URLs
      setCurrentStep("done");
      setProgressPct(100);
      setStatusMessage("Loading results...");

      const layersResponse = await fetch(`${API_BASE}/api/mockups/job/${data.job_id}/layers`);
      if (!layersResponse.ok) throw new Error("Failed to fetch layer URLs");

      const layersData = await layersResponse.json();
      setResult(layersData);
      setStatusMessage("Separation complete!");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "An unknown error occurred";
      setError(message);
      setCurrentStep("");
      setProgressPct(0);
      setStatusMessage("");
    } finally {
      setProcessing(false);
    }
  };

  /** Simulate progress steps based on expected pipeline timing */
  const simulateProgress = () => {
    const steps = [
      { delay: 2000, key: "init", msg: "Loading image..." },
      { delay: 5000, key: "detecting_text", msg: "Detecting text regions with Qwen VL..." },
      { delay: 12000, key: "generating_mask", msg: "Generating binary mask..." },
      { delay: 15000, key: "inpainting", msg: "Removing text via Qwen Image Edit (~30s)..." },
      { delay: 45000, key: "extracting_layers", msg: "Extracting text layers..." },
    ];

    let elapsed = 0;
    const interval = setInterval(() => {
      elapsed += 1000;
      const active = steps.filter((s) => s.delay <= elapsed).pop();
      if (active) {
        setCurrentStep(active.key);
        setStatusMessage(active.msg);
        const stepDef = PIPELINE_STEPS.find((s) => s.key === active.key);
        if (stepDef) setProgressPct(stepDef.pct);
      }
    }, 1000);

    return interval;
  };

  const getStepInfo = (stepKey: string) => {
    return PIPELINE_STEPS.find((s) => s.key === stepKey) || PIPELINE_STEPS[0];
  };

  return (
    <div>
      {/* Upload Card */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <h2 className="card-title">🤖 AI Mockup Creator</h2>
          <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
            ~$0.033/jersey • Qwen Hybrid Pipeline
          </span>
        </div>
        <p style={{ color: "var(--text-secondary)", fontSize: 14, marginBottom: 24 }}>
          Upload a raw jersey image and let Qwen AI separate it into editable layers (blank jersey, name, number).
        </p>

        {/* Upload Area */}
        <div
          style={{
            border: "2px dashed var(--border-default)",
            borderRadius: 12,
            padding: 40,
            textAlign: "center",
            marginBottom: 24,
            background: "var(--bg-secondary)",
            cursor: "pointer",
            transition: "border-color 150ms ease",
          }}
          onClick={() => document.getElementById("file-input")?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
        >
          <input
            id="file-input"
            type="file"
            accept="image/png,image/jpeg"
            onChange={handleFileChange}
            style={{ display: "none" }}
          />
          {preview ? (
            <img
              src={preview}
              alt="Preview"
              style={{ maxWidth: 300, maxHeight: 300, borderRadius: 8, objectFit: "contain" }}
            />
          ) : (
            <>
              <div style={{ fontSize: 48, marginBottom: 12 }}>📸</div>
              <div style={{ fontWeight: 500, marginBottom: 4 }}>
                Drag & drop a jersey image here
              </div>
              <div style={{ color: "var(--text-muted)", fontSize: 13 }}>
                PNG or JPEG, max 10 MB
              </div>
            </>
          )}
        </div>

        {/* Controls */}
        <div style={{ display: "flex", gap: 12, alignItems: "flex-end", marginBottom: 24, flexWrap: "wrap" }}>
          <div className="form-group" style={{ flex: 1, minWidth: 180, marginBottom: 0 }}>
            <label className="form-label">Template Name</label>
            <input
              className="input"
              type="text"
              placeholder="e.g. Eagles Home Green"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
            />
          </div>
          <div className="form-group" style={{ flex: 1, minWidth: 180, marginBottom: 0 }}>
            <label className="form-label">Team</label>
            <select className="input" value={teamId} onChange={(e) => setTeamId(e.target.value)}>
              <option value="">Select team (optional)...</option>
              <option value="1">Philadelphia Eagles</option>
              <option value="2">Dallas Cowboys</option>
              <option value="3">Seattle Seahawks</option>
              <option value="4">New York Jets</option>
            </select>
          </div>
          <button
            className="btn btn-primary"
            onClick={handleSeparate}
            disabled={!file || processing}
            style={{ height: 40, minWidth: 180 }}
          >
            {processing ? "⏳ Processing..." : "🔬 Separate Layers"}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div
            style={{
              padding: "12px 16px",
              background: "rgba(239, 68, 68, 0.1)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              borderRadius: 8,
              color: "#ef4444",
              fontSize: 14,
            }}
          >
            ❌ {error}
          </div>
        )}
      </div>

      {/* Progress Card */}
      {processing && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-header">
            <h2 className="card-title">⚡ Processing Pipeline</h2>
          </div>

          {/* Progress bar */}
          <div style={{ marginBottom: 20 }}>
            <div
              style={{
                width: "100%",
                height: 8,
                background: "var(--bg-secondary)",
                borderRadius: 4,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${progressPct}%`,
                  height: "100%",
                  background: "linear-gradient(90deg, #3b82f6, #8b5cf6)",
                  borderRadius: 4,
                  transition: "width 0.5s ease",
                }}
              />
            </div>
            <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 6 }}>
              {progressPct}% complete
            </div>
          </div>

          {/* Step indicators */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {PIPELINE_STEPS.map((step) => {
              const isActive = step.key === currentStep;
              const isDone = step.pct < progressPct || (step.key === currentStep && step.key === "done");
              const isPending = step.pct > progressPct;

              return (
                <div
                  key={step.key}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "6px 12px",
                    borderRadius: 6,
                    background: isActive
                      ? "rgba(59, 130, 246, 0.1)"
                      : "transparent",
                    opacity: isPending ? 0.4 : 1,
                    fontWeight: isActive ? 600 : 400,
                    fontSize: 14,
                    transition: "all 0.3s ease",
                  }}
                >
                  <span style={{ fontSize: 16 }}>
                    {isDone ? "✅" : isActive ? "⏳" : step.icon}
                  </span>
                  <span>{step.label}</span>
                  {isActive && (
                    <span
                      style={{
                        marginLeft: "auto",
                        fontSize: 12,
                        color: "var(--text-secondary)",
                        animation: "pulse 1.5s infinite",
                      }}
                    >
                      {statusMessage}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Results Card */}
      {result && (
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">✅ Separated Layers</h2>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {result.cost_cents > 0 && (
                <span
                  style={{
                    fontSize: 12,
                    padding: "4px 8px",
                    background: "rgba(34, 197, 94, 0.1)",
                    border: "1px solid rgba(34, 197, 94, 0.3)",
                    borderRadius: 6,
                    color: "#22c55e",
                  }}
                >
                  💰 ${(result.cost_cents / 100).toFixed(3)}
                </span>
              )}
            </div>
          </div>

          {/* Detected text info */}
          {result.detected_regions && result.detected_regions.length > 0 && (
            <div style={{ marginBottom: 16, fontSize: 13, color: "var(--text-secondary)" }}>
              Detected:{" "}
              {result.detected_regions.map((r, i) => (
                <span key={i} style={{ marginRight: 12 }}>
                  <strong>{r.label}</strong>
                  {r.text ? ` "${r.text}"` : ""} [{r.bbox.join(", ")}]
                </span>
              ))}
            </div>
          )}

          {/* Layer Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
            {[
              { label: "🧹 Blank Jersey", key: "blank" as const, desc: "Text removed, fabric reconstructed" },
              { label: "📝 Name Layer", key: "name" as const, desc: "Isolated name text (RGBA)" },
              { label: "🔢 Number Layer", key: "number" as const, desc: "Isolated number text (RGBA)" },
            ].map((layer) => {
              const url = result.layers?.[layer.key];
              return (
                <div
                  key={layer.key}
                  style={{
                    border: "1px solid var(--border-default)",
                    borderRadius: 8,
                    padding: 16,
                    textAlign: "center",
                    background: "var(--bg-secondary)",
                  }}
                >
                  <div style={{ fontWeight: 500, marginBottom: 4, fontSize: 14 }}>
                    {layer.label}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 12 }}>
                    {layer.desc}
                  </div>
                  <div
                    style={{
                      background:
                        "repeating-conic-gradient(#ccc 0% 25%, transparent 0% 50%) 50% / 16px 16px",
                      borderRadius: 8,
                      height: 220,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      marginBottom: 12,
                      overflow: "hidden",
                    }}
                  >
                    {url ? (
                      <img
                        src={url}
                        alt={layer.label}
                        style={{
                          maxWidth: "100%",
                          maxHeight: "100%",
                          objectFit: "contain",
                        }}
                      />
                    ) : (
                      <span style={{ fontSize: 48, opacity: 0.3 }}>
                        {layer.key === "blank" ? "🧹" : layer.key === "name" ? "📝" : "🔢"}
                      </span>
                    )}
                  </div>
                  {url && (
                    <a
                      href={url}
                      download={`${layer.key}_layer.png`}
                      className="btn btn-secondary"
                      style={{ width: "100%", textDecoration: "none", display: "block", textAlign: "center" }}
                    >
                      ⬇️ Download PNG
                    </a>
                  )}
                </div>
              );
            })}
          </div>

          {/* Text Position Data */}
          {result.text_positions && Object.keys(result.text_positions).length > 0 && (
            <div
              style={{
                marginTop: 16,
                padding: "12px 16px",
                background: "var(--bg-primary)",
                borderRadius: 8,
                border: "1px solid var(--border-default)",
                fontSize: 13,
              }}
            >
              <div style={{ fontWeight: 500, marginBottom: 6 }}>📐 Detected Text Positions</div>
              <code style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                {JSON.stringify(result.text_positions, null, 2)}
              </code>
            </div>
          )}

          <div style={{ marginTop: 20, display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button
              className="btn btn-secondary"
              onClick={() => {
                setResult(null);
                setFile(null);
                setPreview(null);
              }}
            >
              🔄 New Separation
            </button>
            <button className="btn btn-primary">💾 Save as Template</button>
          </div>
        </div>
      )}
    </div>
  );
}
