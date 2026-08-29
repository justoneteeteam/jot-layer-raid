/**
 * Email Templates Engine
 * Produces clean, table-based, inline-styled HTML emails compatible with Gmail, Outlook, Apple Mail, and Yahoo.
 * Includes UTF-8 charset declarations, responsive viewports, absolute HTTPS R2 image URLs, and plain-text fallbacks.
 */

export interface EmailTemplateData {
  title: string;
  headline: string;
  bodyText: string;
  imageUrl?: string;
  actionUrl?: string;
  actionText?: string;
  unsubscribeUrl?: string;
  logoUrl?: string;
  brandName?: string;
  featuredCollections?: Array<{
    name: string;
    url: string;
    imageUrl?: string;
  }>;
}

/**
 * Renders a full, valid, production-ready HTML email document.
 */
export function renderHtmlEmail(data: EmailTemplateData): string {
  const brandName = data.brandName || "Vulius Store";
  const unsubscribeUrl = data.unsubscribeUrl || "https://operation.justonetee.org/api/email/unsubscribe";

  // Convert plain text newlines into properly formatted HTML paragraphs
  const formattedParagraphs = data.bodyText
    .split("\n\n")
    .map(p => p.trim())
    .filter(p => p.length > 0)
    .map(p => `<p style="margin:0 0 16px 0;color:#334155;font-size:15px;line-height:1.6;">${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("");

  const productImageHtml = data.imageUrl ? `
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 20px 0;">
      <tr>
        <td align="center">
          <img src="${escapeHtml(data.imageUrl)}" alt="Ordered Product Image" width="220" style="max-width:220px;width:100%;height:auto;border-radius:8px;border:1px solid #e2e8f0;display:block;" />
        </td>
      </tr>
    </table>
  ` : "";

  const actionButton = data.actionUrl && data.actionText ? `
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:24px 0;">
      <tr>
        <td align="center">
          <table border="0" cellpadding="0" cellspacing="0">
            <tr>
              <td align="center" bgcolor="#0f172a" style="border-radius:6px;">
                <a href="${escapeHtml(data.actionUrl)}" target="_blank" style="display:inline-block;padding:12px 28px;font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#ffffff;font-weight:bold;text-decoration:none;border-radius:6px;background-color:#0f172a;">
                  ${escapeHtml(data.actionText)}
                </a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  ` : "";

  const collectionsHtml = (data.featuredCollections && data.featuredCollections.length > 0) ? `
    <div style="margin-top:32px;padding-top:24px;border-top:1px solid #e2e8f0;">
      <h3 style="margin:0 0 16px 0;color:#0f172a;font-size:16px;font-weight:bold;text-align:center;">🔥 High-Performing Custom Collections</h3>
      <table border="0" cellpadding="0" cellspacing="0" width="100%">
        <tr>
          ${data.featuredCollections.map(c => `
            <td align="center" valign="top" style="padding:8px;width:50%;">
              <a href="${escapeHtml(c.url)}" target="_blank" style="text-decoration:none;color:#0f172a;display:block;">
                ${c.imageUrl ? `<img src="${escapeHtml(c.imageUrl)}" alt="${escapeHtml(c.name)}" width="220" style="max-width:220px;width:100%;height:130px;object-fit:cover;border-radius:6px;border:1px solid #e2e8f0;margin-bottom:8px;display:block;" />` : ""}
                <div style="font-weight:bold;font-size:13px;color:#0f172a;margin-bottom:6px;">${escapeHtml(c.name)}</div>
                <span style="display:inline-block;padding:6px 12px;font-size:12px;color:#ffffff;background-color:#004C54;border-radius:4px;font-weight:600;">Shop Collection &rarr;</span>
              </a>
            </td>
          `).join("")}
        </tr>
      </table>
    </div>
  ` : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(data.title)}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:Arial,Helvetica,sans-serif;-webkit-font-smoothing:antialiased;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#f8fafc;padding:30px 10px;">
    <tr>
      <td align="center">
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width:600px;background-color:#ffffff;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
          
          <!-- Header Bar -->
          <tr>
            <td align="center" style="padding:24px 32px 16px 32px;border-bottom:1px solid #f1f5f9;background-color:#0f172a;">
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:bold;letter-spacing:1px;">${escapeHtml(brandName)}</h1>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding:32px;">
              <h2 style="margin:0 0 16px 0;color:#0f172a;font-size:18px;font-weight:bold;">${escapeHtml(data.headline)}</h2>
              ${productImageHtml}
              ${formattedParagraphs}
              ${actionButton}
              ${collectionsHtml}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px;background-color:#f1f5f9;border-top:1px solid #e2e8f0;text-align:center;color:#64748b;font-size:12px;line-height:1.5;">
              <p style="margin:0 0 8px 0;">This email was sent by <strong>${escapeHtml(brandName)}</strong>.</p>
              <p style="margin:0;">
                If you no longer wish to receive these messages, you can 
                <a href="${escapeHtml(unsubscribeUrl)}" style="color:#0f172a;text-decoration:underline;">Unsubscribe</a> anytime.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Generates clean plain text representation of the email.
 */
export function renderPlainTextEmail(data: EmailTemplateData): string {
  const brandName = data.brandName || "Just One Tee";
  const unsubscribeUrl = data.unsubscribeUrl || "https://operation.justonetee.org/api/email/unsubscribe";

  let text = `${brandName.toUpperCase()} - ${data.headline.toUpperCase()}\n`;
  text += `========================================\n\n`;
  text += `${data.bodyText.trim()}\n\n`;

  if (data.actionUrl && data.actionText) {
    text += `${data.actionText}: ${data.actionUrl}\n\n`;
  }

  text += `----------------------------------------\n`;
  text += `Sent by ${brandName}\n`;
  text += `Unsubscribe: ${unsubscribeUrl}\n`;

  return text;
}

/**
 * Helper to escape HTML characters in dynamic user content.
 */
function escapeHtml(str: string): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
