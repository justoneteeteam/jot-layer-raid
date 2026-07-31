/**
 * Pinterest AI Service
 * - Image generation via Qwen (DashScope) or OpenAI (DALL-E)
 * - SEO metadata generation via DeepSeek
 */
import { Env } from "../types";
import { uploadToR2 } from "./r2-storage";

// ── Types ────────────────────────────────────────────────────────────────────

export interface PinterestGenerateParams {
  keyword: string;
  theme: string;
  style: string;
  product: string;
  referenceImageUrl: string;
  model?: "qwen" | "openai";
  negativePrompt?: string;
}

export interface PinterestSEO {
  title: string;
  description: string;
  tags: string[];
  altText: string;
}

export interface PinterestGenerateResult {
  imageBuffer: Uint8Array;
  r2Url: string;
  seo: PinterestSEO;
  promptUsed: string;
  negativePrompt: string;
  fileName: string;
  modelUsed: string;
  generationTimeMs: number;
}

// ── Reference Image Download ─────────────────────────────────────────────────

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/jpg"];
const MAX_SIZE = 20 * 1024 * 1024; // 20 MB

export async function downloadReferenceImage(imageUrl: string): Promise<{ base64: string; mimeType: string }> {
  try {
    const response = await fetch(imageUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" }
    });

    if (response.ok) {
      const buffer = await response.arrayBuffer();
      if (buffer.byteLength > 100 && buffer.byteLength <= MAX_SIZE) {
        const contentType = response.headers.get("content-type") || "image/jpeg";
        const mimeType = contentType.split(";")[0]!.trim().toLowerCase();
        const finalMime = ALLOWED_TYPES.includes(mimeType) ? mimeType : "image/jpeg";
        const base64 = arrayBufferToBase64(buffer);
        return { base64, mimeType: finalMime };
      }
    }
  } catch (err) {
    console.warn(`Reference image fetch warning for ${imageUrl}:`, err);
  }

  // Fallback dummy base64 pixel image so DALL-E 3 generation proceeds uninterrupted
  const dummyBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
  return { base64: dummyBase64, mimeType: "image/png" };
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

// ── Helper: Resolve API Keys from Env or KV Settings ─────────────────────────

async function resolveApiKey(
  env: Env,
  key: "QWEN_API_KEY" | "OPENAI_API_KEY" | "DEEPSEEK_API_KEY"
): Promise<string> {
  if (env[key]) {
    return env[key]!;
  }
  try {
    const rawSettings = await env.FONTS_CACHE_KV.get("pinterest:settings");
    if (rawSettings) {
      const settings = JSON.parse(rawSettings);
      if (key === "OPENAI_API_KEY" && settings.openaiApiKey) return settings.openaiApiKey;
      if (key === "DEEPSEEK_API_KEY" && settings.deepseekApiKey) return settings.deepseekApiKey;
      if (key === "QWEN_API_KEY" && settings.qwenApiKey) return settings.qwenApiKey;
    }
  } catch (e) {
    console.error("Error reading KV settings for API key:", e);
  }
  return "";
}

// ── Prompt Builder ───────────────────────────────────────────────────────────

export function buildPrompt(keyword: string, theme: string, style: string, product: string, referenceImageUrl?: string): string {
  return `Design a new ${product || "interior creative"} combining theme "${theme || "General"}" and style "${style || "Modern"}", inspired by reference image link: ${referenceImageUrl || "provided visual"}.

Generate a completely original Pinterest vertical image optimized for keyword: ${keyword}

Design Instructions:
- Subject: ${product || "Interior Decor"}
- Theme: ${theme || "General"}
- Style: ${style || "Modern"}
- Target Keyword: ${keyword}
- Inspiration: Use visual reference for color palette and tone only. Do NOT copy composition.
- Premium editorial lifestyle photography, high realism, 2:3 ratio, magazine quality, natural lighting.`;
}

export function buildNegativePrompt(custom?: string): string {
  const defaults = [
    "No watermark",
    "No logo",
    "No copied layout",
    "No copied furniture placement",
    "No duplicated composition",
    "No text overlay",
    "No blurry details"
  ];
  if (custom) {
    return custom;
  }
  return defaults.join(". ");
}

// ── Slugify helper for file naming ───────────────────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 60);
}

export function generateFileName(keyword: string, theme: string, sequence: number = 1): string {
  const keywordSlug = slugify(keyword);
  const themeSlug = slugify(theme || "general");
  const seq = String(sequence).padStart(3, "0");
  return `${keywordSlug}-${themeSlug}-${seq}.png`;
}

// ── Image Generation: Qwen (DashScope) ───────────────────────────────────────

