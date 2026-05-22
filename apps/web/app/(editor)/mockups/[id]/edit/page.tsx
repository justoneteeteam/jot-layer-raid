"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import * as fabric from "fabric";
import { Font, Patch, Template, fetchFonts, fetchPatches, fetchTemplate, saveTemplate, uploadBackground } from "../../../../lib/api";

type ActiveTab = "text" | "images" | "patches" | "layers";

export default function EditorPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fcRef = useRef<fabric.Canvas | null>(null);

  const [template, setTemplate] = useState<Template | null>(null);
  const [fonts, setFonts] = useState<Font[]>([]);
  const [patches, setPatches] = useState<Patch[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [activeTab, setActiveTab] = useState<ActiveTab>("text");
  const [selectedObj, setSelectedObj] = useState<fabric.FabricObject | null>(null);
  const [objects, setObjects] = useState<fabric.FabricObject[]>([]);
  const [zoom, setZoom] = useState(0.6);

  /* ── Text property state ── */
  const [textProps, setTextProps] = useState({
    fontFamily: "Anton",
    fontSize: 64,
    fill: "#FFFFFF",
    stroke: "#000000",
    strokeWidth: 3,
    shadowColor: "#CC0000",
    shadowBlur: 5,
    shadowOffsetX: 2,
    shadowOffsetY: 2,
    textAlign: "center" as string,
    charSpacing: 0,
  });

  /* ── Load Data ── */
  useEffect(() => {
    Promise.all([
      fetchTemplate(id),
      fetchPatches().catch(() => []),
    ]).then(([tplData, patchesData]) => {
      setTemplate(tplData);
      setPatches(patchesData);
      
      // Fetch fonts (filter by team if template has one)
      fetchFonts(tplData.team_id).then(fontsData => {
        setFonts(fontsData.length > 0 ? fontsData : []);
      }).catch(() => setFonts([]));
      
      setLoading(false);
    }).catch(err => {
      console.error(err);
      setLoading(false);
    });
  }, [id]);

  /* ── Sync text props when selection changes ── */
  const syncTextProps = useCallback((obj: fabric.FabricObject | null) => {
    if (!obj || !(obj instanceof fabric.Textbox)) return;
    const t = obj as fabric.Textbox;
    const shadow = t.shadow as fabric.Shadow | null;
    setTextProps({
      fontFamily: t.fontFamily || "Anton",
      fontSize: t.fontSize || 64,
      fill: (t.fill as string) || "#FFFFFF",
      stroke: (t.stroke as string) || "#000000",
      strokeWidth: t.strokeWidth || 0,
      shadowColor: shadow?.color || "#CC0000",
      shadowBlur: shadow?.blur || 0,
      shadowOffsetX: shadow?.offsetX || 0,
      shadowOffsetY: shadow?.offsetY || 0,
      textAlign: t.textAlign || "center",
      charSpacing: t.charSpacing || 0,
    });
  }, []);

  /* ── Refresh layers list ── */
  const refreshLayers = useCallback(() => {
    const fc = fcRef.current;
    if (!fc) return;
    const objs = fc.getObjects().filter((o) => o !== fc.backgroundImage);
    setObjects([...objs]);
  }, []);

  /* ── Init canvas ── */
  useEffect(() => {
    if (!canvasRef.current || !template) return;
    
    // Only initialize once
    if (fcRef.current) return;

    const fc = new fabric.Canvas(canvasRef.current, {
      width: 800,
      height: 1000,
      backgroundColor: template.background_color || "#e5e7eb",
      selection: true,
    });
    fcRef.current = fc;

    // Load saved state or default background
    const initCanvas = async () => {
      if (template.canvas_json) {
        await fc.loadFromJSON(template.canvas_json);
        fc.renderAll();
        refreshLayers();
      } else if (template.original_image_url) {
        // Fetch presigned URL via layers endpoint
        const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
        try {
          const res = await fetch(`${API_BASE}/api/mockups/templates/${template.id}/layers`);
          const data = await res.json();
          if (data.layers?.original) {
            const img = await fabric.FabricImage.fromURL(data.layers.original, { crossOrigin: "anonymous" });
            const scale = Math.min(800 / (img.width || 800), 1000 / (img.height || 1000));
            img.scaleX = scale;
            img.scaleY = scale;
            img.set({ originX: "center", originY: "center", left: 400, top: 500 });
            fc.backgroundImage = img;
            fc.renderAll();
          }
        } catch (e) { console.error("Error loading background", e); }
      }
    };
    
    initCanvas();

    fc.on("selection:created", (e) => {
      const obj = e.selected?.[0] || null;
      setSelectedObj(obj);
      syncTextProps(obj);
    });
    fc.on("selection:updated", (e) => {
      const obj = e.selected?.[0] || null;
      setSelectedObj(obj);
      syncTextProps(obj);
    });
    fc.on("selection:cleared", () => {
      setSelectedObj(null);
    });
    fc.on("object:added", () => refreshLayers());
    fc.on("object:removed", () => refreshLayers());
    fc.on("object:modified", () => refreshLayers());

    return () => { 
      fc.dispose(); 
      fcRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template]); // Load canvas once template is fetched

  /* ── Apply zoom ── */
  useEffect(() => {
    const fc = fcRef.current;
    if (!fc) return;
    fc.setZoom(zoom);
    fc.setDimensions({ width: 800 * zoom, height: 1000 * zoom });
    fc.renderAll();
  }, [zoom]);

  /* ── Load dynamic fonts into document ── */
  useEffect(() => {
    fonts.forEach(f => {
      if (f.file_url && f.name) {
        const fontFace = new FontFace(f.name, `url('${f.file_url}')`, { display: 'swap' });
        fontFace.load().then(loaded => document.fonts.add(loaded)).catch(e => console.error(e));
      }
    });
  }, [fonts]);

  /* ── Helpers ── */
  const addText = (preset: "name" | "number") => {
    const fc = fcRef.current;
    if (!fc) return;
    
    const defaultFont = fonts.length > 0 ? fonts[0]!.name : textProps.fontFamily;
    
    const t = new fabric.Textbox(preset === "name" ? "PLAYER NAME" : "00", {
      left: 400, top: preset === "name" ? 300 : 500, originX: "center", originY: "center",
      fontFamily: defaultFont, fontSize: preset === "name" ? 64 : 120,
      fill: textProps.fill, stroke: textProps.stroke, strokeWidth: textProps.strokeWidth,
      textAlign: "center", width: 500,
      shadow: new fabric.Shadow({ color: textProps.shadowColor, blur: textProps.shadowBlur, offsetX: textProps.shadowOffsetX, offsetY: textProps.shadowOffsetY }),
      paintFirst: "stroke",
    });
    (t as any)._layerLabel = preset === "name" ? "Player Name" : "Player Number";
    fc.add(t);
    fc.setActiveObject(t);
    fc.renderAll();
    setSelectedObj(t);
    syncTextProps(t);
    
    if (fonts.length > 0) applyTextProp("fontFamily", defaultFont);
  };

  const addPatchImage = (url: string, label: string) => {
    const fc = fcRef.current;
    if (!fc) return;
    fabric.FabricImage.fromURL(url, { crossOrigin: "anonymous" }).then((img) => {
      img.scaleToWidth(100);
      img.set({ left: 100, top: 100 });
      (img as any)._layerLabel = label;
      fc.add(img);
      fc.setActiveObject(img);
      fc.renderAll();
      setSelectedObj(img);
    });
  };

  const handleUploadBackground = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !template) return;
    const fc = fcRef.current;
    if (!fc) return;
    
    try {
      setSaving(true);
      await uploadBackground(template.id, file);
      
      // Refetch layers to get new presigned URL
      const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const res = await fetch(`${API_BASE}/api/mockups/templates/${template.id}/layers`);
      const data = await res.json();
      
      if (data.layers?.original) {
        const img = await fabric.FabricImage.fromURL(data.layers.original, { crossOrigin: "anonymous" });
        const scale = Math.min(800 / (img.width || 800), 1000 / (img.height || 1000));
        img.scaleX = scale;
        img.scaleY = scale;
        img.set({ originX: "center", originY: "center", left: 400, top: 500 });
        fc.backgroundImage = img;
        fc.renderAll();
      }
      
      // Auto-save the new canvas JSON
      await saveToDB();
    } catch (err) {
      console.error(err);
      alert("Error uploading background");
    } finally {
      setSaving(false);
      e.target.value = "";
    }
  };

  const applyTextProp = (key: string, value: any) => {
    const fc = fcRef.current;
    if (!fc || !selectedObj || !(selectedObj instanceof fabric.Textbox)) return;
    const t = selectedObj as fabric.Textbox;
    if (key.startsWith("shadow")) {
      const current = (t.shadow as fabric.Shadow) || new fabric.Shadow({});
      if (key === "shadowColor") current.color = value;
      if (key === "shadowBlur") current.blur = value;
      if (key === "shadowOffsetX") current.offsetX = value;
      if (key === "shadowOffsetY") current.offsetY = value;
      t.shadow = current;
    } else {
      t.set(key as any, value);
    }
    setTextProps((p) => ({ ...p, [key]: value }));
    fc.renderAll();
  };
  
  const updateBackgroundColor = (color: string) => {
    const fc = fcRef.current;
    if (!fc) return;
    fc.backgroundColor = color;
    fc.renderAll();
    setTemplate(prev => prev ? { ...prev, background_color: color } : null);
  };

  const deleteSelected = () => {
    const fc = fcRef.current;
    if (!fc || !selectedObj) return;
    fc.remove(selectedObj);
    setSelectedObj(null);
    fc.renderAll();
  };

  const exportPNG = () => {
    const fc = fcRef.current;
    if (!fc) return;
    const currentZoom = fc.getZoom();
    fc.setZoom(1);
    fc.setDimensions({ width: 800, height: 1000 });
    const dataURL = fc.toDataURL({ format: "png", multiplier: 2 });
    fc.setZoom(currentZoom);
    fc.setDimensions({ width: 800 * currentZoom, height: 1000 * currentZoom });
    const link = document.createElement("a");
    link.download = `${template?.name || "jersey"}.png`;
    link.href = dataURL;
    link.click();
  };

  const saveToDB = async () => {
    const fc = fcRef.current;
    if (!fc || !template) return;
    
    setSaving(true);
    try {
      const json = fc.toJSON(["_layerLabel"]);
      await saveTemplate(template.id, {
        canvas_json: json,
        font_config: {
          font_id: fonts.find(f => f.name === textProps.fontFamily)?.id || null,
          size: textProps.fontSize,
          color: textProps.fill,
          outline_color: textProps.stroke,
          outline_width: textProps.strokeWidth
        },
        background_color: fc.backgroundColor as string,
      });
      alert("✅ Saved successfully!");
    } catch (err) {
      console.error(err);
      alert("❌ Failed to save template");
    } finally {
      setSaving(false);
    }
  };

  const moveLayer = (obj: fabric.FabricObject, dir: "up" | "down") => {
    const fc = fcRef.current;
    if (!fc) return;
    if (dir === "up") fc.bringObjectForward(obj);
    else fc.sendObjectBackwards(obj);
    fc.renderAll();
    refreshLayers();
  };

  if (loading) {
    return <div className="editor-layout"><div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh" }}>Loading Editor...</div></div>;
  }

  if (!template) {
    return (
      <div className="editor-layout">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", color: "var(--text-secondary)" }}>
          Template not found. <button className="btn btn-primary" style={{ marginLeft: 12 }} onClick={() => router.push("/mockups")}>← Back</button>
        </div>
      </div>
    );
  }

  return (
    <div className="editor-layout">
      {/* ── Top Toolbar ── */}
      <div className="editor-toolbar">
        <div className="editor-toolbar-left">
          <button className="btn btn-ghost" onClick={() => router.push("/mockups")} title="Back to Templates">← Back</button>
          <div className="editor-toolbar-divider" />
          <span className="editor-toolbar-title">🎽 {template.name}</span>
          <span className="editor-toolbar-subtitle">{template.color_variant || "Standard"}</span>
        </div>
        <div className="editor-toolbar-center">
          <button className="btn btn-ghost" onClick={() => setZoom((z) => Math.max(0.3, z - 0.1))} title="Zoom Out">−</button>
          <span className="editor-zoom-label">{Math.round(zoom * 100)}%</span>
          <button className="btn btn-ghost" onClick={() => setZoom((z) => Math.min(1.5, z + 0.1))} title="Zoom In">+</button>
          <button className="btn btn-ghost" onClick={() => setZoom(0.6)} title="Fit">Fit</button>
        </div>
        <div className="editor-toolbar-right">
          <button className="btn btn-ghost" onClick={deleteSelected} disabled={!selectedObj} title="Delete Selected">🗑️</button>
          <div className="editor-toolbar-divider" />
          <button className="btn btn-secondary" onClick={saveToDB} disabled={saving}>{saving ? "⏳ Saving..." : "💾 Save to DB"}</button>
          <button className="btn btn-primary" onClick={exportPNG}>📥 Export PNG</button>
        </div>
      </div>

      {/* ── Main Body ── */}
      <div className="editor-body">
        {/* ── Left Panel ── */}
        <div className="editor-left-panel">
          <div className="editor-tab-bar">
            {(["text", "images", "patches", "layers"] as ActiveTab[]).map((tab) => {
              const icons = { text: "📝", images: "🖼️", patches: "🏷️", layers: "📑" };
              return (
                <button key={tab} className={`editor-tab ${activeTab === tab ? "active" : ""}`} onClick={() => setActiveTab(tab)}>
                  {icons[tab]}<span>{tab.charAt(0).toUpperCase() + tab.slice(1)}</span>
                </button>
              );
            })}
          </div>

          <div className="editor-panel-content">
            {activeTab === "text" && (
              <div className="editor-section">
                <div className="editor-section-title">Add Text</div>
                <button className="btn btn-primary" style={{ width: "100%", marginBottom: 8 }} onClick={() => addText("name")}>
                  + Player Name
                </button>
                <button className="btn btn-secondary" style={{ width: "100%" }} onClick={() => addText("number")}>
                  + Player Number
                </button>
                <div className="editor-section-title" style={{ marginTop: 20 }}>Available Fonts</div>
                {fonts.length === 0 ? (
                  <div className="editor-empty" style={{ padding: 12 }}>No team fonts found. Using default.</div>
                ) : (
                  <select className="input" value={textProps.fontFamily} onChange={(e) => { setTextProps((p) => ({ ...p, fontFamily: e.target.value })); if(selectedObj) applyTextProp("fontFamily", e.target.value); }}>
                    {fonts.map((f) => (<option key={f.id} value={f.name} style={{ fontFamily: `"${f.name}", monospace` }}>{f.name}</option>))}
                  </select>
                )}
              </div>
            )}

            {activeTab === "images" && (
              <div className="editor-section">
                <div className="editor-section-title">Change Background</div>
                <label className="editor-upload-area">
                  <input type="file" accept="image/*" onChange={handleUploadBackground} style={{ display: "none" }} disabled={saving} />
                  <div className="editor-upload-icon">🎽</div>
                  <div>{saving ? "Uploading..." : "Upload Jersey Background"}</div>
                  <div className="editor-upload-hint">Replaces current background</div>
                </label>
                
                <div className="editor-section-title" style={{ marginTop: 24 }}>Canvas Color</div>
                <div className="editor-color-row">
                  <input type="color" value={template.background_color || "#e5e7eb"} onChange={(e) => updateBackgroundColor(e.target.value)} className="editor-color-input" />
                  <span className="editor-prop-value">{template.background_color || "#e5e7eb"}</span>
                </div>
              </div>
            )}

            {activeTab === "patches" && (
              <div className="editor-section">
                <div className="editor-section-title">Patch Library</div>
                {patches.length === 0 ? (
                  <div className="editor-empty">No patches uploaded.</div>
                ) : (
                  <div className="editor-patch-grid">
                    {patches.map((p) => (
                      <button key={p.id} className="editor-patch-item" onClick={() => addPatchImage(p.image_url, p.name)}>
                        <img src={p.image_url} alt={p.name} onError={(e) => { e.currentTarget.src = "https://placehold.co/100x100?text=Error" }} />
                        <span>{p.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === "layers" && (
              <div className="editor-section">
                <div className="editor-section-title">Layers ({objects.length})</div>
                {objects.length === 0 && <div className="editor-empty">No objects yet. Add text or patches.</div>}
                {[...objects].reverse().map((obj, i) => (
                  <div key={i} className={`editor-layer-item ${selectedObj === obj ? "active" : ""}`} onClick={() => { fcRef.current?.setActiveObject(obj); fcRef.current?.renderAll(); setSelectedObj(obj); syncTextProps(obj); }}>
                    <span className="editor-layer-icon">{obj instanceof fabric.Textbox ? "📝" : "🖼️"}</span>
                    <span className="editor-layer-name">{(obj as any)._layerLabel || (obj instanceof fabric.Textbox ? (obj as fabric.Textbox).text?.substring(0, 20) : "Image")}</span>
                    <div className="editor-layer-actions">
                      <button onClick={(e) => { e.stopPropagation(); moveLayer(obj, "up"); }} title="Move Up">↑</button>
                      <button onClick={(e) => { e.stopPropagation(); moveLayer(obj, "down"); }} title="Move Down">↓</button>
                      <button onClick={(e) => { e.stopPropagation(); fcRef.current?.remove(obj); setSelectedObj(null); fcRef.current?.renderAll(); }} title="Delete">🗑️</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Canvas Area ── */}
        <div className="editor-canvas-area">
          <div className="editor-canvas-wrapper">
            <canvas ref={canvasRef} />
          </div>
        </div>

        {/* ── Right Properties Panel ── */}
        <div className="editor-right-panel">
          {selectedObj && selectedObj instanceof fabric.Textbox ? (
            <>
              <div className="editor-section">
                <div className="editor-section-title">Typography</div>
                <label className="editor-prop-label">Font Family</label>
                <select className="input" value={textProps.fontFamily} onChange={(e) => applyTextProp("fontFamily", e.target.value)}>
                  {fonts.length > 0 
                    ? fonts.map((f) => (<option key={f.id} value={f.name}>{f.name}</option>))
                    : <option value="Anton">Anton (Default)</option>
                  }
                </select>
                <label className="editor-prop-label">Font Size</label>
                <div className="editor-prop-row">
                  <input type="range" min={12} max={200} value={textProps.fontSize} onChange={(e) => applyTextProp("fontSize", Number(e.target.value))} className="editor-slider" />
                  <span className="editor-prop-value">{textProps.fontSize}px</span>
                </div>
                <label className="editor-prop-label">Alignment</label>
                <div className="editor-prop-row">
                  {["left", "center", "right"].map((a) => (
                    <button key={a} className={`editor-align-btn ${textProps.textAlign === a ? "active" : ""}`} onClick={() => applyTextProp("textAlign", a)}>
                      {a === "left" ? "⬅" : a === "center" ? "⬆" : "➡"}
                    </button>
                  ))}
                </div>
                <label className="editor-prop-label">Letter Spacing</label>
                <div className="editor-prop-row">
                  <input type="range" min={-200} max={800} value={textProps.charSpacing} onChange={(e) => applyTextProp("charSpacing", Number(e.target.value))} className="editor-slider" />
                  <span className="editor-prop-value">{textProps.charSpacing}</span>
                </div>
              </div>

              <div className="editor-section">
                <div className="editor-section-title">Colors</div>
                <label className="editor-prop-label">Fill Color</label>
                <div className="editor-color-row">
                  <input type="color" value={textProps.fill} onChange={(e) => applyTextProp("fill", e.target.value)} className="editor-color-input" />
                  <span className="editor-prop-value">{textProps.fill}</span>
                </div>
                <label className="editor-prop-label">Stroke Color</label>
                <div className="editor-color-row">
                  <input type="color" value={textProps.stroke} onChange={(e) => applyTextProp("stroke", e.target.value)} className="editor-color-input" />
                  <span className="editor-prop-value">{textProps.stroke}</span>
                </div>
                <label className="editor-prop-label">Stroke Width</label>
                <div className="editor-prop-row">
                  <input type="range" min={0} max={20} value={textProps.strokeWidth} onChange={(e) => applyTextProp("strokeWidth", Number(e.target.value))} className="editor-slider" />
                  <span className="editor-prop-value">{textProps.strokeWidth}px</span>
                </div>
              </div>

              <div className="editor-section">
                <div className="editor-section-title">Shadow</div>
                <label className="editor-prop-label">Shadow Color</label>
                <div className="editor-color-row">
                  <input type="color" value={textProps.shadowColor} onChange={(e) => applyTextProp("shadowColor", e.target.value)} className="editor-color-input" />
                  <span className="editor-prop-value">{textProps.shadowColor}</span>
                </div>
                <label className="editor-prop-label">Blur</label>
                <div className="editor-prop-row">
                  <input type="range" min={0} max={30} value={textProps.shadowBlur} onChange={(e) => applyTextProp("shadowBlur", Number(e.target.value))} className="editor-slider" />
                  <span className="editor-prop-value">{textProps.shadowBlur}</span>
                </div>
                <label className="editor-prop-label">Offset X / Y</label>
                <div className="editor-prop-row">
                  <input type="number" className="input" style={{ width: 70 }} value={textProps.shadowOffsetX} onChange={(e) => applyTextProp("shadowOffsetX", Number(e.target.value))} />
                  <input type="number" className="input" style={{ width: 70 }} value={textProps.shadowOffsetY} onChange={(e) => applyTextProp("shadowOffsetY", Number(e.target.value))} />
                </div>
              </div>
            </>
          ) : selectedObj ? (
            <div className="editor-section">
              <div className="editor-section-title">Image Properties</div>
              <label className="editor-prop-label">Opacity</label>
              <div className="editor-prop-row">
                <input type="range" min={0} max={100} value={Math.round((selectedObj.opacity ?? 1) * 100)} onChange={(e) => { selectedObj.set("opacity", Number(e.target.value) / 100); fcRef.current?.renderAll(); }} className="editor-slider" />
                <span className="editor-prop-value">{Math.round((selectedObj.opacity ?? 1) * 100)}%</span>
              </div>
              <div className="editor-prop-row" style={{ marginTop: 12 }}>
                <button className="btn btn-secondary" onClick={() => { selectedObj.set("flipX", !selectedObj.flipX); fcRef.current?.renderAll(); }}>↔ Flip H</button>
                <button className="btn btn-secondary" onClick={() => { selectedObj.set("flipY", !selectedObj.flipY); fcRef.current?.renderAll(); }}>↕ Flip V</button>
              </div>
            </div>
          ) : (
            <div className="editor-section">
              <div className="editor-empty" style={{ marginTop: 40 }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>🎯</div>
                <div style={{ fontWeight: 500, marginBottom: 4 }}>Select an Object</div>
                <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Click on text or image on the canvas to edit its properties</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
