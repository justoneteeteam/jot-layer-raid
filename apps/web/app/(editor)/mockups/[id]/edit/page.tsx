"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import * as fabric from "fabric";

/* ── Mock data ── */
const TEMPLATES: Record<string, { name: string; team: string; image: string }> = {
  "1": { name: "Eagles Home Green", team: "Philadelphia Eagles", image: "/jerseys/eagles_home_green.png" },
  "2": { name: "Cowboys Away White", team: "Dallas Cowboys", image: "/jerseys/cowboys_away_white.png" },
  "3": { name: "Ravens Alternate Black", team: "Baltimore Ravens", image: "/jerseys/ravens_alternate_black.png" },
};

const FONTS = [
  "Anton", "Bebas Neue", "Oswald", "Roboto Condensed", "Black Ops One",
  "Russo One", "Teko", "Bungee", "Righteous", "Passion One",
];

const PATCHES = [
  { id: 1, name: "Super Bowl LVII", url: "https://placehold.co/100x100/eeeeee/000000?text=SBLVII" },
  { id: 2, name: "Captain (C)", url: "https://placehold.co/100x100/eeeeee/000000?text=C" },
  { id: 3, name: "Memorial Ribbon", url: "https://placehold.co/100x100/eeeeee/000000?text=Ribbon" },
];

type ActiveTab = "text" | "images" | "patches" | "layers";

export default function EditorPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const tpl = TEMPLATES[id];

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fcRef = useRef<fabric.Canvas | null>(null);

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
    if (!canvasRef.current || !tpl) return;
    const fc = new fabric.Canvas(canvasRef.current, {
      width: 800,
      height: 1000,
      backgroundColor: "#e5e7eb",
      selection: true,
    });
    fcRef.current = fc;

    // Load background jersey image
    fabric.FabricImage.fromURL(tpl.image, { crossOrigin: "anonymous" }).then((img) => {
      const scale = Math.min(800 / (img.width || 800), 1000 / (img.height || 1000));
      img.scaleX = scale;
      img.scaleY = scale;
      img.set({ originX: "center", originY: "center", left: 400, top: 500 });
      fc.backgroundImage = img;
      fc.renderAll();
    });

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

    return () => { fc.dispose(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tpl]);

  /* ── Apply zoom ── */
  useEffect(() => {
    const fc = fcRef.current;
    if (!fc) return;
    fc.setZoom(zoom);
    fc.setDimensions({ width: 800 * zoom, height: 1000 * zoom });
    fc.renderAll();
  }, [zoom]);

  /* ── Helpers ── */
  const addText = (preset: "name" | "number") => {
    const fc = fcRef.current;
    if (!fc) return;
    const t = new fabric.Textbox(preset === "name" ? "PLAYER NAME" : "00", {
      left: 400, top: preset === "name" ? 300 : 500, originX: "center", originY: "center",
      fontFamily: textProps.fontFamily, fontSize: preset === "name" ? 64 : 120,
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

  const handleUploadImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fc = fcRef.current;
    if (!fc) return;
    const reader = new FileReader();
    reader.onload = () => {
      fabric.FabricImage.fromURL(reader.result as string).then((img) => {
        img.scaleToWidth(200);
        img.set({ left: 200, top: 200 });
        (img as any)._layerLabel = file.name;
        fc.add(img);
        fc.setActiveObject(img);
        fc.renderAll();
        setSelectedObj(img);
      });
    };
    reader.readAsDataURL(file);
    e.target.value = "";
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
    link.download = `${tpl?.name || "jersey"}.png`;
    link.href = dataURL;
    link.click();
  };

  const saveJSON = () => {
    const fc = fcRef.current;
    if (!fc) return;
    const json = fc.toJSON();
    const blob = new Blob([JSON.stringify(json, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.download = `${tpl?.name || "template"}.json`;
    link.href = URL.createObjectURL(blob);
    link.click();
  };

  const moveLayer = (obj: fabric.FabricObject, dir: "up" | "down") => {
    const fc = fcRef.current;
    if (!fc) return;
    if (dir === "up") fc.bringObjectForward(obj);
    else fc.sendObjectBackwards(obj);
    fc.renderAll();
    refreshLayers();
  };

  if (!tpl) {
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
          <span className="editor-toolbar-title">🎽 {tpl.name}</span>
          <span className="editor-toolbar-subtitle">{tpl.team}</span>
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
          <button className="btn btn-secondary" onClick={saveJSON}>💾 Save JSON</button>
          <button className="btn btn-primary" onClick={exportPNG}>📥 Export PNG</button>
        </div>
      </div>

      {/* ── Main Body ── */}
      <div className="editor-body">
        {/* ── Left Panel ── */}
        <div className="editor-left-panel">
          <div className="editor-tab-bar">
            {([["text", "📝"], ["images", "🖼️"], ["patches", "🏷️"], ["layers", "📑"]] as [ActiveTab, string][]).map(([tab, icon]) => (
              <button key={tab} className={`editor-tab ${activeTab === tab ? "active" : ""}`} onClick={() => setActiveTab(tab)}>
                {icon}<span>{tab.charAt(0).toUpperCase() + tab.slice(1)}</span>
              </button>
            ))}
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
                <div className="editor-section-title" style={{ marginTop: 20 }}>Default Font</div>
                <select className="input" value={textProps.fontFamily} onChange={(e) => setTextProps((p) => ({ ...p, fontFamily: e.target.value }))}>
                  {FONTS.map((f) => (<option key={f} value={f} style={{ fontFamily: f }}>{f}</option>))}
                </select>
              </div>
            )}

            {activeTab === "images" && (
              <div className="editor-section">
                <div className="editor-section-title">Upload Image</div>
                <label className="editor-upload-area">
                  <input type="file" accept="image/*" onChange={handleUploadImage} style={{ display: "none" }} />
                  <div className="editor-upload-icon">📸</div>
                  <div>Click or drag to upload</div>
                  <div className="editor-upload-hint">PNG, JPG, SVG</div>
                </label>
              </div>
            )}

            {activeTab === "patches" && (
              <div className="editor-section">
                <div className="editor-section-title">Patch Library</div>
                <div className="editor-patch-grid">
                  {PATCHES.map((p) => (
                    <button key={p.id} className="editor-patch-item" onClick={() => addPatchImage(p.url, p.name)}>
                      <img src={p.url} alt={p.name} />
                      <span>{p.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {activeTab === "layers" && (
              <div className="editor-section">
                <div className="editor-section-title">Layers ({objects.length})</div>
                {objects.length === 0 && <div className="editor-empty">No objects yet. Add text or images.</div>}
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
                  {FONTS.map((f) => (<option key={f} value={f}>{f}</option>))}
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
