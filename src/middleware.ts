import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

function requestPort(request: NextRequest): string {
  const fromUrl = request.nextUrl.port;
  if (fromUrl) return fromUrl;
  const host = request.headers.get('host') || '';
  const idx = host.lastIndexOf(':');
  if (idx > -1) return host.slice(idx + 1);
  return request.nextUrl.protocol === 'https:' ? '443' : '80';
}

function isAdminConsole(request: NextRequest): boolean {
  const raw = String(process.env.ADMIN_CONSOLE ?? '').trim().toLowerCase();
  if (raw === '1' || raw === 'true' || raw === 'yes') return true;
  // Fallback when Edge middleware cannot see process env: detect by listen port.
  return requestPort(request) === '5000';
}

function adminConsoleUrl(request: NextRequest): string {
  const fromEnv = String(process.env.ADMIN_CONSOLE_URL ?? '').trim().replace(/\/$/, '');
  if (fromEnv) return fromEnv;
  const hostHeader = request.headers.get('host') || '127.0.0.1:8000';
  const hostname = hostHeader.split(':')[0] || '127.0.0.1';
  return `http://${hostname}:5000`;
}

function isAllowedOnAdminConsole(pathname: string): boolean {
  if (pathname.startsWith('/admin')) return true;
  if (pathname.startsWith('/api/admin')) return true;
  if (pathname.startsWith('/api/auth')) return true;
  if (pathname === '/login' || pathname.startsWith('/login/')) return true;
  if (pathname.startsWith('/_next')) return true;
  if (pathname === '/favicon.ico') return true;
  if (pathname.startsWith('/icons')) return true;
  return false;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isAdminConsole(request)) {
    if (isAllowedOnAdminConsole(pathname)) {
      return NextResponse.next();
    }
    const url = request.nextUrl.clone();
    url.pathname = '/admin';
    url.search = '';
    return NextResponse.redirect(url);
  }

  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    const target = `${adminConsoleUrl(request)}${pathname}${request.nextUrl.search}`;
    return NextResponse.redirect(target);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
};
