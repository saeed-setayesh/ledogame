import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isServerDown } from "@/lib/server-down";

const HOSTING_DOWN_PATH = "/hosting-down";

const STATIC_PREFIXES = [
  "/_next",
  "/icons",
  "/game",
  "/favicon.ico",
  "/manifest.json",
  "/sw.js",
  "/workbox",
];

function isStaticAsset(pathname: string): boolean {
  return STATIC_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
}

export function middleware(request: NextRequest) {
  if (!isServerDown()) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;

  if (
    pathname === HOSTING_DOWN_PATH ||
    pathname.startsWith(HOSTING_DOWN_PATH + "/")
  ) {
    return NextResponse.next();
  }

  // Legacy path → new page
  if (pathname === "/maintenance" || pathname.startsWith("/maintenance/")) {
    const url = request.nextUrl.clone();
    url.pathname = HOSTING_DOWN_PATH;
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (isStaticAsset(pathname)) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api")) {
    return NextResponse.json(
      {
        error:
          "Hosting is unavailable. The server may be suspended due to unpaid hosting.",
      },
      { status: 503 }
    );
  }

  const url = request.nextUrl.clone();
  url.pathname = HOSTING_DOWN_PATH;
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
