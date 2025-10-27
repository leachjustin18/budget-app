import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: { signIn: "/login" },
});

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/budget/:path*",
    "/categories/:path*",
    "/rules/:path*",
    "/api/protected/:path*",
  ],
};
