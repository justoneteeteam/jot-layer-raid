import satori from "satori";
import { Resvg, initWasm } from "@resvg/resvg-wasm";
// @ts-ignore
import resvgWasm from "@resvg/resvg-wasm/index_bg.wasm";
import { Env } from "../types";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { fonts } from "../db/schema";

let wasmInitialized = false;
let fallbackFontBuffer: ArrayBuffer | null = null;

async function ensureWasmInitialized() {
  if (!wasmInitialized) {
    try {
      await initWasm(resvgWasm);
      wasmInitialized = true;
    } catch (e) {
      // If already initialized, it throws an error which we can safely ignore
      wasmInitialized = true;
    }
  }
}

async function getFallbackFont(env: Env): Promise<ArrayBuffer> {
  if (fallbackFontBuffer) return fallbackFontBuffer;
  
  const cacheKey = "font:default-fallback";
  const cached = await env.FONTS_CACHE_KV.get(cacheKey, { type: "arrayBuffer" });
  if (cached) {
    fallbackFontBuffer = cached;
    return cached;
  }
  
  const fontUrl = "https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-regular-webfont.ttf";
  const res = await fetch(fontUrl);
  if (!res.ok) {
    throw new Error("Failed to fetch fallback font from CDN");
  }
  
  const buffer = await res.arrayBuffer();
  await env.FONTS_CACHE_KV.put(cacheKey, buffer);
  fallbackFontBuffer = buffer;
  return buffer;
}

