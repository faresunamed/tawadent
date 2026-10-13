import { NextRequest, NextResponse } from "next/server";

const LOCALES = ["fr", "ar"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasLocale = LOCALES.some(
    (l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`)
  );
  if (!hasLocale) {
    const url = req.nextUrl.clone();
    url.pathname = `/fr${pathname === "/" ? "" : pathname}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next|api|favicon.ico|manifest.webmanifest|sw.js|icons|logo.svg|.*\\..*).*)",
  ],
};
