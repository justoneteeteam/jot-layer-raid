import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import {
  pinterestHistory,
  pinterestNiches,
  pinterestThemes,
  pinterestPrompts,
  pinterestContentTypes,
  pinterestRecipes
} from "../db/schema.js";
import { generatePinterestCreative } from "./pinterest-ai.js";

export interface AccountChannelConfig {
  id: string;
  name: string;
  niche: string;
  nicheId?: number;
  claimedDomain: string;
  dailyPinLimit: number;
  keywords: string[];
  themes: string[];
  styles: string[];
  contentTypes?: string[];
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
  },
  {
    id: "pinterest-account-3-summer-trends",
    name: "Account #3 (Summer Trends - Vulius)",
    niche: "Home Decor",
    claimedDomain: "https://vulius.com",
    dailyPinLimit: 10,
    keywords: ["summer living room decor", "cozy summer aesthetic", "boho patio design", "japandi summer bedroom"],
    themes: ["Summer", "Summer Refresh"],
    styles: ["Modern Scandinavian", "Boho Chic"],
    model: "flux"
  }
];

export async function getActiveChannels(env: any): Promise<AccountChannelConfig[]> {
  try {
    if (env.FONTS_CACHE_KV) {
      const raw = await env.FONTS_CACHE_KV.get("pinterest:channels");
      if (raw !== null && raw !== undefined) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    }
  } catch (err) {
    console.error("Error reading pinterest:channels from KV:", err);
  }
  return DEFAULT_CHANNELS;
}

export async function runAutoPilotBatch(env: any, channels?: AccountChannelConfig[]) {
  const activeChannels = (channels && channels.length) ? channels : await getActiveChannels(env);
  const db = drizzle(env.DB);
  const jobs: any[] = [];

  for (const ch of activeChannels) {
    const limit = Math.min(ch.dailyPinLimit || 10, 50); // safety cap per trigger
    let channelKeywords = ch.keywords && ch.keywords.length ? ch.keywords : ["pinterest ideas"];
    let channelThemes = ch.themes && ch.themes.length ? ch.themes : [];
    let channelStyles = ch.styles && ch.styles.length ? ch.styles : [];

    // If nicheId is specified and themes/styles are empty, load from database
    if (ch.nicheId) {
      if (channelThemes.length === 0) {
        const dbThemes = await db.select().from(pinterestThemes).where(eq(pinterestThemes.nicheId, ch.nicheId));
        if (dbThemes.length > 0) {
          channelThemes = dbThemes.map(t => t.name);
        }
      }
      if (channelStyles.length === 0) {
        const dbStyles = await db.select().from(pinterestPrompts).where(eq(pinterestPrompts.nicheId, ch.nicheId));
        if (dbStyles.length > 0) {
          channelStyles = dbStyles.map(s => s.name);
        }
      }
    }

    if (channelThemes.length === 0) channelThemes = ["General"];
    if (channelStyles.length === 0) channelStyles = ["Modern"];

    // Build combinations
    const combinations: Array<{ keyword: string; theme: string; style: string; product: string }> = [];
    let count = 0;
    for (let k = 0; k < channelKeywords.length && count < limit; k++) {
      for (let t = 0; t < channelThemes.length && count < limit; t++) {
        for (let s = 0; s < channelStyles.length && count < limit; s++) {
          combinations.push({
            keyword: channelKeywords[k] || "pinterest ideas",
            theme: channelThemes[t] || "General",
            style: channelStyles[s] || "Modern",
            product: ch.niche || "Home Decor"
          });
          count++;
        }
      }
    }

    if (combinations.length === 0) continue;

    const jobId = `autopilot-${Date.now().toString(36)}-${ch.id}`;
    const jobMetadata = {
      jobId,
      type: "autopilot",
      status: "running",
      channelId: ch.id,
      channelName: ch.name,
      niche: ch.niche,
      nicheId: ch.nicheId || null,
      claimedDomain: ch.claimedDomain,
      keywords: channelKeywords,
      themes: channelThemes,
      styles: channelStyles,
      total: combinations.length,
      completed: 0,
      failed: 0,
      model: ch.model || "flux",
      createdAt: new Date().toISOString()
    };

    // Save job metadata to KV
    if (env.FONTS_CACHE_KV) {
      await env.FONTS_CACHE_KV.put(`pinterest:job:${jobId}`, JSON.stringify(jobMetadata), {
        expirationTtl: 86400 * 7 // 7 days TTL
      });
    }

    // Push each combination task to PINTEREST_QUEUE
    if (env.PINTEREST_QUEUE) {
      for (let i = 0; i < combinations.length; i++) {
        const combo = combinations[i]!;
        await env.PINTEREST_QUEUE.send({
          jobId,
          type: "autopilot",
          channelId: ch.id,
          nicheId: ch.nicheId || null,
          trend: {
            keyword: combo.keyword,
            theme: combo.theme,
            style: combo.style,
            product: combo.product,
            imageUrl: ""
          },
          variant: i + 1,
          generateImages: true,
          generateSeo: true,
          model: ch.model || "flux"
        });
      }
    }

    jobs.push(jobMetadata);
  }

  return jobs;
}