async function getFontBuffer(fontName: string, env: Env): Promise<ArrayBuffer | null> {
  const kvKey = `font:${fontName.toLowerCase()}`;
  
  // 1. Check KV Cache
  const cached = await env.FONTS_CACHE_KV.get(kvKey, { type: "arrayBuffer" });
  if (cached) {
    return cached;
  }

  // 2. Query D1 for Font URL
  const db = drizzle(env.DB);
  const fontRecords = await db.select()
    .from(fonts)
    .where(eq(fonts.name, fontName))
    .limit(1);

  const fontRecord = fontRecords[0];
  if (!fontRecord || !fontRecord.fileUrl) {
    return null;
  }

  // 3. Fetch Font File Bytes
  let fontData: ArrayBuffer;
  if (fontRecord.fileUrl.startsWith("http://") || fontRecord.fileUrl.startsWith("https://")) {
    const response = await fetch(fontRecord.fileUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch font from URL: ${fontRecord.fileUrl}`);
    }
    fontData = await response.arrayBuffer();
  } else {
    // Read from R2 Bucket directly if it's a key
    const r2Object = await env.BUCKET.get(fontRecord.fileUrl);
    if (!r2Object) {
      throw new Error(`Font file not found in R2: ${fontRecord.fileUrl}`);
    }
    fontData = await r2Object.arrayBuffer();
  }

  // 4. Save to KV Cache
  await env.FONTS_CACHE_KV.put(kvKey, fontData);
  return fontData;
}

export async function generateJersey(
  canvasJson: any,
  playerName: string,
  playerNumber: number,
  env: Env
): Promise<Uint8Array> {
  await ensureWasmInitialized();

  const objects = canvasJson.objects || [];
  let bgObj: any = null;
  const textObjects: any[] = [];

  // Separate background image from text layers
  for (const obj of objects) {
    const label = obj._layerLabel || "";
    const type = (obj.type || "").toLowerCase();
    if (obj._isJerseyBackground || label === "Jersey Background" || type === "image") {
      if (obj._isJerseyBackground || label === "Jersey Background" || !bgObj) {
        bgObj = obj;
      }
    } else if (type === "textbox" || type === "text") {
      textObjects.push(obj);
    }
  }

  // Determine background image source URL
  let bgUrl = bgObj?.src || "";
  // If the background URL is proxied, clean it or use direct URL
  if (bgUrl.includes("/api/mockups/templates/") && bgUrl.includes("/background/download")) {
    // In workers, we retrieve the mockup template or background file directly from R2 key
    // We can parse the template ID and find the R2 key, or resolve it.
    // For simplicity, let's make sure bgUrl refers to a public URL or an R2 key.
  }

  // Fallback default image if none specified
  if (!bgUrl) {
    bgUrl = "https://images.unsplash.com/photo-1541252710685-973e72d96cef?w=800&auto=format&fit=crop"; // Placeholder
  }

  // Fetch unique font families used in text layers
  const fontFamilies = Array.from(new Set(textObjects.map(obj => obj.fontFamily || "Arial")));
  const fontDataMap: Record<string, ArrayBuffer> = {};

  for (const family of fontFamilies) {
    const buffer = await getFontBuffer(family, env);
    if (buffer) {
      fontDataMap[family] = buffer;
    } else {
      throw new Error(`Font family "${family}" is not available in database or R2.`);
    }
  }

  // Construct SVG Elements via Satori VDOM
  const width = 800;
  const height = 1000;

  const markup = {
    type: "div",
    props: {
      style: {
        position: "relative",
        width: `${width}px`,
        height: `${height}px`,
        display: "flex",
        backgroundColor: canvasJson.backgroundColor || "#e5e7eb",
        overflow: "hidden"
      },
      children: [
        // Background Image
        {
          type: "img",
          props: {
            src: bgUrl,
            style: {
              position: "absolute",
              left: "0px",
              top: "0px",
              width: `${width}px`,
              height: `${height}px`,
              objectFit: "contain"
            }
          }
        },
        // Text Layers
        ...textObjects.flatMap(obj => {
          const label = obj._layerLabel || "";
          let content = obj.text || "";
          
          if (label === "Player Name" || label.toLowerCase().includes("name")) {
            content = playerName.toUpperCase();
          } else if (label === "Player Number" || label.toLowerCase().includes("number")) {
            content = String(playerNumber);
          }

           const fontFam = obj.fontFamily || "Arial";
          let fSize = obj.fontSize || 60;
          
          const maxAllowedWidth = obj.width ? obj.width * (obj.scaleX || 1) : 400;
          const maxAllowedHeight = obj.height ? obj.height * (obj.scaleY || 1) : 100;
          
          // Auto-scale font size if text exceeds bounding box boundaries (semantically defined safe area)
          if (content.length > 0) {
            const charWidthFactor = 0.92;
            const estimatedWidth = content.length * fSize * charWidthFactor;
            if (estimatedWidth > maxAllowedWidth) {
              const scalingRatio = maxAllowedWidth / estimatedWidth;
              fSize = Math.floor(fSize * Math.max(0.4, scalingRatio));
            }
          }
          
          const fillCol = obj.fill || "#FFFFFF";
          const strokeCol = obj.stroke || "#000000";
          const sWidth = obj.strokeWidth || 0;
          
          const left = obj.left || 400;
          const top = obj.top || 500;
          const angle = obj.angle || 0;

          // Mathematically center the bounding box to bypass translate(-50%, -50%) support bugs in Satori
          const leftCorner = left - maxAllowedWidth / 2;
          const topCorner = top - (fSize * 1.15) / 2;

          const elements = [];

          // Render shadow layer if shadow is configured in canvas JSON
          if (obj.shadow && typeof obj.shadow === "object") {
            const shCol = obj.shadow.color || "rgba(0,0,0,0.5)";
            const shOffsetX = obj.shadow.offsetX || 0;
            const shOffsetY = obj.shadow.offsetY || 0;
            
            if (shOffsetX !== 0 || shOffsetY !== 0) {
              const shadowStyle: any = {
                position: "absolute",
                left: `${leftCorner + shOffsetX}px`,
                top: `${topCorner + shOffsetY}px`,
                width: `${maxAllowedWidth}px`,
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                fontFamily: fontFam,
                fontSize: `${fSize}px`,
                color: shCol,
                WebkitTextFillColor: shCol,
                whiteSpace: "nowrap",
                opacity: obj.opacity !== undefined ? obj.opacity : 1
              };

              if (angle !== 0) {
                shadowStyle.transform = `rotate(${angle}deg)`;
                shadowStyle.transformOrigin = "center center";
              }

              elements.push({
                type: "div",
                props: {
                  style: shadowStyle,
                  children: content
                }
              });
            }
          }

          // Main text layer
          const textStyle: any = {
            position: "absolute",
            left: `${leftCorner}px`,
            top: `${topCorner}px`,
            width: `${maxAllowedWidth}px`,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            fontFamily: fontFam,
            fontSize: `${fSize}px`,
            color: fillCol,
            WebkitTextFillColor: fillCol,
            whiteSpace: "nowrap",
            opacity: obj.opacity !== undefined ? obj.opacity : 1
          };

          if (sWidth > 0) {
            textStyle.WebkitTextStroke = `${sWidth}px ${strokeCol}`;
          }

          if (angle !== 0) {
            textStyle.transform = `rotate(${angle}deg)`;
            textStyle.transformOrigin = "center center";
          }

          elements.push({
            type: "div",
            props: {
              style: textStyle,
              children: content
            }
          });

          return elements;
        })
      ]
    }
  };

  // Convert font buffer maps to satori parameters
  const satoriFonts = Object.entries(fontDataMap).map(([name, data]) => ({
    name: name,
    data: data,
    weight: 400 as const,
    style: "normal" as const
  }));

  if (satoriFonts.length === 0) {
    const fallbackBuffer = await getFallbackFont(env);
    satoriFonts.push({
      name: "Arial",
      data: fallbackBuffer,
      weight: 400 as const,
      style: "normal" as const
    });
  }

  // Render to SVG via Satori
  const svg = await satori(markup, {
    width: width,
    height: height,
    fonts: satoriFonts
  });

  // Convert SVG to PNG using resvg-wasm
  const resvg = new Resvg(svg, {
    fitTo: {
      mode: "width",
      value: width
    }
  });

  const pngData = resvg.render();
  return pngData.asPng();
}
