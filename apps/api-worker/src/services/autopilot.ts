import { drizzle } from "drizzle-orm/d1";
import { pinterestHistory } from "../db/schema";
import { generatePinterestCreative, generatePinterestSEO, generateFileName } from "./pinterest-ai";
import { uploadToR2 } from "./r2-storage";

export interface AccountChannelConfig {
  id: string;
  name: string;
  niche: string;
  claimedDomain: string;
  dailyPinLimit: number;
  keywords: string[];
  themes: string[];
  styles: string[];
  model: string;
}

export const DEFAULT_CHANNELS: AccountChannelConfig[] = [
  {
    id: "account-main",
    name: "Account #1 (Main Store)",
    niche: "Home Decor",
    claimedDomain: "https://vulius.com",
    dailyPinLimit: 10,
    keywords: ["small apartment decor", "cozy aesthetic living room", "japandi bedroom", "boho kitchen decor", "minimalist bathroom ideas"],
    themes: ["General", "Summer Refresh", "Cozy Fall"],
    styles: ["Modern Scandinavian", "Boho Chic", "Japandi"],
    model: "flux"
  },
  {
    id: "nailbox",
    name: "Account #2 (NfcWest / Niche)",
    niche: "Home Decor",
    claimedDomain: "https://nfcwestjersey.com/",
    dailyPinLimit: 10,
    keywords: ["minimalist apartment decor", "boho living room", "small apartment decor", "luxury living room ideas", "aesthetic home styling"],
    themes: ["Summer Refresh", "General", "Cozy Fall"],
    styles: ["Modern Luxury", "Eclectic Chic", "Modern Scandinavian"],
    model: "flux"
  }
];

export async function runAutoPilotBatch(env: any, channels?: AccountChannelConfig[]) {
  const activeChannels = (channels && channels.length) ? channels : DEFAULT_CHANNELS;
  const db = drizzle(env.DB);
  const results: any[] = [];

  for (const ch of activeChannels) {
    const limit = Math.min(ch.dailyPinLimit || 10, 50); // safety cap per trigger
    const channelKeywords = ch.keywords && ch.keywords.length ? ch.keywords : ["home decor ideas"];
    const channelThemes = ch.themes && ch.themes.length ? ch.themes : ["General"];
    const channelStyles = ch.styles && ch.styles.length ? ch.styles : ["Modern Scandinavian"];

    let count = 0;
    for (let k = 0; k < channelKeywords.length && count < limit; k++) {
      for (let t = 0; t < channelThemes.length && count < limit; t++) {
        for (let s = 0; s < channelStyles.length && count < limit; s++) {
          const keyword = channelKeywords[k];
          const theme = channelThemes[t];
          const style = channelStyles[s];

          try {
            const promptUsed = `Design a high-end 1000x1500px Pinterest creative for ${keyword} with theme ${theme} in ${style} visual style. Clean, aesthetic, editorial.`;
            const imageBuffer = await generatePinterestCreative(env, promptUsed, ch.model || "flux");
            const fileName = generateFileName(keyword, theme, count + 1);
            const r2Key = `pinterest/generated/${fileName}`;

            await uploadToR2(env, r2Key, imageBuffer, "image/png");

            // Public / Worker proxy URL
            const workerUrl = `https://api-worker.justoneteeteam.workers.dev/api/pinterest/images/${r2Key}`;

            // SEO Metadata via DeepSeek
            let seoData = { title: keyword, description: keyword, tags: [keyword], altText: keyword };
            try {
              seoData = await generatePinterestSEO(env, keyword, theme, style, "Home Decor");
            } catch (e) {
              console.error("SEO Error:", e);
            }

            const nowIso = new Date().toISOString();
            const [inserted] = await db.insert(pinterestHistory).values({
              keyword,
              theme,
              style,
              product: ch.niche,
              promptUsed,
              fileName,
              seoTitle: seoData.title,
              seoDescription: seoData.description,
              seoTags: JSON.stringify(seoData.tags),
              seoAltText: seoData.altText,
              modelUsed: ch.model || "flux",
              generatedImageUrl: workerUrl,
              accountChannelId: ch.id,
              status: "completed",
              createdAt: nowIso
            }).returning();

            results.push({ channelId: ch.id, item: inserted });
            count++;
          } catch (err: any) {
            console.error(`AutoPilot failed for ${ch.id} - ${keyword}:`, err);
          }
        }
      }
    }
  }

  return results;
}
