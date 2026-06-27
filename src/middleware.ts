import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isServerDown } from "@/lib/server-down";

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

  if (pathname === "/maintenance" || pathname.startsWith("/maintenance/")) {
    return NextResponse.next();
  }

  if (isStaticAsset(pathname)) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api")) {
    return NextResponse.json(
      { error: "Server is temporarily down. Please try again later." },
      { status: 503 }
    );
  }

  const url = request.nextUrl.clone();
  url.pathname = "/maintenance";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