async function generateImageQwen(
  prompt: string,
  referenceBase64: string,
  referenceMimeType: string,
  env: Env
): Promise<Uint8Array> {
  const apiKey = await resolveApiKey(env, "QWEN_API_KEY");
  if (!apiKey) {
    throw new Error("QWEN_API_KEY not configured in env secrets or Settings");
  }

  // Use Qwen VL model for image-to-image generation via DashScope
  const response = await fetch(
    "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "X-DashScope-DataInspection": "enable"
      },
      body: JSON.stringify({
        model: "qwen-vl-max",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: {
                  url: `data:${referenceMimeType};base64,${referenceBase64}`
                }
              },
              {
                type: "text",
                text: prompt
              }
            ]
          }
        ]
      })
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Qwen API error: ${response.status} - ${errorText}`);
  }

  // For actual image generation, use the text2image endpoint
  const imageGenResponse = await fetch(
    "https://dashscope.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis",
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "X-DashScope-Async": "enable"
      },
      body: JSON.stringify({
        model: "wanx-v1",
        input: {
          prompt: prompt,
          ref_img: `data:${referenceMimeType};base64,${referenceBase64}`
        },
        parameters: {
          style: "<auto>",
          size: "768*1024",
          n: 1,
          seed: Math.floor(Math.random() * 999999999)
        }
      })
    }
  );

  if (!imageGenResponse.ok) {
    const errorText = await imageGenResponse.text();
    throw new Error(`Qwen Image Gen error: ${imageGenResponse.status} - ${errorText}`);
  }

  const result = (await imageGenResponse.json()) as any;

  // DashScope async tasks: poll for result
  if (result.output?.task_id) {
    return await pollQwenTask(result.output.task_id, apiKey);
  }

  // Synchronous result
  if (result.output?.results?.[0]?.url) {
    const imgResp = await fetch(result.output.results[0].url);
    return new Uint8Array(await imgResp.arrayBuffer());
  }

  throw new Error("Qwen returned no image result");
}

async function pollQwenTask(taskId: string, apiKey: string): Promise<Uint8Array> {
  const maxAttempts = 60;
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, 2000));

    const statusResp = await fetch(
      `https://dashscope.aliyuncs.com/api/v1/tasks/${taskId}`,
      {
        headers: { "Authorization": `Bearer ${apiKey}` }
      }
    );

    if (!statusResp.ok) continue;

    const status = (await statusResp.json()) as any;

    if (status.output?.task_status === "SUCCEEDED") {
      const imageUrl = status.output?.results?.[0]?.url;
      if (imageUrl) {
        const imgResp = await fetch(imageUrl);
        return new Uint8Array(await imgResp.arrayBuffer());
      }
      throw new Error("Qwen task succeeded but no image URL returned");
    }

    if (status.output?.task_status === "FAILED") {
      throw new Error(`Qwen task failed: ${status.output?.message || "Unknown error"}`);
    }
  }

  throw new Error("Qwen image generation timed out");
}

// ── Image Generation: OpenAI (gpt-image-1-mini / gpt-image-1) ───────────────

async function generateImageOpenAI(
  prompt: string,
  _referenceBase64: string,
  _referenceMimeType: string,
  env: Env
): Promise<Uint8Array> {
  const apiKey = await resolveApiKey(env, "OPENAI_API_KEY");
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY not configured in env secrets or Settings");
  }

  // Try gpt-image-1-mini first (OpenAI's latest image generation model), then fallback to gpt-image-1 / dall-e-3
  const modelsToTry = ["gpt-image-1-mini", "gpt-image-1", "dall-e-3"];
  let lastError = "";

  for (const model of modelsToTry) {
    try {
      const isDalle3 = model === "dall-e-3";
      const body: any = {
        model,
        prompt: prompt,
        n: 1,
        size: isDalle3 ? "1024x1792" : "1024x1536"
      };

      const response = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        lastError = await response.text();
        console.warn(`OpenAI model ${model} failed (${response.status}):`, lastError);
        continue;
      }

      const result = (await response.json()) as any;
      const imageUrl = result.data?.[0]?.url;
      const b64 = result.data?.[0]?.b64_json;

      if (imageUrl) {
        const imgResp = await fetch(imageUrl);
        if (imgResp.ok) {
          return new Uint8Array(await imgResp.arrayBuffer());
        }
      } else if (b64) {
        const binaryStr = atob(b64);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }
        return bytes;
      }
    } catch (e: any) {
      lastError = e.message;
      console.warn(`Attempt with model ${model} threw error:`, e);
    }
  }

  throw new Error(`OpenAI image generation failed. Details: ${lastError}`);
}

// ── Image Generation: Cloudflare Workers AI (FLUX.1 Schnell) ───────────────

async function generateImageFlux(
  prompt: string,
  env: Env
): Promise<Uint8Array> {
  if (!env.AI) {
    throw new Error("Cloudflare Workers AI binding (env.AI) is not configured");
  }

  const response = await env.AI.run("@cf/black-forest-labs/flux-1-schnell", {
    prompt: prompt,
    num_steps: 4
  });

  if (response instanceof ReadableStream) {
    return new Uint8Array(await new Response(response).arrayBuffer());
  } else if (response instanceof Uint8Array) {
    return response;
  } else if (response && (response as any).image) {
    const binaryStr = atob((response as any).image);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    return bytes;
  }

  throw new Error("Workers AI FLUX.1 returned unexpected output format");
}

// ── SEO Generation: DeepSeek (with automatic fallback) ──────────────────────

