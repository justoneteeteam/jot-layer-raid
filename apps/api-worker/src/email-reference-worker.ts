/**
 * Minimal Standalone Reference Cloudflare Worker Implementation
 * Demonstrates env.EMAIL.send() with Gmail/Outlook compatible table HTML,
 * UTF-8 charset, viewport, R2 HTTPS image URLs, plain text fallback, and error handling.
 */

export interface Env {
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
  CLOUDFLARE_ACCOUNT_ID?: string;
  CLOUDFLARE_API_TOKEN?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/send-test" && request.method === "POST") {
      try {
        const body = (await request.json()) as any;
        const recipient = body.to || "test@example.com";
        const sender = "Just One Tee Support <support@operation.justonetee.org>";
        const subject = "Great news! Your custom order has shipped 🚀";

        // 1. R2 Hosted HTTPS Public Image URL (No r2://, no relative URLs)
        const headerImageUrl = "https://pub-3981afcf4d1b47279c20739515baec8f.r2.dev/email/cogniflo-header.jpg";
        const unsubscribeUrl = `https://operation.justonetee.org/api/email/unsubscribe?email=${encodeURIComponent(recipient)}`;

        // 2. Production Table-based HTML Email Template
        const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#edf2f7;font-family:Arial,Helvetica,sans-serif;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#edf2f7;padding:20px 0;">
    <tr>
      <td align="center">
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width:600px;background-color:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #cbd5e1;">
          
          <!-- R2 Public HTTPS Image Header -->
          <tr>
            <td align="center" style="padding:0;">
              <img src="${headerImageUrl}" alt="Just One Tee Header" width="600" style="display:block;width:100%;max-width:600px;height:auto;border:0;">
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding:32px;color:#334155;font-size:15px;line-height:1.6;">
              <h2 style="margin:0 0 16px 0;color:#0f172a;font-size:20px;">Your package is on its way!</h2>
              <p style="margin:0 0 16px 0;">Your custom order has been dispatched with live carrier tracking.</p>
              
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:24px 0;">
                <tr>
                  <td align="center">
                    <a href="https://www.17track.net/en" target="_blank" style="display:inline-block;padding:12px 24px;background-color:#f97316;color:#ffffff;font-weight:bold;text-decoration:none;border-radius:6px;">
                      Track Package on 17Track &rarr;
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer with Unsubscribe -->
          <tr>
            <td style="padding:20px 32px;background-color:#f1f5f9;border-top:1px solid #e2e8f0;text-align:center;color:#64748b;font-size:12px;">
              <p style="margin:0 0 8px 0;">Just One Tee &bull; support@operation.justonetee.org</p>
              <p style="margin:0;"><a href="${unsubscribeUrl}" style="color:#f97316;">Unsubscribe</a></p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

        // 3. Clean Plain Text Fallback (No HTML source tags)
        const text = `JUST ONE TEE - SHIPPING & LIVE TRACKING ANNOUNCEMENT\n\nYour order has shipped!\nYour package is currently in transit with live carrier tracking.\n\nTrack Package: https://www.17track.net/en\n\nUnsubscribe: ${unsubscribeUrl}`;

        // 4. Console log payload check prior to dispatch
        console.log("HTML payload snippet:", html.substring(0, 200));

        // 5. Send via Cloudflare Workers Email Service
        if (env.EMAIL) {
          await env.EMAIL.send({
            to: recipient,
            from: sender,
            subject: subject,
            html: html,
            text: text,
            headers: {
              "List-Unsubscribe": `<${unsubscribeUrl}>`,
              "List-Unsubscribe-Post": "List-Unsubscribe=One-Click"
            }
          });
          return Response.json({ status: "success", method: "env.EMAIL.send", recipient });
        } else {
          return Response.json({ status: "error", message: "env.EMAIL binding not found" }, { status: 500 });
        }

      } catch (err: any) {
        return Response.json({ status: "error", error: err?.message || String(err) }, { status: 500 });
      }

    }

    return new Response("Cloudflare Worker Email Reference Endpoint", { status: 200 });
  }
};
