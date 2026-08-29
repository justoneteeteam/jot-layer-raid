import { drizzle } from "drizzle-orm/d1";
import {
  pinterestNiches,
  pinterestContentTypes,
  pinterestThemes,
  pinterestPrompts,
  pinterestRecipes,
  pinterestThemeStyles
} from "../db/schema.js";
import type { Env } from "../types.js";

export interface NicheInput {
  niche: string;
  audience?: string;
  language?: string;
  market?: string;
}

export interface NicheThemeDraft {
  name: string;
  description: string;
  mood?: string;
  color_palette?: string;
  season?: string;
  decor_elements?: string;
  compatible_style_names: string[];
}

export interface NicheStyleDraft {
  name: string;
  style_description: string;
  positive_prompt?: string;
  negative_prompt?: string;
  color_palette?: string;
  lighting_style?: string;
  camera_style?: string;
}

export interface NicheContentTypeDraft {
  name: string;
  description?: string;
}

export interface NicheRecipeDraft {
  name: string;
  content_type_name: string;
  description?: string;
  prompt_template: string;
  seo_direction?: string;
  visual_params?: Record<string, any>;
}

export interface NicheLibraryDraft {
  draftId: string;
  input: {
    niche: string;
    audience?: string;
    language?: string;
    market?: string;
  };
  niche_analysis: {
    target_audience: string;
    content_pillars: string[];
    seo_keywords: string[];
  };
  content_types: NicheContentTypeDraft[];
  themes: NicheThemeDraft[];
  styles: NicheStyleDraft[];
  recipes: NicheRecipeDraft[];
  createdAt: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

// ── Helper: Resolve API Key ──────────────────────────────────────────────────

async function resolveApiKey(
  env: Env,
  key: "DEEPSEEK_API_KEY"
): Promise<string> {
  if (env[key]) {
    return env[key]!;
  }
  try {
    const rawSettings = await env.FONTS_CACHE_KV.get("pinterest:settings");
    if (rawSettings) {
      const settings = JSON.parse(rawSettings);
      if (settings[key]) return settings[key];
      if (key === "DEEPSEEK_API_KEY" && settings.deepseekApiKey) return settings.deepseekApiKey;
    }
  } catch (e) {
    console.warn("Could not read settings from KV:", e);
  }
  return "";
}

// ── Validation ───────────────────────────────────────────────────────────────

export function validateNicheLibrary(draft: Partial<NicheLibraryDraft>): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!draft.input?.niche || draft.input.niche.trim().length === 0) {
    errors.push("Niche name is required.");
  }

  if (!draft.themes || draft.themes.length === 0) {
    errors.push("At least one theme is required.");
  } else if (draft.themes.length < 3) {
    warnings.push(`Generated only ${draft.themes.length} themes (recommended: 5+).`);
  }

  if (!draft.styles || draft.styles.length === 0) {
    errors.push("At least one style is required.");
  } else if (draft.styles.length < 5) {
    warnings.push(`Generated only ${draft.styles.length} styles (recommended: 15+).`);
  }

  if (!draft.content_types || draft.content_types.length === 0) {
    errors.push("At least one content type is required.");
  }

  if (!draft.recipes || draft.recipes.length === 0) {
    warnings.push("No recipes generated in draft.");
  }

  // Check style compatibility references
  if (draft.themes && draft.styles) {
    const styleNames = new Set(draft.styles.map((s) => s.name.toLowerCase().trim()));
    for (const t of draft.themes) {
      if (t.compatible_style_names) {
        for (const sName of t.compatible_style_names) {
          if (!styleNames.has(sName.toLowerCase().trim())) {
            warnings.push(`Theme "${t.name}" references style "${sName}" which is not defined in styles list.`);
          }
        }
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

// ── Generate Niche Library via DeepSeek ──────────────────────────────────────

export async function generateNicheLibrary(
  input: NicheInput,
  env: Env
): Promise<NicheLibraryDraft> {
  const apiKey = await resolveApiKey(env, "DEEPSEEK_API_KEY");

  if (!apiKey) {
    throw new Error("DEEPSEEK_API_KEY is not configured in environment or KV settings.");
  }

  const systemPrompt = `You are an expert Pinterest content strategist, art director, and visual prompt engineer.

Given a niche topic, generate a comprehensive Pinterest content configuration library adhering to the following structure:
NICHE → CONTENT TYPES → THEMES → STYLES → RECIPES

RESPOND ONLY with a single valid JSON object in this exact schema (no additional markdown, explanations, or commentary):
{
  "niche_analysis": {
    "target_audience": "detailed description of the core audience",
    "content_pillars": ["pillar1", "pillar2", "pillar3", "pillar4"],
    "seo_keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5", "keyword6", "keyword7", "keyword8"]
  },
  "content_types": [
    {
      "name": "Prompt Card",
      "description": "Educational Pinterest pin displaying a high-value prompt with actionable context"
    },
    {
      "name": "Infographic",
      "description": "Structured visual breakdown with steps, metrics, and bulleted takeaways"
    },
    {
      "name": "Step-by-Step Guide",
      "description": "Sequential numbered tutorial or workflow walkthrough"
    },
    {
      "name": "Workflow Diagram",
      "description": "Visual diagram illustrating an automated process or pipeline"
    },
    {
      "name": "Comparison Guide",
      "description": "Side-by-side comparison table or vs layout"
    },
    {
      "name": "Listicle / Resource Stack",
      "description": "Curated list of tools, formulas, or strategies"
    }
  ],
  "themes": [
    {
      "name": "Theme Name",
      "description": "2-3 sentences explaining this content angle and what value it offers",
      "mood": "Professional, authoritative, high-converting",
      "color_palette": "Deep navy, electric cyan, clean white",
      "season": "Year-round",
      "decor_elements": "Tech UI accents, sleek glassmorphism, clean typography cards",
      "compatible_style_names": ["Style Name 1", "Style Name 2", "Style Name 3", "Style Name 4"]
    }
  ],
  "styles": [
    {
      "name": "Style Name",
      "style_description": "Clean modern SaaS UI aesthetic with dark slate background, crisp typography, and neon accent highlights",
      "positive_prompt": "Clean modern SaaS interface, dark slate background, crisp typography, cyan and indigo lighting, ultra-sharp 4k rendering, vertical 2:3 Pinterest layout",
      "negative_prompt": "blurry, low quality, cluttered background, distorted text, messy layout, watermark, signature",
      "color_palette": "#0F172A, #06B6D4, #6366F1, #F8FAFC",
      "lighting_style": "Soft ambient studio lighting with subtle edge rim light",
      "camera_style": "Direct front-facing vertical composition, macro graphic design capture, 2:3 aspect ratio"
    }
  ],
  "recipes": [
    {
      "name": "Educational Prompt Card",
      "content_type_name": "Prompt Card",
      "description": "Creates a shareable, high-save educational prompt pin",
      "prompt_template": "Vertical 2:3 Pinterest pin about {keyword}. Subject: {product}. Aesthetic: {style}. Theme angle: {theme}. Layout features a bold headline at top, high-contrast prompt container box in center, and 3 takeaway bullets at bottom.",
      "seo_direction": "Target high-intent search keywords with format-specific modifiers like 'prompts for', 'how to use', and 'best practices'",
      "visual_params": {
        "aspect_ratio": "2:3",
        "layout_style": "centered_card",
        "text_density": "moderate"
      }
    }
  ]
}

STRICT GENERATION RULES:
1. Generate 5 distinct, high-impact themes.
2. Generate 15 to 25 unique aesthetic styles. Styles should vary across modern SaaS, minimalist, dark AI, editorial, futuristic, infographic, bold corporate, creator studio, etc.
3. Generate 6 to 8 content types tailored to the target audience and niche format.
4. Generate 6 to 10 actionable recipes. Each recipe MUST link to a valid content_type_name from the content_types list.
5. Every theme MUST include 4 to 6 compatible_style_names referencing styles defined in the styles array.
6. Make all titles, descriptions, and prompt templates realistic, specific to the niche, and immediately usable.`;

  const userPrompt = `Generate a complete Pinterest AI Content Library for the following target niche:

Niche: ${input.niche}
Target Audience: ${input.audience || "Auto-detect optimal audience"}
Language: ${input.language || "English"}
Market / Region: ${input.market || "United States"}`;

  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    signal: AbortSignal.timeout(90000),
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 8000
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`DeepSeek API request failed (${response.status}): ${errorText}`);
  }

  const result = (await response.json()) as any;
  const content = result.choices?.[0]?.message?.content || "";

  if (!content) {
    throw new Error("DeepSeek returned an empty response.");
  }

  let jsonStr = content.trim();
  if (jsonStr.includes("```")) {
    const matches = jsonStr.match(/```(?:json)?([\s\S]*?)```/);
    if (matches && matches[1]) {
      jsonStr = matches[1].trim();
    }
  }

  let parsed: any;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (e: any) {
    throw new Error(`Failed to parse DeepSeek JSON response: ${e.message}\nRaw text: ${jsonStr.slice(0, 300)}...`);
  }

  const draftId = "draft_" + Date.now().toString(36) + "_" + Math.random().toString(36).substring(2, 6);

  const draft: NicheLibraryDraft = {
    draftId,
    input: {
      niche: input.niche,
      audience: input.audience || parsed.niche_analysis?.target_audience || "General Audience",
      language: input.language || "English",
      market: input.market || "United States"
    },
    niche_analysis: {
      target_audience: parsed.niche_analysis?.target_audience || input.audience || "",
      content_pillars: Array.isArray(parsed.niche_analysis?.content_pillars) ? parsed.niche_analysis.content_pillars : [],
      seo_keywords: Array.isArray(parsed.niche_analysis?.seo_keywords) ? parsed.niche_analysis.seo_keywords : []
    },
    content_types: Array.isArray(parsed.content_types) ? parsed.content_types : [],
    themes: Array.isArray(parsed.themes) ? parsed.themes : [],
    styles: Array.isArray(parsed.styles) ? parsed.styles : [],
    recipes: Array.isArray(parsed.recipes) ? parsed.recipes : [],
    createdAt: new Date().toISOString()
  };

  return draft;
}

// ── Persist Approved Draft to D1 Database ─────────────────────────────────────

export async function saveApprovedNiche(
  draft: NicheLibraryDraft,
  env: Env
): Promise<{
  nicheId: number;
  contentTypesCount: number;
  themesCount: number;
  stylesCount: number;
  recipesCount: number;
}> {
  const db = drizzle(env.DB);
  const now = new Date().toISOString();

  // 1. Insert Niche Record
  const [insertedNiche] = await db
    .insert(pinterestNiches)
    .values({
      name: draft.input.niche,
      targetAudience: draft.input.audience || draft.niche_analysis?.target_audience,
      language: draft.input.language || "English",
      market: draft.input.market || "United States",
      aiRawResponse: JSON.stringify(draft),
      status: "approved",
      createdAt: now
    })
    .returning();

  if (!insertedNiche) {
    throw new Error("Failed to insert niche into database.");
  }

  const nicheId = insertedNiche.id;

  // 2. Insert Content Types
  const contentTypeMap = new Map<string, number>();
  let contentTypesCount = 0;

  for (const ct of draft.content_types || []) {
    const [insertedCt] = await db
      .insert(pinterestContentTypes)
      .values({
        nicheId,
        name: ct.name,
        description: ct.description || null,
        createdAt: now
      })
      .returning();

    if (insertedCt) {
      contentTypeMap.set(ct.name.toLowerCase().trim(), insertedCt.id);
      contentTypesCount++;
    }
  }

  // 3. Insert Styles (Prompts)
  const styleMap = new Map<string, number>();
  let stylesCount = 0;

  for (const s of draft.styles || []) {
    const [insertedStyle] = await db
      .insert(pinterestPrompts)
      .values({
        nicheId,
        name: s.name,
        styleDescription: s.style_description || null,
        positivePrompt: s.positive_prompt || null,
        negativePrompt: s.negative_prompt || null,
        colorPalette: s.color_palette || null,
        lightingStyle: s.lighting_style || null,
        cameraStyle: s.camera_style || null,
        createdAt: now
      })
      .returning();

    if (insertedStyle) {
      styleMap.set(s.name.toLowerCase().trim(), insertedStyle.id);
      stylesCount++;
    }
  }

  // 4. Insert Themes and link Compatible Styles in junction table
  let themesCount = 0;

  for (const t of draft.themes || []) {
    const [insertedTheme] = await db
      .insert(pinterestThemes)
      .values({
        nicheId,
        name: t.name,
        description: t.description || null,
        season: t.season || null,
        decorElements: t.decor_elements || null,
        colorPalette: t.color_palette || null,
        mood: t.mood || null,
        recommendedStyles: t.compatible_style_names?.join(", ") || null,
        createdAt: now
      })
      .returning();

    if (insertedTheme) {
      themesCount++;

      // Link compatible styles in junction table
      if (Array.isArray(t.compatible_style_names)) {
        for (const sName of t.compatible_style_names) {
          const styleId = styleMap.get(sName.toLowerCase().trim());
          if (styleId) {
            await db.insert(pinterestThemeStyles).values({
              themeId: insertedTheme.id,
              styleId
            });
          }
        }
      }
    }
  }

  // 5. Insert Recipes
  let recipesCount = 0;

  for (const r of draft.recipes || []) {
    const ctId = r.content_type_name
      ? contentTypeMap.get(r.content_type_name.toLowerCase().trim()) || null
      : null;

    const [insertedRecipe] = await db
      .insert(pinterestRecipes)
      .values({
        nicheId,
        contentTypeId: ctId,
        name: r.name,
        description: r.description || null,
        promptTemplate: r.prompt_template || null,
        seoDirection: r.seo_direction || null,
        visualParams: r.visual_params ? JSON.stringify(r.visual_params) : null,
        createdAt: now
      })
      .returning();

    if (insertedRecipe) {
      recipesCount++;
    }
  }

  return {
    nicheId,
    contentTypesCount,
    themesCount,
    stylesCount,
    recipesCount
  };
}
