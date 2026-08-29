const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://api-worker.justoneteeteam.workers.dev";

export interface Team {
  id: number;
  name: string;
  slug: string;
  league_id: number;
  player_count: number;
}

export interface Player {
  id: number;
  name: string;
  display_name: string;
  number: number;
  type: string;
  group: string;
  is_active: boolean;
}

export interface Font {
  id: number;
  name: string;
  file_url: string;
  preview_url: string;
  category: string;
  team_id?: number;
  jersey_type?: string;
  team_name?: string;
}

export interface Patch {
  id: number;
  name: string;
  image_url: string;
  width: number;
  height: number;
}

export interface Template {
  id: number;
  name: string;
  team_id?: number;
  color_variant?: string;
  original_image_url?: string;
  font_config?: any;
  canvas_json?: any;
  background_color?: string;
}

function getHeaders(customHeaders: HeadersInit = {}): HeadersInit {
  const headers: Record<string, string> = {};
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("token");
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
  }
  return {
    ...headers,
    ...(customHeaders as Record<string, string>),
  };
}

async function apiFetch(path: string, options: RequestInit = {}) {
  const headers = getHeaders(options.headers);
  const method = (options.method || "GET").toUpperCase();
  const fetchOptions: RequestInit = {
    ...options,
    headers,
  };
  if (method === "GET" && !fetchOptions.cache && !fetchOptions.next) {
    fetchOptions.next = { revalidate: 60 };
  }
  return fetch(`${API_BASE}${path}`, fetchOptions);
}

export async function fetchTeams(): Promise<Team[]> {
  const res = await apiFetch("/api/database/teams");
  if (!res.ok) throw new Error("Failed to fetch teams");
  const data = await res.json();
  return data.sort((a: Team, b: Team) => a.name.localeCompare(b.name));
}

export async function fetchPlayers(teamId: number): Promise<Player[]> {
  const res = await apiFetch(`/api/database/teams/${teamId}/players`);
  if (!res.ok) throw new Error("Failed to fetch players");
  return res.json();
}

export async function fetchFonts(teamId?: number, jerseyType?: string): Promise<Font[]> {
  const params = new URLSearchParams();
  if (teamId) params.append("team_id", teamId.toString());
  if (jerseyType && jerseyType !== "All") params.append("jersey_type", jerseyType);
  const res = await apiFetch(`/api/fonts?${params.toString()}`);
  if (!res.ok) throw new Error("Failed to fetch fonts");
  return res.json();
}

export async function fetchPatches(): Promise<Patch[]> {
  const res = await apiFetch("/api/patches");
  if (!res.ok) throw new Error("Failed to fetch patches");
  return res.json();
}

export async function fetchTemplates(): Promise<Template[]> {
  const res = await apiFetch("/api/mockups/templates");
  if (!res.ok) throw new Error("Failed to fetch templates");
  return res.json();
}

export async function fetchTemplate(id: number | string): Promise<Template> {
  const res = await apiFetch(`/api/mockups/templates/${id}`);
  if (!res.ok) throw new Error("Failed to fetch template");
  return res.json();
}

