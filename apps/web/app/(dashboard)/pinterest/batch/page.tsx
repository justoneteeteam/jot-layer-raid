"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { formatR2ImageUrl } from "../../../lib/api";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://api-worker.justoneteeteam.workers.dev";

interface CombinationItem {
  imageUrl: string;
  keyword: string;
  theme: string;
  style: string;
  product: string;
  contentType?: string;
  recipeName?: string;
  nicheId?: number | null;
}

interface NicheItem {
  id: number;
  name: string;
  targetAudience?: string;
  status: string;
}

interface NicheFullDetail {
  id: number;
  name: string;
  targetAudience?: string;
  contentTypes: Array<{ id: number; name: string }>;
  themes: Array<{ id: number; name: string; compatibleStyleNames?: string[] }>;
  styles: Array<{ id: number; name: string }>;
  recipes: Array<{ id: number; name: string; contentTypeName?: string }>;
}

const DEFAULT_THEMES = ["General", "Summer Refresh", "Cozy Fall", "Modern Living", "Japandi"];
const DEFAULT_STYLES = ["Modern Scandinavian", "Luxury Interior", "Boho Chic", "Minimalist", "Dark AI", "Clean SaaS"];
const DEFAULT_CONTENT_TYPES = ["Prompt Card", "Infographic", "Step-by-Step Guide", "Workflow Diagram"];

