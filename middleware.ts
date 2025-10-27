// middleware.ts
import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(req: Request) {
  const url = new URL(req.url);
  const { pathname, search } = url;

  // Always allow NextAuth and your public login page
  if (pathname.startsWith("/api/auth") || pathname === "/login") {
    return NextResponse.next();
  }

  // Check JWT (v5 uses JWT fine with session.strategy = "jwt")
  const token = await getToken({
    req: req as any,
    secret: process.env.AUTH_SECRET,
  });

  if (!token) {
    const login = new URL("/login", url.origin);
    login.searchParams.set("callbackUrl", pathname + search);
    return NextResponse.redirect(login);
  }

  // Optional: if a signed-in user hits /login, send them away
  if (pathname === "/login") {
    return NextResponse.redirect(new URL("/dashboard", url.origin));
  }

  return NextResponse.next();
}

// Only protect the app paths you listed (do NOT include /api/auth or /login)
export const config = {
  matcher: [
    "/dashboard/:path*",
    "/budget/:path*",
    "/categories/:path*",
    "/rules/:path*",
    "/api/protected/:path*",
  ],
};
