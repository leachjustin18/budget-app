export { auth as middleware } from "@budget/lib/auth";

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/budget/:path*",
    "/categories/:path*",
    "/rules/:path*",
    "/api/protected/:path*",
  ],
};