function PinterestBatchContent() {
  const searchParams = useSearchParams();
  const initialNicheParam = searchParams.get("nicheId");

  const [step, setStep] = useState(1);

  // Mode Selection: "niche" (Recommended) vs "manual" (Advanced)
  const [generationMode, setGenerationMode] = useState<"niche" | "manual">("niche");

  // Niche Data
  const [niches, setNiches] = useState<NicheItem[]>([]);
  const [selectedNicheId, setSelectedNicheId] = useState<number | null>(initialNicheParam ? parseInt(initialNicheParam, 10) : null);
  const [currentNicheDetail, setCurrentNicheDetail] = useState<NicheFullDetail | null>(null);
  const [isLoadingNiche, setIsLoadingNiche] = useState(false);

  // Account & RSS Channels
  const [accountChannels, setAccountChannels] = useState<Array<{ id: string; name: string; domain: string }>>([]);
  const [selectedAccountChannel, setSelectedAccountChannel] = useState<string>("account-main");

  // Flow Step 2: Reference Image URLs & Keywords
  const [imageUrlsText, setImageUrlsText] = useState("");
  const [keywordsText, setKeywordsText] = useState("small apartment decor, cozy aesthetic living room");
  const [productTopic, setProductTopic] = useState("Interior & Decor");

  // Flow Step 3 & 4: Dimensions
  const [availableContentTypes, setAvailableContentTypes] = useState<string[]>(DEFAULT_CONTENT_TYPES);
  const [selectedContentTypes, setSelectedContentTypes] = useState<string[]>(["Prompt Card", "Infographic"]);

  const [availableThemes, setAvailableThemes] = useState<string[]>(DEFAULT_THEMES);
  const [selectedThemes, setSelectedThemes] = useState<string[]>(["General", "Summer Refresh"]);

  const [availableStyles, setAvailableStyles] = useState<string[]>(DEFAULT_STYLES);
  const [selectedStyles, setSelectedStyles] = useState<string[]>(["Modern Scandinavian", "Minimalist"]);

  const [availableRecipes, setAvailableRecipes] = useState<string[]>(["Educational Card"]);
  const [selectedRecipes, setSelectedRecipes] = useState<string[]>(["Educational Card"]);

  // Model & Destination settings
  const [model, setModel] = useState("flux");
  const [destinationLink, setDestinationLink] = useState("");
  const [maxPins, setMaxPins] = useState<number>(10);
  const [publishToRss, setPublishToRss] = useState<boolean>(false);
  const [repeatDaily, setRepeatDaily] = useState<boolean>(false);

  // Combination Matrix
  const [combinations, setCombinations] = useState<CombinationItem[]>([]);

  // Execution & Polling State
  const [jobId, setJobId] = useState("");
  const [progress, setProgress] = useState(0);
  const [completed, setCompleted] = useState(0);
  const [failed, setFailed] = useState(0);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState("");

  // Results & History
  const [generatedResults, setGeneratedResults] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Load Niches and Channels on Mount
  useEffect(() => {
    fetchInitialData();
  }, []);

  // When selected niche changes, load its full library
  useEffect(() => {
    if (selectedNicheId) {
      loadNicheDetail(selectedNicheId);
    }
  }, [selectedNicheId]);

  const fetchInitialData = async () => {
    try {
      const token = localStorage.getItem("token");
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const [nRes, cRes, tRes, sRes] = await Promise.all([
        fetch(`${API_BASE}/api/pinterest/niches?status=approved`, { headers, cache: "no-store" }),
        fetch(`${API_BASE}/api/pinterest/channels`, { headers, cache: "no-store" }),
        fetch(`${API_BASE}/api/pinterest/themes`, { headers, cache: "no-store" }),
        fetch(`${API_BASE}/api/pinterest/prompts`, { headers, cache: "no-store" })
      ]);

      if (nRes.ok) {
        const nData = await nRes.json();
        if (Array.isArray(nData) && nData.length > 0) {
          setNiches(nData);
          if (!selectedNicheId && !initialNicheParam) {
            setSelectedNicheId(nData[0].id);
          }
        }
      }

      if (cRes.ok) {
        const cData = await cRes.json();
        if (Array.isArray(cData) && cData.length > 0) {
          const mapped = cData.map((c: any) => ({
            id: c.id,
            name: c.name || c.id,
            domain: c.claimedDomain || "https://vulius.com"
          }));
          setAccountChannels(mapped);
          setSelectedAccountChannel(mapped[0]!.id);
          setDestinationLink(mapped[0]!.domain);
        }
      }

      if (tRes.ok) {
        const tData = await tRes.json();
        if (Array.isArray(tData) && tData.length > 0) {
          setAvailableThemes(Array.from(new Set([...tData.map((t: any) => t.name), ...DEFAULT_THEMES])));
        }
      }

      if (sRes.ok) {
        const sData = await sRes.json();
        if (Array.isArray(sData) && sData.length > 0) {
          setAvailableStyles(Array.from(new Set([...sData.map((s: any) => s.name), ...DEFAULT_STYLES])));
        }
      }
    } catch (e) {
      console.error("Failed to load initial data:", e);
    }
  };

  const loadNicheDetail = async (id: number) => {
    try {
      setIsLoadingNiche(true);
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/api/pinterest/niches/${id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });

      if (res.ok) {
        const data: NicheFullDetail = await res.json();
        setCurrentNicheDetail(data);

        // Prepopulate dimensions from niche
        if (data.contentTypes && data.contentTypes.length > 0) {
          const ctNames = data.contentTypes.map(c => c.name);
          setAvailableContentTypes(ctNames);
          setSelectedContentTypes(ctNames.slice(0, 3));
        }

        if (data.themes && data.themes.length > 0) {
          const tNames = data.themes.map(t => t.name);
          setAvailableThemes(tNames);
          setSelectedThemes(tNames.slice(0, 3));
        }

        if (data.styles && data.styles.length > 0) {
          const sNames = data.styles.map(s => s.name);
          setAvailableStyles(sNames);
          setSelectedStyles(sNames.slice(0, 4));
        }

        if (data.recipes && data.recipes.length > 0) {
          const rNames = data.recipes.map(r => r.name);
          setAvailableRecipes(rNames);
          setSelectedRecipes(rNames.slice(0, 2));
        }

        if (data.name) {
          setProductTopic(data.name);
        }
      }
    } catch (err) {
      console.error("Error loading niche detail:", err);
    } finally {
      setIsLoadingNiche(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        setImageUrlsText(text);
      };
      reader.readAsText(file);
    }
  };

  const toggleArrayItem = (item: string, list: string[], setter: React.Dispatch<React.SetStateAction<string[]>>) => {
    setter(prev => prev.includes(item) ? prev.filter(x => x !== item) : [...prev, item]);
  };

  // Step 2 -> Step 3: Compute Combinations Matrix
  const buildMatrix = () => {
    const urls = imageUrlsText.split("\n").map(u => u.trim()).filter(u => u.startsWith("http"));
    const keywords = keywordsText.split(",").map(k => k.trim()).filter(Boolean);

    if (urls.length === 0) {
      alert("Please enter at least one valid image reference URL (http:// or https://).");
      return;
    }
    if (keywords.length === 0) {
      alert("Please enter at least one target keyword.");
      return;
    }

    const cTypes = selectedContentTypes.length > 0 ? selectedContentTypes : ["Standard Pin"];
    const themes = selectedThemes.length > 0 ? selectedThemes : ["General"];
    const styles = selectedStyles.length > 0 ? selectedStyles : ["Modern"];
    const recipes = selectedRecipes.length > 0 ? selectedRecipes : ["Standard Recipe"];

    const items: CombinationItem[] = [];

    for (const url of urls) {
      for (const kw of keywords) {
        for (const ct of cTypes) {
          for (const th of themes) {
            for (const st of styles) {
              for (const rc of recipes) {
                items.push({
                  imageUrl: url,
                  keyword: kw,
                  contentType: ct,
                  theme: th,
                  style: st,
                  recipeName: rc,
                  product: productTopic || "Pinterest Creative",
                  nicheId: generationMode === "niche" ? selectedNicheId : null
                });
              }
            }
          }
        }
      }
    }

    const finalItems = maxPins > 0 ? items.slice(0, maxPins) : items;
    setCombinations(finalItems);
    setTotal(finalItems.length);
    setStep(4);
  };

  // Start Batch Generation
  const startBatch = async () => {
    const urls = imageUrlsText.split("\n").map(u => u.trim()).filter(u => u.startsWith("http"));
    const keywords = keywordsText.split(",").map(k => k.trim()).filter(Boolean);

    try {
      const token = localStorage.getItem("token");
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`${API_BASE}/api/pinterest/batch`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          imageUrls: urls,
          keywords,
          themes: selectedThemes,
          styles: selectedStyles,
          product: productTopic,
          combinations,
          maxPins,
          publishToRss,
          accountChannelId: publishToRss ? selectedAccountChannel : null,
          generateImages: true,
          generateSeo: true,
          repeatDaily,
          model
        })
      });

      const data = await res.json();
      if (data.jobId) {
        setJobId(data.jobId);
        setStep(5);
        setStatus("running");
        pollStatus(data.jobId);
      } else {
        alert(data.error || "Failed to initiate batch.");
      }
    } catch (e) {
      console.error("Failed to start batch:", e);
      alert("Error starting batch job.");
    }
  };

  // Polling Status
  const pollStatus = (id: string) => {
    const interval = setInterval(async () => {
      try {
        const token = localStorage.getItem("token");
        const headers: Record<string, string> = {};
        if (token) headers["Authorization"] = `Bearer ${token}`;
        const res = await fetch(`${API_BASE}/api/pinterest/batch/${id}`, { headers });
        const data = await res.json();

        const comp = data.completed || 0;
        const fail = data.failed || 0;
        const tot = data.total || total || 1;

        setCompleted(comp);
        setFailed(fail);
        setProgress(((comp + fail) / tot) * 100);

        if (data.status === "completed" || data.status === "failed") {
          clearInterval(interval);
          setStatus(data.status);
          fetchGeneratedHistory();
          setStep(6);
        }
      } catch (e) {
        console.error("Polling error:", e);
      }
    }, 3000);
  };

  const fetchGeneratedHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/api/pinterest/history?limit=50`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setGeneratedResults(data);
      }
    } catch (e) {
      console.error("Failed to fetch history:", e);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Export handlers
  const exportPinterestTXT = async () => {
    try {
      const token = localStorage.getItem("token");
      const linkParam = destinationLink.trim() ? `?link=${encodeURIComponent(destinationLink.trim())}` : "";
      const res = await fetch(`${API_BASE}/api/pinterest/export/pinterest-txt${linkParam}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to export TXT");
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `pinterest-bulk-upload-${new Date().toISOString().slice(0, 10)}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      alert("Failed to export Pinterest TXT.");
    }
  };

  const exportPinterestCSV = async () => {
    try {
      const token = localStorage.getItem("token");
      const linkParam = destinationLink.trim() ? `?link=${encodeURIComponent(destinationLink.trim())}` : "";
      const res = await fetch(`${API_BASE}/api/pinterest/export/pinterest-csv${linkParam}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to export CSV");
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `pinterest-bulk-upload-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      alert("Failed to export Pinterest CSV.");
    }
  };

  return (
    <div style={{ padding: "2rem", minHeight: "100vh", maxWidth: "1300px", margin: "0 auto" }}>
      {/* Title Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "1.75rem" }}>⚡</span>
            <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "1.875rem", fontWeight: 700, margin: 0 }}>
              Pinterest Batch Generator
            </h1>
          </div>
          <p style={{ color: "var(--text-secondary)", marginTop: "0.25rem", fontSize: "0.95rem" }}>
            Generate high-converting Pinterest pin matrix across Niches, Content Types, Themes, and Styles.
          </p>
        </div>

        {/* Mode Toggle Banner */}
        <div style={{
          display: "flex",
          background: "var(--bg-secondary)",
          border: "1px solid var(--border-default)",
          padding: "4px",
          borderRadius: "10px"
        }}>
          <button
            type="button"
            onClick={() => setGenerationMode("niche")}
            className={`btn btn-sm ${generationMode === "niche" ? "btn-primary" : "btn-ghost"}`}
            style={{ fontWeight: 600 }}
          >
            🟢 AI Niche Mode (Recommended)
          </button>
          <button
            type="button"
            onClick={() => setGenerationMode("manual")}
            className={`btn btn-sm ${generationMode === "manual" ? "btn-primary" : "btn-ghost"}`}
          >
            ⚪ Manual Mode (Advanced)
          </button>
        </div>
      </div>

      {/* Progress Step Indicator */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        background: "var(--bg-secondary)",
        padding: "1rem 2rem",
        borderRadius: "12px",
        border: "1px solid var(--border-default)",
        marginBottom: "2rem",
        position: "relative"
      }}>
        {[
          { num: 1, title: "1. Account & RSS" },
          { num: 2, title: "2. Images & Keywords" },
          { num: 3, title: "3. Niche & Matrix Config" },
          { num: 4, title: "4. Review Matrix" },
          { num: 5, title: "5. Execution" },
          { num: 6, title: "6. Gallery & Export" },
        ].map((s) => (
          <div
            key={s.num}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              color: step === s.num ? "var(--accent)" : step > s.num ? "#10B981" : "var(--text-muted)",
              fontWeight: step === s.num ? 700 : 500,
              fontSize: "0.9rem"
            }}
          >
            <span style={{
              width: "24px",
              height: "24px",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: step === s.num ? "var(--accent)" : step > s.num ? "#10B981" : "var(--bg-tertiary)",
              color: step >= s.num ? "#FFFFFF" : "var(--text-muted)",
              fontSize: "0.8rem",
              fontWeight: 700
            }}>
              {step > s.num ? "✓" : s.num}
            </span>
            <span>{s.title}</span>
          </div>
        ))}
      </div>

      {/* ── STEP 1: ACCOUNT & RSS CONFIG ─────────────────────────────────── */}
      {step === 1 && (
        <div style={{
          background: "var(--bg-secondary)",
          borderRadius: "16px",
          border: "1px solid var(--border-default)",
          padding: "2rem"
        }}>
          <h2 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: "1.25rem" }}>
            Step 1: Select Target Account Channel & RSS Destination
          </h2>

          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.95rem", fontWeight: 600, marginBottom: "0.5rem" }}>
                Target Pinterest Account Channel
              </label>
              <select
                value={selectedAccountChannel}
                onChange={(e) => {
                  setSelectedAccountChannel(e.target.value);
                  const ch = accountChannels.find(c => c.id === e.target.value);
                  if (ch) setDestinationLink(ch.domain);
                }}
                className="input"
                style={{ width: "100%", padding: "0.75rem 1rem" }}
              >
                {accountChannels.map((ch) => (
                  <option key={ch.id} value={ch.id}>
                    {ch.name} ({ch.domain})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.95rem", fontWeight: 600, marginBottom: "0.5rem" }}>
                Claimed Website Destination Link
              </label>
              <input
                type="text"
                className="input"
                value={destinationLink}
                onChange={(e) => setDestinationLink(e.target.value)}
                placeholder="https://vulius.com"
                style={{ width: "100%", padding: "0.75rem 1rem" }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: "1.5rem", borderTop: "1px solid var(--border-subtle)" }}>
              <button onClick={() => setStep(2)} className="btn btn-primary">
                Next: Input Reference Images & Keywords →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── STEP 2: IMAGES & KEYWORDS ────────────────────────────────────── */}
      {step === 2 && (
        <div style={{
          background: "var(--bg-secondary)",
          borderRadius: "16px",
          border: "1px solid var(--border-default)",
          padding: "2rem"
        }}>
          <h2 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: "1.25rem" }}>
            Step 2: Reference Image URLs & Target Keywords
          </h2>

          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                <label style={{ fontSize: "0.95rem", fontWeight: 600 }}>
                  Reference Image URLs (1 URL per line) <span style={{ color: "var(--accent)" }}>*</span>
                </label>
                <label className="btn btn-secondary btn-sm" style={{ cursor: "pointer" }}>
                  📁 Upload .txt / .csv
                  <input type="file" accept=".txt,.csv" onChange={handleFileUpload} style={{ display: "none" }} />
                </label>
              </div>
              <textarea
                className="input"
                rows={4}
                value={imageUrlsText}
                onChange={(e) => setImageUrlsText(e.target.value)}
                placeholder="https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&#10;https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format"
                style={{ width: "100%", fontFamily: "monospace", fontSize: "0.85rem", padding: "0.75rem 1rem" }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.95rem", fontWeight: 600, marginBottom: "0.5rem" }}>
                Pinterest Keywords (Comma separated) <span style={{ color: "var(--accent)" }}>*</span>
              </label>
              <input
                type="text"
                className="input"
                value={keywordsText}
                onChange={(e) => setKeywordsText(e.target.value)}
                placeholder="small apartment decor, cozy aesthetic living room, boho bedroom"
                style={{ width: "100%", padding: "0.75rem 1rem" }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.95rem", fontWeight: 600, marginBottom: "0.5rem" }}>
                Product / Topic Subject (The WHAT)
              </label>
              <input
                type="text"
                className="input"
                value={productTopic}
                onChange={(e) => setProductTopic(e.target.value)}
                placeholder="Interior & Decor"
                style={{ width: "100%", padding: "0.75rem 1rem" }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", paddingTop: "1.5rem", borderTop: "1px solid var(--border-subtle)" }}>
              <button onClick={() => setStep(1)} className="btn btn-secondary">
                ← Back
              </button>
              <button onClick={() => setStep(3)} className="btn btn-primary">
                Next: Select Niche & Matrix Dimensions →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── STEP 3: NICHE & MATRIX DIMENSIONS ────────────────────────────── */}
      {step === 3 && (
        <div style={{
          background: "var(--bg-secondary)",
          borderRadius: "16px",
          border: "1px solid var(--border-default)",
          padding: "2rem"
        }}>
          <h2 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: "1.25rem" }}>
            Step 3: Configure Matrix Dimensions
          </h2>

          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            {/* Niche Selector in Niche Mode */}
            {generationMode === "niche" ? (
              <div style={{
                background: "var(--bg-primary)",
                padding: "1.25rem",
                borderRadius: "12px",
                border: "1px solid var(--border-subtle)"
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                  <label style={{ fontSize: "0.95rem", fontWeight: 700 }}>
                    🎯 Select Target Niche Library
                  </label>
                  <Link href="/pinterest/niches/create" className="btn btn-ghost btn-sm" style={{ color: "var(--accent)" }}>
                    + Create New Niche
                  </Link>
                </div>
                <select
                  value={selectedNicheId || ""}
                  onChange={(e) => setSelectedNicheId(parseInt(e.target.value, 10))}
                  className="input"
                  style={{ width: "100%", padding: "0.75rem 1rem", fontSize: "1rem", fontWeight: 600 }}
                >
                  {niches.map((n) => (
                    <option key={n.id} value={n.id}>
                      📚 {n.name}
                    </option>
                  ))}
                </select>
                {isLoadingNiche && (
                  <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "4px", display: "block" }}>
                    ⏳ Loading niche library dimensions...
                  </span>
                )}
              </div>
            ) : (
              <div style={{
                background: "rgba(234, 179, 8, 0.1)",
                padding: "1rem",
                borderRadius: "8px",
                border: "1px solid rgba(234, 179, 8, 0.3)",
                fontSize: "0.875rem",
                color: "#D97706"
              }}>
                ⚙️ <strong>Manual Mode Active:</strong> All available database themes, styles, and prompt presets are selectable.
              </div>
            )}

            {/* Dimension 1: Content Types */}
            <div>
              <label style={{ display: "block", fontSize: "0.95rem", fontWeight: 600, marginBottom: "0.5rem" }}>
                📂 Content Types (Information Presentation Format)
              </label>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                {availableContentTypes.map((ct) => {
                  const isChecked = selectedContentTypes.includes(ct);
                  return (
                    <button
                      key={ct}
                      type="button"
                      onClick={() => toggleArrayItem(ct, selectedContentTypes, setSelectedContentTypes)}
                      className={`btn btn-sm ${isChecked ? "btn-primary" : "btn-secondary"}`}
                      style={{ borderRadius: "20px" }}
                    >
                      {isChecked ? "✓ " : "+ "} {ct}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Dimension 2: Themes */}
            <div>
              <label style={{ display: "block", fontSize: "0.95rem", fontWeight: 600, marginBottom: "0.5rem" }}>
                🎨 Themes (Subject Angles)
              </label>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                {availableThemes.map((th) => {
                  const isChecked = selectedThemes.includes(th);
                  return (
                    <button
                      key={th}
                      type="button"
                      onClick={() => toggleArrayItem(th, selectedThemes, setSelectedThemes)}
                      className={`btn btn-sm ${isChecked ? "btn-primary" : "btn-secondary"}`}
                      style={{ borderRadius: "20px" }}
                    >
                      {isChecked ? "✓ " : "+ "} {th}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Dimension 3: Aesthetic Styles */}
            <div>
              <label style={{ display: "block", fontSize: "0.95rem", fontWeight: 600, marginBottom: "0.5rem" }}>
                🖌️ Aesthetic Styles (Visual Art Direction)
              </label>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                {availableStyles.map((st) => {
                  const isChecked = selectedStyles.includes(st);
                  return (
                    <button
                      key={st}
                      type="button"
                      onClick={() => toggleArrayItem(st, selectedStyles, setSelectedStyles)}
                      className={`btn btn-sm ${isChecked ? "btn-primary" : "btn-secondary"}`}
                      style={{ borderRadius: "20px" }}
                    >
                      {isChecked ? "✓ " : "+ "} {st}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Dimension 4: Recipes */}
            <div>
              <label style={{ display: "block", fontSize: "0.95rem", fontWeight: 600, marginBottom: "0.5rem" }}>
                📋 Generation Recipes (Construction Instructions)
              </label>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                {availableRecipes.map((rc) => {
                  const isChecked = selectedRecipes.includes(rc);
                  return (
                    <button
                      key={rc}
                      type="button"
                      onClick={() => toggleArrayItem(rc, selectedRecipes, setSelectedRecipes)}
                      className={`btn btn-sm ${isChecked ? "btn-primary" : "btn-secondary"}`}
                      style={{ borderRadius: "20px" }}
                    >
                      {isChecked ? "✓ " : "+ "} {rc}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Settings Row */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 600, marginBottom: "4px" }}>
                  AI Image Engine
                </label>
                <select value={model} onChange={(e) => setModel(e.target.value)} className="input" style={{ width: "100%" }}>
                  <option value="flux">FLUX.1 Schnell (Workers AI)</option>
                  <option value="openai">OpenAI (DALL-E 3 / GPT-Image)</option>
                  <option value="qwen">Qwen Image (Wanx-v1)</option>
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 600, marginBottom: "4px" }}>
                  Batch Pin Limit
                </label>
                <select value={maxPins} onChange={(e) => setMaxPins(parseInt(e.target.value, 10))} className="input" style={{ width: "100%" }}>
                  <option value={5}>5 Pins</option>
                  <option value={10}>10 Pins</option>
                  <option value={20}>20 Pins</option>
                  <option value={50}>50 Pins</option>
                  <option value={100}>100 Pins</option>
                  <option value={0}>All Combinations (No Limit)</option>
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 600, marginBottom: "4px" }}>
                  Publishing Destination
                </label>
                <select
                  value={publishToRss ? "rss" : "export"}
                  onChange={(e) => setPublishToRss(e.target.value === "rss")}
                  className="input"
                  style={{ width: "100%" }}
                >
                  <option value="export">💾 Manual Export Only</option>
                  <option value="rss">📡 Add to Autopilot RSS Feed</option>
                </select>
              </div>
            </div>

            {/* ── EXECUTION SCHEDULE OPTION CARD ──────────────────────────── */}
            <div style={{
              background: "var(--bg-primary)",
              padding: "1.25rem",
              borderRadius: "12px",
              border: repeatDaily ? "2px solid #E60023" : "1px solid var(--border-subtle)",
              transition: "all 0.2s ease"
            }}>
              <label style={{ display: "block", fontSize: "0.95rem", fontWeight: 700, marginBottom: "0.75rem" }}>
                📅 Execution Schedule
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1rem" }}>
                <div
                  onClick={() => setRepeatDaily(false)}
                  style={{
                    padding: "1rem",
                    borderRadius: "10px",
                    border: !repeatDaily ? "2px solid #E60023" : "1px solid var(--border-default)",
                    backgroundColor: !repeatDaily ? "rgba(230, 0, 35, 0.04)" : "var(--bg-secondary)",
                    cursor: "pointer",
                    transition: "all 0.2s ease"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                    <input
                      type="radio"
                      name="batchSchedule"
                      checked={!repeatDaily}
                      onChange={() => setRepeatDaily(false)}
                      style={{ accentColor: "#E60023" }}
                    />
                    <span style={{ fontWeight: 700, fontSize: "0.95rem" }}>⚡ Run Once (Default)</span>
                  </div>
                  <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", margin: 0, paddingLeft: "24px" }}>
                    One-time batch right now. Generates {maxPins > 0 ? maxPins : "all"} pins and stops.
                  </p>
                </div>

                <div
                  onClick={() => setRepeatDaily(true)}
                  style={{
                    padding: "1rem",
                    borderRadius: "10px",
                    border: repeatDaily ? "2px solid #E60023" : "1px solid var(--border-default)",
                    backgroundColor: repeatDaily ? "rgba(230, 0, 35, 0.06)" : "var(--bg-secondary)",
                    cursor: "pointer",
                    transition: "all 0.2s ease"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                    <input
                      type="radio"
                      name="batchSchedule"
                      checked={repeatDaily}
                      onChange={() => setRepeatDaily(true)}
                      style={{ accentColor: "#E60023" }}
                    />
                    <span style={{ fontWeight: 700, fontSize: "0.95rem", color: "#E60023" }}>🔁 Repeat Daily</span>
                  </div>
                  <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", margin: 0, paddingLeft: "24px" }}>
                    Runs now + auto-generates {maxPins > 0 ? maxPins : 5} pins every day at 00:00 UTC automatically.
                  </p>
                </div>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", paddingTop: "1.5rem", borderTop: "1px solid var(--border-subtle)" }}>
              <button onClick={() => setStep(2)} className="btn btn-secondary">
                ← Back
              </button>
              <button onClick={buildMatrix} className="btn btn-primary">
                Generate Permutation Matrix →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── STEP 4: COMBINATION MATRIX REVIEW ────────────────────────────── */}
      {step === 4 && (
        <div style={{
          background: "var(--bg-secondary)",
          borderRadius: "16px",
          border: "1px solid var(--border-default)",
          padding: "2rem"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0 }}>
              Step 4: Review Permutation Matrix ({combinations.length} Pins)
            </h2>
            <span style={{ fontSize: "0.85rem", background: "var(--bg-tertiary)", padding: "4px 10px", borderRadius: "12px", color: "var(--accent)", fontWeight: 600 }}>
              Model: {model.toUpperCase()}
            </span>
          </div>

          <div style={{ maxHeight: "350px", overflowY: "auto", border: "1px solid var(--border-default)", borderRadius: "8px", marginBottom: "1.5rem" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
              <thead>
                <tr style={{ background: "var(--bg-tertiary)", textAlign: "left" }}>
                  <th style={{ padding: "8px 12px" }}>#</th>
                  <th style={{ padding: "8px 12px" }}>Keyword</th>
                  <th style={{ padding: "8px 12px" }}>Content Type</th>
                  <th style={{ padding: "8px 12px" }}>Theme</th>
                  <th style={{ padding: "8px 12px" }}>Style</th>
                  <th style={{ padding: "8px 12px" }}>Recipe</th>
                </tr>
              </thead>
              <tbody>
                {combinations.map((c, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                    <td style={{ padding: "8px 12px", color: "var(--text-muted)" }}>{i + 1}</td>
                    <td style={{ padding: "8px 12px", fontWeight: 600 }}>{c.keyword}</td>
                    <td style={{ padding: "8px 12px" }}>{c.contentType || "-"}</td>
                    <td style={{ padding: "8px 12px" }}>{c.theme}</td>
                    <td style={{ padding: "8px 12px" }}>{c.style}</td>
                    <td style={{ padding: "8px 12px" }}>{c.recipeName || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <button onClick={() => setStep(3)} className="btn btn-secondary">
              ← Back to Config
            </button>
            <button onClick={startBatch} className="btn btn-primary" style={{ fontWeight: 600, padding: "0.75rem 2rem" }}>
              🚀 Start Batch Generation ({combinations.length} Pins)
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 5: EXECUTION & PROGRESS ─────────────────────────────────── */}
      {step === 5 && (
        <div style={{
          background: "var(--bg-secondary)",
          borderRadius: "16px",
          border: "1px solid var(--border-default)",
          padding: "4rem 2rem",
          textAlign: "center"
        }}>
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>⚙️</div>
          <h2 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "0.5rem" }}>
            Generating Pinterest Pin Matrix...
          </h2>
          <p style={{ color: "var(--text-secondary)", marginBottom: repeatDaily ? "1rem" : "2rem" }}>
            Processing job ID: <code style={{ color: "var(--accent)" }}>{jobId}</code>
          </p>

          {repeatDaily && (
            <div style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "6px 14px",
              borderRadius: "20px",
              backgroundColor: "rgba(230, 0, 35, 0.1)",
              color: "#E60023",
              fontSize: "0.85rem",
              fontWeight: 700,
              marginBottom: "1.5rem"
            }}>
              🔁 Daily Recurring Schedule Active (Will repeat every day at 00:00 UTC)
            </div>
          )}

          <div style={{ maxWidth: "500px", margin: "0 auto 1.5rem auto" }}>
            <div style={{ height: "10px", background: "var(--bg-tertiary)", borderRadius: "999px", overflow: "hidden", border: "1px solid var(--border-subtle)" }}>
              <div style={{ height: "100%", width: `${progress}%`, background: "var(--accent)", transition: "width 0.5s ease" }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "8px", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
              <span>Completed: {completed} / {total}</span>
              <span>{Math.round(progress)}%</span>
            </div>
          </div>
        </div>
      )}

      {/* ── STEP 6: GALLERY & EXPORT ─────────────────────────────────────── */}
      {step === 6 && (
        <div>
          {/* Action Export Bar */}
          <div style={{
            background: "var(--bg-secondary)",
            borderRadius: "16px",
            border: "1px solid var(--border-default)",
            padding: "1.5rem",
            marginBottom: "2rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "1rem"
          }}>
            <div>
              <h2 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0, color: "#10B981" }}>
                ✓ Batch Generation Completed ({completed} Pins)
              </h2>
              <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", margin: "4px 0 0 0" }}>
                Images hosted on Cloudflare R2 and indexed with SEO metadata.
              </p>
              {repeatDaily && (
                <div style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "4px 12px",
                  borderRadius: "12px",
                  backgroundColor: "rgba(16, 185, 129, 0.1)",
                  color: "#059669",
                  fontSize: "0.8rem",
                  fontWeight: 700,
                  marginTop: "6px"
                }}>
                  🔁 Scheduled to repeat daily (auto-generates {completed || maxPins} pins every day at 00:00 UTC)
                </div>
              )}
            </div>

            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <button onClick={exportPinterestTXT} className="btn btn-primary">
                📌 Export Pinterest Bulk (.txt)
              </button>
              <button onClick={exportPinterestCSV} className="btn btn-secondary">
                📄 Pinterest CSV
              </button>
              <button onClick={() => { setStep(1); setCombinations([]); }} className="btn btn-ghost">
                + New Batch
              </button>
            </div>
          </div>

          {/* Generated Gallery Grid */}
          <h3 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "1rem" }}>
            Generated Gallery Preview
          </h3>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            gap: "1.25rem"
          }}>
            {generatedResults.slice(0, 12).map((item) => (
              <div
                key={item.id}
                style={{
                  background: "var(--bg-secondary)",
                  borderRadius: "12px",
                  border: "1px solid var(--border-default)",
                  overflow: "hidden",
                  boxShadow: "var(--shadow-sm)"
                }}
              >
                {item.generatedImageUrl && (
                  <div style={{ height: "240px", background: "#000", position: "relative" }}>
                    <img
                      src={formatR2ImageUrl(item.generatedImageUrl)}
                      alt={item.seoAltText || item.keyword}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  </div>
                )}
                <div style={{ padding: "1rem" }}>
                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "6px" }}>
                    {item.theme && (
                      <span style={{ fontSize: "0.7rem", background: "var(--bg-tertiary)", padding: "2px 6px", borderRadius: "4px" }}>
                        {item.theme}
                      </span>
                    )}
                    {item.style && (
                      <span style={{ fontSize: "0.7rem", background: "var(--bg-tertiary)", padding: "2px 6px", borderRadius: "4px" }}>
                        {item.style}
                      </span>
                    )}
                  </div>
                  <h4 style={{ fontSize: "0.9rem", fontWeight: 600, margin: "0 0 4px 0", lineHeight: 1.3 }}>
                    {item.seoTitle || item.keyword}
                  </h4>
                  <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                    {item.seoDescription}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function PinterestBatchPage() {
  return (
    <Suspense fallback={<div style={{ padding: "3rem", textAlign: "center" }}>Loading Batch Studio...</div>}>
      <PinterestBatchContent />
    </Suspense>
  );
}