export async function runRecurringBatches(env: any) {
  if (!env.FONTS_CACHE_KV) return [];

  let recurringList: any[] = [];
  try {
    const raw = await env.FONTS_CACHE_KV.get("pinterest:recurring-batches");
    if (raw) {
      recurringList = JSON.parse(raw);
    }
  } catch (err) {
    console.error("Error reading recurring batches from KV:", err);
    return [];
  }

  const activeBatches = recurringList.filter((b: any) => b.enabled !== false);
  const spawnedJobs: any[] = [];

  for (const b of activeBatches) {
    try {
      const keywords: string[] = b.keywords && b.keywords.length ? b.keywords : ["pinterest trend"];
      const themes: string[] = b.themes && b.themes.length ? b.themes : ["General"];
      const styles: string[] = b.styles && b.styles.length ? b.styles : ["Modern"];
      const product = b.product || b.niche || "Creative Design";
      const imageUrls: string[] = b.imageUrls && b.imageUrls.length ? b.imageUrls : [""];
      const maxPins = b.maxPins || 5;

      const combinations: Array<{ keyword: string; theme: string; style: string; product: string; imageUrl: string }> = [];
      for (const url of imageUrls) {
        for (const kw of keywords) {
          for (const th of themes) {
            for (const st of styles) {
              if (combinations.length < maxPins) {
                combinations.push({
                  keyword: kw,
                  theme: th,
                  style: st,
                  product,
                  imageUrl: url
                });
              }
            }
          }
        }
      }

      if (combinations.length === 0) continue;

      const jobId = `batch-sched-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 4)}`;
      const totalJobs = combinations.length;

      const jobMetadata = {
        jobId,
        type: "batch",
        status: "running",
        channelId: b.accountChannelId || null,
        channelName: b.name || `Daily Batch: ${product}`,
        niche: product,
        nicheId: b.nicheId || null,
        keywords,
        themes,
        styles,
        total: totalJobs,
        completed: 0,
        failed: 0,
        generateImages: b.generateImages !== false,
        generateSeo: b.generateSeo !== false,
        model: b.model || "flux",
        createdAt: new Date().toISOString()
      };

      if (env.FONTS_CACHE_KV) {
        await env.FONTS_CACHE_KV.put(`pinterest:job:${jobId}`, JSON.stringify(jobMetadata), { expirationTtl: 86400 * 7 });
        await env.FONTS_CACHE_KV.put(`pinterest:batch:${jobId}`, JSON.stringify(jobMetadata), { expirationTtl: 86400 * 7 });
      }

      if (env.PINTEREST_QUEUE) {
        for (let i = 0; i < combinations.length; i++) {
          const combo = combinations[i]!;
          await env.PINTEREST_QUEUE.send({
            jobId,
            type: "batch",
            channelId: b.accountChannelId || null,
            nicheId: b.nicheId || null,
            trend: combo,
            variant: i + 1,
            generateImages: b.generateImages !== false,
            generateSeo: b.generateSeo !== false,
            model: b.model || "flux"
          });
        }
      }

      b.lastRunAt = new Date().toISOString();
      spawnedJobs.push(jobMetadata);
    } catch (batchErr) {
      console.error("Error executing recurring batch:", b.id, batchErr);
    }
  }

  // Save updated lastRunAt
  if (env.FONTS_CACHE_KV && activeBatches.length > 0) {
    try {
      await env.FONTS_CACHE_KV.put("pinterest:recurring-batches", JSON.stringify(recurringList));
    } catch (_) {}
  }

  return spawnedJobs;
}

export async function cancelJob(env: any, jobId: string) {
  if (!env.FONTS_CACHE_KV) return { ok: false, error: "KV not configured" };

  let raw = await env.FONTS_CACHE_KV.get(`pinterest:job:${jobId}`);
  let keyToUse = `pinterest:job:${jobId}`;

  if (!raw) {
    raw = await env.FONTS_CACHE_KV.get(`pinterest:batch:${jobId}`);
    keyToUse = `pinterest:batch:${jobId}`;
  }

  if (!raw) {
    return { ok: false, error: "Job not found" };
  }

  const job = JSON.parse(raw);
  job.status = "cancelled";
  job.finishedAt = new Date().toISOString();

  await env.FONTS_CACHE_KV.put(keyToUse, JSON.stringify(job), {
    expirationTtl: 86400 * 7
  });

  return { ok: true, jobId, status: "cancelled", job };
}

