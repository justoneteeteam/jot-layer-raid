import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const BOT_PROBE_REGEX = /\.(env|git|php|sql|bak|config|ini|yml|yaml|asp|aspx|cgi|log|md5|sh|tar|gz|zip)$/i;
const BOT_PATH_REGEX = /^\/(wp-admin|wp-login|xmlrpc|admin|phpmyadmin|cgi-bin|\.well-known|\.git|\.env|actuator|console|api-docs)/i;

export function middleware(request: NextRequest) {
  const url = request.nextUrl;

  // Layer 2: Fast Drop bot vulnerability probes immediately (0 DB / rendering overhead)
  if (BOT_PROBE_REGEX.test(url.pathname) || BOT_PATH_REGEX.test(url.pathname)) {
    return new NextResponse('Not Found', {
      status: 404,
      headers: {
        'Cache-Control': 'public, max-age=86400, immutable',
        'X-Robots-Tag': 'noindex, nofollow',
        'Content-Type': 'text/plain',
      },
    });
  }

  const response = NextResponse.next();

  // Layer 1: Edge cache headers for page routes
  if (!url.pathname.startsWith('/api/') && !url.pathname.startsWith('/_next/')) {
    response.headers.set(
      'Cache-Control',
      'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400'
    );
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
