export interface Env {
  DB: D1Database;
  BUCKET: R2Bucket;
  FONTS_CACHE_KV: KVNamespace;
  BULK_QUEUE: Queue;
  PINTEREST_QUEUE: Queue;
  AI?: any;
  EMAIL?: {
    send(message: {
      to: string | string[];
      from: string;
      subject: string;
      text?: string;
      html?: string;
      headers?: Record<string, string>;
    }): Promise<void>;
  };
  
  // Environment secrets
  JWT_SECRET?: string;
  QWEN_API_KEY?: string;
  DEEPSEEK_API_KEY?: string;
  OPENAI_API_KEY?: string;
  R2_PUBLIC_URL?: string;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
  CLOUDFLARE_ACCOUNT_ID?: string;
  CLOUDFLARE_API_TOKEN?: string;
  DEFAULT_FROM_EMAIL?: string;
  DEFAULT_FROM_NAME?: string;
  UNSUBSCRIBE_BASE_URL?: string;
}

