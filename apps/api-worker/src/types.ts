export interface Env {
  DB: D1Database;
  BUCKET: R2Bucket;
  FONTS_CACHE_KV: KVNamespace;
  BULK_QUEUE: Queue;
  PINTEREST_QUEUE: Queue;
  AI?: any;
  
  // Environment secrets
  JWT_SECRET?: string;
  QWEN_API_KEY?: string;
  DEEPSEEK_API_KEY?: string;
  OPENAI_API_KEY?: string;
  R2_PUBLIC_URL?: string;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
}
