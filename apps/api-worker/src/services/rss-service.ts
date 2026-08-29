// Service for building valid RSS 2.0 XML for Pinterest Auto-Publishing
export interface PinterestRSSItem {
  id: number;
  seoTitle?: string | null;
  keyword: string;
  seoDescription?: string | null;
  generatedImageUrl?: string | null;
  theme?: string | null;
  style?: string | null;
  createdAt?: string | null;
}

export function escapeXMLEntities(str: string): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
    .replace(/[\x00-\x1F\x7F]/g, ""); // strip control characters
}

function getMimeType(url: string): string {
  const cleanUrl = url.split("?")[0].toLowerCase();
  if (cleanUrl.endsWith(".jpg") || cleanUrl.endsWith(".jpeg")) return "image/jpeg";
  if (cleanUrl.endsWith(".webp")) return "image/webp";
  if (cleanUrl.endsWith(".gif")) return "image/gif";
  return "image/png";
}

export function buildPinterestRSSFeed(options: {
  channelTitle: string;
  channelLink: string;
  channelDescription: string;
  claimedDomain: string;
  linkPrefix?: string;
  items: PinterestRSSItem[];
}): string {
  const { channelTitle, channelLink, channelDescription, claimedDomain, linkPrefix, items } = options;
  
  // Clean base domain (ensure trailing slash removal)
  const baseDomain = (claimedDomain || "https://vulius.com").replace(/\/+$/, "");

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/" xmlns:atom="http://www.w3.org/2005/Atom">\n`;
  xml += `  <channel>\n`;
  xml += `    <title>${escapeXMLEntities(channelTitle)}</title>\n`;
  xml += `    <link>${escapeXMLEntities(channelLink)}</link>\n`;
  xml += `    <description>${escapeXMLEntities(channelDescription)}</description>\n`;
  xml += `    <language>en-us</language>\n`;
  xml += `    <pubDate>${new Date().toUTCString()}</pubDate>\n`;
  xml += `    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>\n`;

  for (const item of (items || [])) {
    if (!item || !item.generatedImageUrl) continue;

    const title = (item.seoTitle || item.keyword || "Decor Idea").substring(0, 100);
    const description = (item.seoDescription || item.keyword || "").substring(0, 500);

    let destinationLink = `${baseDomain}/`;
    if (item.destinationUrl && item.destinationUrl.trim() !== "") {
      destinationLink = item.destinationUrl.trim();
    } else if (item.product && item.product.trim() !== "") {
      const prod = item.product.trim();
      if (prod.startsWith("http://") || prod.startsWith("https://")) {
        destinationLink = prod;
      } else {
        const prodSlug = prod.toLowerCase().replace(/^\/+|\/+$/g, "");
        destinationLink = `${baseDomain}/${prodSlug}/`;
      }
    } else if (linkPrefix) {
      const prefix = linkPrefix.replace(/^\/+|\/+$/g, "");
      const itemSlug = (item.keyword || "product")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
      destinationLink = `${baseDomain}/${prefix}/${itemSlug}`;
    }

    const pubDate = item.createdAt ? new Date(item.createdAt).toUTCString() : new Date().toUTCString();

    let imageUrl = String(item.generatedImageUrl || "").trim();
    if (imageUrl.includes("r2.dev/")) {
      const parts = imageUrl.split("r2.dev/");
      if (parts[1]) {
        imageUrl = `https://api-worker.justoneteeteam.workers.dev/api/pinterest/images/${parts[1]}`;
      }
    } else if (!imageUrl.startsWith("http://") && !imageUrl.startsWith("https://")) {
      const cleanPath = imageUrl.replace(/^\/+/, "");
      imageUrl = `https://api-worker.justoneteeteam.workers.dev/api/pinterest/images/${cleanPath}`;
    }

    const mimeType = getMimeType(imageUrl);
    const escapedImageUrl = escapeXMLEntities(imageUrl);
    const escapedTitle = escapeXMLEntities(title);
    const escapedLink = escapeXMLEntities(destinationLink);

    xml += `    <item>\n`;
    xml += `      <title>${escapedTitle}</title>\n`;
    xml += `      <link>${escapedLink}</link>\n`;
    xml += `      <description><![CDATA[${description}]]></description>\n`;
    xml += `      <media:content url="${escapedImageUrl}" medium="image" type="${mimeType}" width="1000" height="1500">\n`;
    xml += `        <media:title type="plain">${escapedTitle}</media:title>\n`;
    xml += `      </media:content>\n`;
    xml += `      <enclosure url="${escapedImageUrl}" type="${mimeType}" length="0" />\n`;
    xml += `      <guid isPermaLink="false">pinterest-pin-${item.id}</guid>\n`;
    xml += `      <pubDate>${pubDate}</pubDate>\n`;
    xml += `    </item>\n`;
  }

  xml += `  </channel>\n`;
  xml += `</rss>`;

  return xml;
}

