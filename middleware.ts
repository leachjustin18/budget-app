// protect only these routes (adjust as needed)
export const config = {
  matcher: [
    "/dashboard/:path*",
    "/budget/:path*",
    "/categories/:path*",
    "/rules/:path*",
    "/api/protected/:path*",
  ],
};
