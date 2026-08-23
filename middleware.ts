import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyToken } from '@/lib/auth/verifyToken';

export async function middleware(request: NextRequest) {
  const token = request.cookies.get('token')?.value;
  const { pathname, search } = request.nextUrl;

  // Check if target is a protected route
  const isProtectedRoute =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/campaigns/create') ||
    pathname.startsWith('/profile');

  if (isProtectedRoute) {
    // Verified against the API (signature + expiry), never a bare decode.
    const verified = token ? await verifyToken(token) : null;

    if (!verified) {
      const redirectUrl = encodeURIComponent(pathname + search);
      const url = request.nextUrl.clone();
      url.pathname = '/connect';
      url.search = `?redirect=${redirectUrl}`;
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard',
    '/dashboard/:path*',
    '/campaigns/create',
    '/campaigns/create/:path*',
    '/profile',
    '/profile/:path*',
  ],
};
