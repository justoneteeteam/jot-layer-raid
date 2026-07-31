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

export function buildPinterestRSSFeed(options: {
  channelTitle: string;
  channelLink: string;
  channelDescription: string;
  claimedDomain: string;
  items: PinterestRSSItem[];
}): string {
  const { channelTitle, channelLink, channelDescription, claimedDomain, items } = options;
  
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

    const itemSlug = (item.keyword || "pin")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    const destinationLink = `${baseDomain}/pins/${itemSlug}-${item.id}`;

    const pubDate = item.createdAt ? new Date(item.createdAt).toUTCString() : new Date().toUTCString();

    let imageUrl = String(item.generatedImageUrl || "");
    if (imageUrl.includes("r2.dev/")) {
      const parts = imageUrl.split("r2.dev/");
      if (parts[1]) {
        imageUrl = `https://api-worker.justoneteeteam.workers.dev/api/pinterest/images/${parts[1]}`;
      }
    }

    xml += `    <item>\n`;
    xml += `      <title>${escapeXMLEntities(title)}</title>\n`;
    xml += `      <link>${escapeXMLEntities(destinationLink)}</link>\n`;
    xml += `      <description>${escapeXMLEntities(description)}</description>\n`;
    xml += `      <media:content url="${escapeXMLEntities(imageUrl)}" medium="image" type="image/png" width="1000" height="1500" />\n`;
    xml += `      <enclosure url="${escapeXMLEntities(imageUrl)}" length="524288" type="image/png" />\n`;
    xml += `      <image>\n`;
    xml += `        <url>${escapeXMLEntities(imageUrl)}</url>\n`;
    xml += `        <title>${escapeXMLEntities(title)}</title>\n`;
    xml += `        <link>${escapeXMLEntities(destinationLink)}</link>\n`;
    xml += `      </image>\n`;
    xml += `      <guid isPermaLink="false">pinterest-pin-${item.id}</guid>\n`;
    xml += `      <pubDate>${pubDate}</pubDate>\n`;
    xml += `    </item>\n`;
  }

  xml += `  </channel>\n`;
  xml += `</rss>`;

  return xml;
}