export async function saveTemplate(id: number | string, data: Partial<Template>): Promise<Template> {
  const res = await apiFetch(`/api/mockups/templates/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to save template");
  return res.json();
}

export async function uploadBackground(id: number | string, file: File): Promise<{ image_url: string }> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await apiFetch(`/api/mockups/templates/${id}/background`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) throw new Error("Failed to upload background");
  return res.json();
}

export interface Store {
  id: number;
  name: string;
  platform: string;
  url: string;
  webhook_url?: string;
  webhookUrl?: string;
  is_active: boolean;
  apiKey?: string;
  apiSecret?: string;
}

export async function fetchStores(): Promise<Store[]> {
  const res = await apiFetch(`/api/stores?_t=${Date.now()}`, {
    cache: "no-store"
  });
  if (!res.ok) throw new Error("Failed to fetch stores");
  return res.json();
}

export async function createStore(data: { name: string; platform: string; url: string; api_key: string; api_secret: string; webhook_url?: string }): Promise<Store> {
  const res = await apiFetch("/api/stores", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to create store");
  return res.json();
}

export async function updateStore(id: number, data: { name?: string; url?: string; api_key?: string; api_secret?: string; webhook_url?: string }): Promise<{ updated: number }> {
  const res = await apiFetch(`/api/stores/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update store");
  return res.json();
}

export async function deleteStore(id: number): Promise<{ deleted: number }> {
  const res = await apiFetch(`/api/stores/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete store");
  return res.json();
}

export async function testStoreConnection(id: number): Promise<{ status: string; platform: string; message: string }> {
  const res = await apiFetch(`/api/stores/${id}/test`, {
    method: "POST",
  });
  if (!res.ok) throw new Error("Failed to test store connection");
  return res.json();
}

export async function testStoreCredentials(data: { platform: string; url: string; api_key: string; api_secret: string }): Promise<{ status: string; platform: string; message: string }> {
  const res = await apiFetch("/api/stores/test-credentials", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to test store credentials");
  return res.json();
}

export interface BulkJob {
  id: number;
  name: string;
  status: string;
  total: number;
  done: number;
  created: string;
  store: string;
  template_name?: string;
  team: string;
  template: string;
}

export async function fetchBulkJobs(): Promise<BulkJob[]> {
  const res = await apiFetch("/api/bulk/jobs");
  if (!res.ok) throw new Error("Failed to fetch bulk jobs");
  return res.json();
}

export async function deleteBulkJob(id: number): Promise<{ deleted: number }> {
  const res = await apiFetch(`/api/bulk/jobs/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete bulk job");
  return res.json();
}

// ── Pinterest AI Studio API ──────────────────────────────────────────────────

export interface PinterestStats {
  todayJobs: number;
  completedImages: number;
  failedJobs: number;
  pendingJobs: number;
  monthlyTotal: number;
}

export interface PinterestTrend {
  id: number;
  keyword: string;
  theme?: string;
  style?: string;
  product?: string;
  imageUrl?: string;
  status: string;
  createdAt?: string;
}

export interface PinterestPrompt {
  id: number;
  name: string;
  styleDescription?: string;
  positivePrompt?: string;
  negativePrompt?: string;
  colorPalette?: string;
  lightingStyle?: string;
  cameraStyle?: string;
  createdAt?: string;
}

export interface PinterestTheme {
  id: number;
  name: string;
  season?: string;
  decorElements?: string;
  colorPalette?: string;
  mood?: string;
  recommendedStyles?: string;
  createdAt?: string;
}

export function formatR2ImageUrl(url: string | undefined): string {
  if (!url) return "";
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://api-worker.justoneteeteam.workers.dev";
  if (url.includes(".r2.dev/")) {
    const path = url.split(".r2.dev/")[1];
    return `${API_BASE}/api/pinterest/images/${path}`;
  }
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }
  return `${API_BASE}/api/pinterest/images/${url}`;
}

export interface PinterestHistoryEntry {
  id: number;
  trendId?: number;
  keyword: string;
  theme?: string;
  style?: string;
  product?: string;
  promptUsed?: string;
  negativePrompt?: string;
  fileName?: string;
  seoTitle?: string;
  seoDescription?: string;
  seoTags: string[];
  seoAltText?: string;
  modelUsed?: string;
  generationTimeMs?: number;
  referenceImageUrl?: string;
  generatedImageUrl?: string;
  status: string;
  createdAt?: string;
}

export interface PinterestGenerateResult {
  success: boolean;
  metadata: {
    title: string;
    description: string;
    tags: string[];
    altText: string;
  };
  r2Url?: string;
  fileName: string;
  modelUsed: string;
  generationTimeMs: number;
  promptUsed: string;
  image: string; // base64
  error?: string;
}

export interface PinterestSettings {
  defaultModel: string;
  defaultSize: string;
  defaultFormat: string;
  autoRetry: number;
  seoModel: string;
  qwenApiKey?: string;
  openaiApiKey?: string;
  deepseekApiKey?: string;
}

export async function fetchPinterestStats(): Promise<PinterestStats> {
  const res = await apiFetch("/api/pinterest/stats");
  if (!res.ok) throw new Error("Failed to fetch Pinterest stats");
  return res.json();
}

export async function fetchPinterestTrends(filters?: { search?: string; theme?: string; status?: string; style?: string }): Promise<PinterestTrend[]> {
  const params = new URLSearchParams();
  if (filters?.search) params.append("search", filters.search);
  if (filters?.theme) params.append("theme", filters.theme);
  if (filters?.status) params.append("status", filters.status);
  if (filters?.style) params.append("style", filters.style);
  const res = await apiFetch(`/api/pinterest/trends?${params.toString()}`);
  if (!res.ok) throw new Error("Failed to fetch Pinterest trends");
  return res.json();
}

export async function createPinterestTrend(data: Partial<PinterestTrend>): Promise<PinterestTrend> {
  const res = await apiFetch("/api/pinterest/trends", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to create Pinterest trend");
  return res.json();
}

export async function importPinterestTrends(trends: Partial<PinterestTrend>[]): Promise<{ imported: number }> {
  const res = await apiFetch("/api/pinterest/trends/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ trends }),
  });
  if (!res.ok) throw new Error("Failed to import Pinterest trends");
  return res.json();
}

export async function updatePinterestTrend(id: number, data: Partial<PinterestTrend>): Promise<PinterestTrend> {
  const res = await apiFetch(`/api/pinterest/trends/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update Pinterest trend");
  return res.json();
}

export async function deletePinterestTrend(id: number): Promise<{ deleted: number }> {
  const res = await apiFetch(`/api/pinterest/trends/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete Pinterest trend");
  return res.json();
}

export async function generatePinterestImage(params: {
  keyword: string;
  theme: string;
  style: string;
  product: string;
  referenceImageUrl: string;
  model?: string;
  trendId?: number;
  negativePrompt?: string;
}): Promise<PinterestGenerateResult> {
  const res = await apiFetch("/api/pinterest/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  return res.json();
}

export async function fetchPinterestPrompts(): Promise<PinterestPrompt[]> {
  const res = await apiFetch("/api/pinterest/prompts");
  if (!res.ok) throw new Error("Failed to fetch Pinterest prompts");
  return res.json();
}

export async function createPinterestPrompt(data: Partial<PinterestPrompt>): Promise<PinterestPrompt> {
  const res = await apiFetch("/api/pinterest/prompts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to create Pinterest prompt");
  return res.json();
}

export async function updatePinterestPrompt(id: number, data: Partial<PinterestPrompt>): Promise<PinterestPrompt> {
  const res = await apiFetch(`/api/pinterest/prompts/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update Pinterest prompt");
  return res.json();
}

export async function deletePinterestPrompt(id: number): Promise<{ deleted: number }> {
  const res = await apiFetch(`/api/pinterest/prompts/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete Pinterest prompt");
  return res.json();
}

export async function fetchPinterestThemes(): Promise<PinterestTheme[]> {
  const res = await apiFetch("/api/pinterest/themes");
  if (!res.ok) throw new Error("Failed to fetch Pinterest themes");
  return res.json();
}

export async function createPinterestTheme(data: Partial<PinterestTheme>): Promise<PinterestTheme> {
  const res = await apiFetch("/api/pinterest/themes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to create Pinterest theme");
  return res.json();
}

export async function updatePinterestTheme(id: number, data: Partial<PinterestTheme>): Promise<PinterestTheme> {
  const res = await apiFetch(`/api/pinterest/themes/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update Pinterest theme");
  return res.json();
}

export async function deletePinterestTheme(id: number): Promise<{ deleted: number }> {
  const res = await apiFetch(`/api/pinterest/themes/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete Pinterest theme");
  return res.json();
}

export async function fetchPinterestHistory(filters?: { search?: string; model?: string; from?: string; to?: string }): Promise<PinterestHistoryEntry[]> {
  const params = new URLSearchParams();
  if (filters?.search) params.append("search", filters.search);
  if (filters?.model) params.append("model", filters.model);
  if (filters?.from) params.append("from", filters.from);
  if (filters?.to) params.append("to", filters.to);
  const res = await apiFetch(`/api/pinterest/history?${params.toString()}`);
  if (!res.ok) throw new Error("Failed to fetch Pinterest history");
  return res.json();
}

export async function getPinterestHistoryEntry(id: number): Promise<PinterestHistoryEntry> {
  const res = await apiFetch(`/api/pinterest/history/${id}`);
  if (!res.ok) throw new Error("Failed to fetch Pinterest history entry");
  return res.json();
}

export async function deletePinterestHistory(id: number): Promise<{ deleted: number }> {
  const res = await apiFetch(`/api/pinterest/history/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete Pinterest history");
  return res.json();
}

export async function regenerateFromHistory(id: number): Promise<any> {
  const res = await apiFetch(`/api/pinterest/history/${id}/regenerate`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to get regeneration params");
  return res.json();
}

export async function startPinterestBatch(params: {
  trends?: Partial<PinterestTrend>[];
  imageUrls?: string[];
  keywords?: string[];
  themes?: string[];
  styles?: string[];
  product?: string;
  generateImages?: boolean;
  generateSeo?: boolean;
  variants?: number;
  model?: string;
}): Promise<{ jobId: string; total: number }> {
  const res = await apiFetch("/api/pinterest/batch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error("Failed to start Pinterest batch job");
  return res.json();
}

export async function getPinterestBatchStatus(jobId: string): Promise<{
  jobId: string;
  status: string;
  total: number;
  completed: number;
  failed: number;
}> {
  const res = await apiFetch(`/api/pinterest/batch/${jobId}`);
  if (!res.ok) throw new Error("Failed to get batch job status");
  return res.json();
}

export async function getPinterestSettings(): Promise<PinterestSettings> {
  const res = await apiFetch("/api/pinterest/settings");
  if (!res.ok) throw new Error("Failed to fetch Pinterest settings");
  return res.json();
}

export async function savePinterestSettings(settings: Partial<PinterestSettings>): Promise<{ saved: boolean }> {
  const res = await apiFetch("/api/pinterest/settings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(settings),
  });
  if (!res.ok) throw new Error("Failed to save Pinterest settings");
  return res.json();
}

export async function exportPinterestCSV(from?: string, to?: string): Promise<void> {
  const params = new URLSearchParams();
  if (from) params.append("from", from);
  if (to) params.append("to", to);
  const headers = getHeaders();
  const res = await fetch(`${API_BASE}/api/pinterest/export/csv?${params.toString()}`, { headers });
  if (!res.ok) throw new Error("Failed to export CSV");
  const blob = await res.blob();
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `pinterest-trends-${dd}-${mm}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
