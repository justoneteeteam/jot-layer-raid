import { Env } from "../types";

export async function uploadToR2(
  env: Env,
  key: string,
  data: any,
  contentType: string = "image/png"
): Promise<string> {
  await env.BUCKET.put(key, data, {
    httpMetadata: { contentType: contentType }
  });
  const apiBase = "https://api-worker.justoneteeteam.workers.dev";
  return `${apiBase}/api/pinterest/images/${key}`;
}

export async function getFromR2(
  env: Env,
  key: string
): Promise<{ body: ReadableStream; contentType: string } | null> {
  const object = await env.BUCKET.get(key);
  if (!object) return null;
  
  return {
    body: object.body,
    contentType: object.httpMetadata?.contentType || "image/png"
  };
}

export async function deleteFromR2(
  env: Env,
  key: string
): Promise<void> {
  await env.BUCKET.delete(key);
}
