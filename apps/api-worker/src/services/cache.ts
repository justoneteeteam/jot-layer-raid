import { Context, MiddlewareHandler } from "hono";

// ── Layer 3: Sentinel Negative Caching ──────────────────────────────────────
export const NOT_FOUND_SENTINEL = { __notFound: true };

export function isNotFoundSentinel(val: any): boolean {
  return Boolean(val && typeof val === "object" && val.__notFound === true);
}

// ── Layer 2: Bot Probe & Security Scanner Defense Patterns ─────────────────
const BOT_PROBE_REGEX = /\.(env|git|php|sql|bak|config|ini|yml|yaml|asp|aspx|cgi|log|md5|sh|tar|gz|zip)$/i;
const BOT_PATH_REGEX = /^\/(wp-admin|wp-login|xmlrpc|admin|phpmyadmin|cgi-bin|\.well-known|\.git|\.env|actuator|console|api-docs)/i;

export function isBotProbe(pathname: string): boolean {
  return BOT_PROBE_REGEX.test(pathname) || BOT_PATH_REGEX.test(pathname);
}

// ── Layer 1: In-Memory Isolate Cache ────────────────────────────────────────
interface CacheEntry {
  body: string;
  contentType: string;
  status: number;
  headers: Record<string, string>;
  expiresAt: number;
}

const memoryCache = new Map<string, CacheEntry>();
const MAX_MEMORY_ITEMS = 500;

function cleanMemoryCache() {
  const now = Date.now();
  if (memoryCache.size > MAX_MEMORY_ITEMS) {
    memoryCache.clear(); // Flush if size exceeds threshold
    return;
  }
  for (const [key, entry] of memoryCache.entries()) {
    if (entry.expiresAt < now) {
      memoryCache.delete(key);
    }
  }
}

export interface CacheOptions {
  ttl?: number; // TTL in seconds for 200 OK (default 60s)
  negativeTtl?: number; // TTL in seconds for 404 Not Found sentinels (default 86400s / 24h)
  cacheNotFound?: boolean; // Enable 404 negative sentinel caching (default true)
  tags?: string[]; // Cache tags for grouped invalidation
  sMaxAge?: number; // CDN Shared Max-Age in seconds
  staleWhileRevalidate?: number; // Stale While Revalidate in seconds
}

/**
 * Generates a clean URL cache key suitable for Cloudflare Cache API
 */
function getCacheKey(c: Context, customKey?: string): string {
  if (customKey) {
    return `${new URL(c.req.url).origin}/__cache__/${customKey}`;
  }
  const url = new URL(c.req.url);
  // Sort query params for consistent cache keys
  url.searchParams.sort();
  return url.toString();
}

/**
 * Cloudflare KV Cache Helpers
 */