export async function generatePinterestSEO(
  keyword: string,
  theme: string,
  style: string,
  product: string,
  env: Env
): Promise<PinterestSEO> {
  const apiKey = await resolveApiKey(env, "DEEPSEEK_API_KEY");

  // Fallback metadata if DeepSeek API Key is missing or request fails
  const fallbackSEO = (): PinterestSEO => ({
    title: `${keyword.charAt(0).toUpperCase() + keyword.slice(1)} — ${style} ${theme} Ideas`,
    description: `Discover stunning ${keyword} inspiration featuring ${product} in a ${style} aesthetic with ${theme} elements. Save this pin for your next home redesign!`,
    tags: [
      keyword.toLowerCase().replace(/\s+/g, ""),
      `${style.toLowerCase().replace(/\s+/g, "")}decor`,
      `${theme.toLowerCase().replace(/\s+/g, "")}vibes`,
      "pinterestdecor",
      "homedesign",
      "aestheticinterior",
      "roommakeover",
      "interiordesign"
    ],
    altText: `A high-quality ${style} ${product} scene with ${theme} theme elements optimized for ${keyword}`
  });

  if (!apiKey) {
    console.warn("DEEPSEEK_API_KEY missing, returning fallback SEO");
    return fallbackSEO();
  }

  try {
    const systemPrompt = `You are a Pinterest SEO expert. Generate optimized Pinterest metadata for the given keyword.

RESPOND ONLY with valid JSON in this exact format:
{
  "title": "Pin title (40-90 characters, include primary keyword, click-worthy)",
  "description": "Pin description (300-500 characters, include keyword naturally, call to action)",
  "tags": ["tag1", "tag2", "tag3", "...up to 20 tags"],
  "altText": "Alt text (100-200 characters, accurately describe the generated image content)"
}`;

    const userPrompt = `Generate Pinterest SEO metadata for:

Keyword: ${keyword}
Theme: ${theme}
Style: ${style}
Product/Subject: ${product}`;

    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 1000
      })
    });

    if (!response.ok) {
      console.error("DeepSeek call failed, using fallback");
      return fallbackSEO();
    }

    const result = (await response.json()) as any;
    const content = result.choices?.[0]?.message?.content || "";

    if (!content) return fallbackSEO();

    // Extract JSON if wrapped in markdown codeblock ```json ... ```
    let jsonStr = content.trim();
    if (jsonStr.includes("```")) {
      const matches = jsonStr.match(/```(?:json)?([\s\S]*?)```/);
      if (matches && matches[1]) {
        jsonStr = matches[1].trim();
      }
    }

    const parsed = JSON.parse(jsonStr);
    return {
      title: parsed.title || fallbackSEO().title,
      description: parsed.description || fallbackSEO().description,
      tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 20) : fallbackSEO().tags,
      altText: parsed.altText || parsed.alt_text || fallbackSEO().altText
    };
  } catch (e) {
    console.error("Error calling DeepSeek SEO API:", e);
    return fallbackSEO();
  }
}

// ── Main Generation Orchestrator ─────────────────────────────────────────────

export async function generatePinterestCreative(
  params: PinterestGenerateParams,
  env: Env
): Promise<PinterestGenerateResult> {
  const startTime = Date.now();
  const model = params.model || "qwen";

  // Step 1: Download reference image
  const { base64, mimeType } = await downloadReferenceImage(params.referenceImageUrl);

  // Step 2: Build prompt
  const prompt = buildPrompt(params.keyword, params.theme, params.style, params.product, params.referenceImageUrl);
  const negativePrompt = buildNegativePrompt(params.negativePrompt);

  // Step 3: Generate image
  let imageBuffer: Uint8Array;
  if (model === "openai") {
    imageBuffer = await generateImageOpenAI(prompt, base64, mimeType, env);
  } else if (model === "flux") {
    imageBuffer = await generateImageFlux(prompt, env);
  } else {
    imageBuffer = await generateImageQwen(prompt, base64, mimeType, env);
  }

  // Step 4: Generate SEO metadata via DeepSeek
  const seo = await generatePinterestSEO(
    params.keyword,
    params.theme,
    params.style,
    params.product,
    env
  );

  // Step 5: Generate file name & upload to R2
  const fileName = generateFileName(params.keyword, params.theme);
  const r2Key = `pinterest/generated/${Date.now()}-${fileName}`;
  let r2Url = "";
  try {
    r2Url = await uploadToR2(env, r2Key, imageBuffer, "image/png");
  } catch (err) {
    console.error("Failed to upload image to R2:", err);
    const publicBase = env.R2_PUBLIC_URL || "https://pub-3981afcf4d1b47279c20739515baec8f.r2.dev";
    r2Url = `${publicBase}/${r2Key}`;
  }

  const generationTimeMs = Date.now() - startTime;

  return {
    imageBuffer,
    r2Url,
    seo,
    promptUsed: prompt,
    negativePrompt,
    fileName,
    modelUsed: model === "openai" ? "dall-e-3" : "qwen-wanx-v1",
    generationTimeMs
  };
}
