import { NextResponse, type NextRequest } from 'next/server';
import { isAdminOnlyPath } from '@/lib/admin-access';
import { PROTECTED_PREFIXES } from '@/lib/auth-paths';

export function middleware(req: NextRequest): NextResponse {
  const { pathname } = req.nextUrl;
  if (!PROTECTED_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }
  const role = req.cookies.get('oak_role')?.value;
  if (!role) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }
  const url = req.nextUrl.clone();
  if (pathname.startsWith('/worker') && role !== 'WORKER' && role !== 'ADMIN' && role !== 'AGENT') {
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }
  if (pathname.startsWith('/admin') && role !== 'ADMIN' && role !== 'AGENT') {
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }
  // ADMIN-only admin sub-areas: bounce AGENTs back to the admin overview.
  if (isAdminOnlyPath(pathname) && role !== 'ADMIN') {
    url.pathname = '/admin';
    url.search = '';
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/worker/:path*', '/employer/:path*', '/admin/:path*'],
};