export async function kvGet<T>(kv: KVNamespace | undefined, key: string): Promise<T | null> {
  if (!kv) return null;
  try {
    const raw = await kv.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch (e) {
    console.error(`[KV Cache] Error reading key ${key}:`, e);
    return null;
  }
}

export async function kvSet(
  kv: KVNamespace | undefined,
  key: string,
  value: any,
  ttlSeconds: number = 86400
): Promise<void> {
  if (!kv) return;
  try {
    await kv.put(key, JSON.stringify(value), { expirationTtl: Math.max(ttlSeconds, 60) });
  } catch (e) {
    console.error(`[KV Cache] Error writing key ${key}:`, e);
  }
}

export async function kvDelete(kv: KVNamespace | undefined, key: string): Promise<void> {
  if (!kv) return;
  try {
    await kv.delete(key);
  } catch (e) {
    console.error(`[KV Cache] Error deleting key ${key}:`, e);
  }
}

/**
 * Hono Middleware for automatic caching of GET requests (with 404 Negative Sentinel Caching)
 */
export function cacheResponse(options: CacheOptions = {}): MiddlewareHandler {
  const ttl = options.ttl ?? 60; // 60s default for 200 OK
  const negativeTtl = options.negativeTtl ?? 86400; // 24h default for 404 Not Found
  const cacheNotFound = options.cacheNotFound ?? true;
  const sMaxAge = options.sMaxAge ?? ttl * 5;
  const staleWhileRevalidate = options.staleWhileRevalidate ?? 300;

  return async (c, next) => {
    // Only cache GET requests
    if (c.req.method !== "GET") {
      return next();
    }

    const cacheKey = getCacheKey(c);
    const now = Date.now();

    // 1. Check L1 In-Memory Cache
    cleanMemoryCache();
    const memMatch = memoryCache.get(cacheKey);
    if (memMatch && memMatch.expiresAt > now) {
      const headers = new Headers(memMatch.headers);
      headers.set("X-Cache-Status", memMatch.status === 404 ? "HIT-L1-NEGATIVE" : "HIT-L1");
      return new Response(memMatch.body, {
        status: memMatch.status,
        headers,
      });
    }

    // 2. Check L2 Cloudflare Cache API (if running on Worker)
    let cfCache: Cache | null = null;
    try {
      // @ts-ignore
      cfCache = caches.default;
      if (cfCache) {
        const cfMatch = await cfCache.match(cacheKey);
        if (cfMatch) {
          const cachedResponse = new Response(cfMatch.body, cfMatch);
          cachedResponse.headers.set(
            "X-Cache-Status",
            cfMatch.status === 404 ? "HIT-L2-NEGATIVE" : "HIT-L2"
          );
          return cachedResponse;
        }
      }
    } catch (e) {
      // Ignore cache API errors in dev/testing environments
    }

    // 3. Cache Miss: Execute downstream handler
    await next();

    // 4A. Cache 200 OK responses
    if (c.res.status === 200) {
      const cacheControlHeader = `public, max-age=${ttl}, s-maxage=${sMaxAge}, stale-while-revalidate=${staleWhileRevalidate}`;
      c.res.headers.set("Cache-Control", cacheControlHeader);
      c.res.headers.set("X-Cache-Status", "MISS");

      const responseToCache = c.res.clone();
      const bodyText = await responseToCache.text();
      const contentType = c.res.headers.get("Content-Type") || "application/json";

      const headersObj: Record<string, string> = {};
      c.res.headers.forEach((val, key) => {
        headersObj[key] = val;
      });

      memoryCache.set(cacheKey, {
        body: bodyText,
        contentType,
        status: 200,
        headers: headersObj,
        expiresAt: now + ttl * 1000,
      });

      if (cfCache) {
        try {
          const cacheApiResponse = new Response(bodyText, {
            status: 200,
            headers: {
              ...headersObj,
              "Cache-Control": cacheControlHeader,
            },
          });
          c.executionCtx.waitUntil(cfCache.put(cacheKey, cacheApiResponse));
        } catch (err) {
          console.error("Failed to store 200 OK in Cloudflare Cache API:", err);
        }
      }
    }
    // 4B. Negative Sentinel Caching for 404 Not Found responses
    else if (c.res.status === 404 && cacheNotFound) {
      const negativeCacheHeader = `public, max-age=${negativeTtl}, immutable`;
      c.res.headers.set("Cache-Control", negativeCacheHeader);
      c.res.headers.set("X-Cache-Status", "MISS-NEGATIVE");

      const responseToCache = c.res.clone();
      const bodyText = await responseToCache.text();

      const headersObj: Record<string, string> = {};
      c.res.headers.forEach((val, key) => {
        headersObj[key] = val;
      });

      memoryCache.set(cacheKey, {
        body: bodyText,
        contentType: c.res.headers.get("Content-Type") || "application/json",
        status: 404,
        headers: headersObj,
        expiresAt: now + negativeTtl * 1000,
      });

      if (cfCache) {
        try {
          const cacheApiResponse = new Response(bodyText, {
            status: 404,
            headers: {
              ...headersObj,
              "Cache-Control": negativeCacheHeader,
            },
          });
          c.executionCtx.waitUntil(cfCache.put(cacheKey, cacheApiResponse));
        } catch (err) {
          console.error("Failed to store 404 Negative Sentinel in Cloudflare Cache API:", err);
        }
      }
    }
  };
}

/**
 * Invalidate cached items by key prefix or tag pattern
 */
export async function invalidateCache(c?: Context, keysOrTags: string[] = []): Promise<void> {
  const matchedUrls: string[] = [];

  // Clear L1 Memory Cache matching tags or all if empty
  if (keysOrTags.length === 0) {
    for (const key of memoryCache.keys()) matchedUrls.push(key);
    memoryCache.clear();
  } else {
    for (const [key] of memoryCache.entries()) {
      if (keysOrTags.some((tag) => key.includes(tag))) {
        matchedUrls.push(key);
        memoryCache.delete(key);
      }
    }
  }

  // Clear L2 Cloudflare Cache API if available and Context provided
  if (c) {
    try {
      // @ts-ignore
      const cfCache: Cache = caches.default;
      if (cfCache) {
        // 1. Delete actual cached URLs found in L1 memory
        for (const url of matchedUrls) {
          await cfCache.delete(url);
        }
        // 2. Also purge well-known URL patterns for this origin
        //    (covers cases where L1 was already evicted but L2 still has stale data)
        const origin = new URL(c.req.url).origin;
        const knownPaths = [
          "/api/pinterest/niches",
          "/api/pinterest/niches?status=approved",
          "/api/pinterest/niches?status=draft",
          "/api/pinterest/themes",
          "/api/pinterest/prompts",
        ];
        for (const path of knownPaths) {
          await cfCache.delete(`${origin}${path}`);
        }
      }
    } catch (e) {
      // Ignore cache API errors
    }
  }
}
