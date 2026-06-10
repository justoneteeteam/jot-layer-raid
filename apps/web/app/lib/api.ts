const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

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
  return fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });
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
  is_active: boolean;
  apiKey?: string;
  apiSecret?: string;
}

export async function fetchStores(): Promise<Store[]> {
  const res = await apiFetch("/api/stores");
  if (!res.ok) throw new Error("Failed to fetch stores");
  return res.json();
}

export async function createStore(data: { name: string; platform: string; url: string; api_key: string; api_secret: string }): Promise<Store> {
  const res = await apiFetch("/api/stores", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to create store");
  return res.json();
}

export async function updateStore(id: number, data: { name?: string; url?: string; api_key?: string; api_secret?: string }): Promise<{ updated: number }> {
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