export async function deleteChannel(env: any, channelId: string) {
  if (!env.FONTS_CACHE_KV) return { ok: false, error: "KV not configured" };

  // 1. Remove from channels list in KV
  const channels = await getActiveChannels(env);
  const updatedChannels = channels.filter(c => c.id !== channelId);
  await env.FONTS_CACHE_KV.put("pinterest:channels", JSON.stringify(updatedChannels));

  // 2. Find and cancel any active jobs for this channel
  let cancelledCount = 0;
  try {
    const list = await env.FONTS_CACHE_KV.list({ prefix: "pinterest:job:" });
    for (const key of list.keys) {
      const raw = await env.FONTS_CACHE_KV.get(key.name);
      if (raw) {
        const job = JSON.parse(raw);
        if ((job.channelId === channelId || key.name.includes(channelId)) && job.status === "running") {
          job.status = "cancelled";
          job.finishedAt = new Date().toISOString();
          await env.FONTS_CACHE_KV.put(key.name, JSON.stringify(job), { expirationTtl: 86400 * 7 });
          cancelledCount++;
        }
      }
    }
  } catch (err) {
    console.error("Error cancelling running jobs for channel:", err);
  }

  return { ok: true, channelId, cancelledJobs: cancelledCount };
}

export async function deleteQueueJob(env: any, jobId: string) {
  let deletedPins = 0;

  // 1. Mark as cancelled first to stop any in-flight queue consumers
  if (env.FONTS_CACHE_KV) {
    try {
      const raw = await env.FONTS_CACHE_KV.get(`pinterest:job:${jobId}`) || await env.FONTS_CACHE_KV.get(`pinterest:batch:${jobId}`);
      if (raw) {
        const job = JSON.parse(raw);
        job.status = "cancelled";
        job.finishedAt = new Date().toISOString();
        await env.FONTS_CACHE_KV.put(`pinterest:job:${jobId}`, JSON.stringify(job), { expirationTtl: 60 });
        await env.FONTS_CACHE_KV.put(`pinterest:batch:${jobId}`, JSON.stringify(job), { expirationTtl: 60 });
      }
    } catch (_) {}

    // 2. Delete KV keys
    try {
      await env.FONTS_CACHE_KV.delete(`pinterest:job:${jobId}`);
      await env.FONTS_CACHE_KV.delete(`pinterest:batch:${jobId}`);
    } catch (_) {}
  }

  // 3. Find and delete all pins for this job in D1
  if (env.DB) {
    try {
      const db = drizzle(env.DB);
      const pins = await db
        .select({ id: pinterestHistory.id, generatedImageUrl: pinterestHistory.generatedImageUrl })
        .from(pinterestHistory)
        .where(eq(pinterestHistory.jobId, jobId));

      deletedPins = pins.length;

      // 4. Delete R2 image files if bucket is available
      if (env.BUCKET && pins.length > 0) {
        for (const pin of pins) {
          if (pin.generatedImageUrl) {
            try {
              const match = pin.generatedImageUrl.match(/pinterest\/generated\/[^\s?#]+/);
              if (match) {
                await env.BUCKET.delete(match[0]);
              }
            } catch (err) {
              console.error("Error deleting R2 image for pin:", pin.id, err);
            }
          }
        }
      }

      // 5. Delete records from D1
      if (pins.length > 0) {
        await db.delete(pinterestHistory).where(eq(pinterestHistory.jobId, jobId));
      }
    } catch (err) {
      console.error("Error deleting job pins from D1:", err);
    }
  }

  return { ok: true, jobId, deletedPins };
}

export async function getActiveQueueJobs(env: any) {
  if (!env.FONTS_CACHE_KV) return [];

  const activeJobs: any[] = [];
  const seenJobIds = new Set<string>();
  const now = Date.now();

  try {
    // Scan pinterest:job: prefix
    const listJob = await env.FONTS_CACHE_KV.list({ prefix: "pinterest:job:" });
    for (const key of listJob.keys) {
      const raw = await env.FONTS_CACHE_KV.get(key.name);
      if (raw) {
        try {
          const job = JSON.parse(raw);
          const jId = job.jobId || key.name.replace("pinterest:job:", "");
          const isDone = (job.total <= 0) || ((job.completed || 0) + (job.failed || 0) >= (job.total || 0));

          // Auto-mark completed if total is 0 or done
          if (job.status === "running" && isDone) {
            job.status = "completed";
            job.finishedAt = job.finishedAt || new Date().toISOString();
            await env.FONTS_CACHE_KV.put(key.name, JSON.stringify(job), { expirationTtl: 86400 * 7 });
          } else if (job.status === "running" && !isDone && !seenJobIds.has(jId)) {
            seenJobIds.add(jId);
            const createdTime = job.createdAt ? new Date(job.createdAt).getTime() : now;
            activeJobs.push({
              ...job,
              jobId: jId,
              type: job.type || (jId.startsWith("autopilot") ? "autopilot" : "batch"),
              progress: job.total > 0 ? Math.round(((job.completed || 0) + (job.failed || 0)) / job.total * 100) : 0,
              elapsedMs: Math.max(0, now - createdTime)
            });
          }
        } catch (_) {}
      }
    }

    // Scan legacy pinterest:batch: prefix
    const listBatch = await env.FONTS_CACHE_KV.list({ prefix: "pinterest:batch:" });
    for (const key of listBatch.keys) {
      const raw = await env.FONTS_CACHE_KV.get(key.name);
      if (raw) {
        try {
          const job = JSON.parse(raw);
          const jId = job.jobId || key.name.replace("pinterest:batch:", "");
          const isDone = (job.total <= 0) || ((job.completed || 0) + (job.failed || 0) >= (job.total || 0));

          if (job.status === "running" && isDone) {
            job.status = "completed";
            job.finishedAt = job.finishedAt || new Date().toISOString();
            await env.FONTS_CACHE_KV.put(key.name, JSON.stringify(job), { expirationTtl: 86400 * 7 });
          } else if (job.status === "running" && !isDone && !seenJobIds.has(jId)) {
            seenJobIds.add(jId);
            const createdTime = job.createdAt ? new Date(job.createdAt).getTime() : now;
            activeJobs.push({
              ...job,
              jobId: jId,
              type: job.type || "batch",
              progress: job.total > 0 ? Math.round(((job.completed || 0) + (job.failed || 0)) / job.total * 100) : 0,
              elapsedMs: Math.max(0, now - createdTime)
            });
          }
        } catch (_) {}
      }
    }
  } catch (err) {
    console.error("Error fetching active queue jobs from KV:", err);
  }

  // Sort by createdAt descending
  activeJobs.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  return activeJobs;
}

export async function getQueueHistory(env: any, limit: number = 50) {
  if (!env.FONTS_CACHE_KV) return [];

  const allJobs: any[] = [];
  const seenJobIds = new Set<string>();
  const now = Date.now();

  try {
    const listJob = await env.FONTS_CACHE_KV.list({ prefix: "pinterest:job:" });
    for (const key of listJob.keys) {
      const raw = await env.FONTS_CACHE_KV.get(key.name);
      if (raw) {
        try {
          const job = JSON.parse(raw);
          const jId = job.jobId || key.name.replace("pinterest:job:", "");
          if (!seenJobIds.has(jId)) {
            seenJobIds.add(jId);
            const createdTime = job.createdAt ? new Date(job.createdAt).getTime() : 0;
            const finishedTime = job.finishedAt ? new Date(job.finishedAt).getTime() : 0;
            const durationMs = createdTime ? (finishedTime ? (finishedTime - createdTime) : (now - createdTime)) : 0;
            allJobs.push({
              ...job,
              jobId: jId,
              type: job.type || (jId.startsWith("autopilot") ? "autopilot" : "batch"),
              progress: job.total > 0 ? Math.round(((job.completed || 0) + (job.failed || 0)) / job.total * 100) : 100,
              elapsedMs: Math.max(0, durationMs)
            });
          }
        } catch (_) {}
      }
    }

    const listBatch = await env.FONTS_CACHE_KV.list({ prefix: "pinterest:batch:" });
    for (const key of listBatch.keys) {
      const raw = await env.FONTS_CACHE_KV.get(key.name);
      if (raw) {
        try {
          const job = JSON.parse(raw);
          const jId = job.jobId || key.name.replace("pinterest:batch:", "");
          if (!seenJobIds.has(jId)) {
            seenJobIds.add(jId);
            const createdTime = job.createdAt ? new Date(job.createdAt).getTime() : 0;
            const finishedTime = job.finishedAt ? new Date(job.finishedAt).getTime() : 0;
            const durationMs = createdTime ? (finishedTime ? (finishedTime - createdTime) : (now - createdTime)) : 0;
            allJobs.push({
              ...job,
              jobId: jId,
              type: job.type || "batch",
              progress: job.total > 0 ? Math.round(((job.completed || 0) + (job.failed || 0)) / job.total * 100) : 100,
              elapsedMs: Math.max(0, durationMs)
            });
          }
        } catch (_) {}
      }
    }
  } catch (err) {
    console.error("Error fetching queue history from KV:", err);
  }

  allJobs.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  return allJobs.slice(0, limit);
}

