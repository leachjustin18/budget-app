// auth.ts (or wherever you configure NextAuth)
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@budget/lib/prisma";

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
      allowDangerousEmailAccountLinking: true,
    }),
  ],
  pages: {
    signIn: "/login",
    error: "/auth/error",
  },
  callbacks: {
    /**
     * Only allow sign-in if the email already exists in your User table.
     * Returns false for a generic failure (no reason leaked to the user).
     */
    async signIn({ user }) {
      const email = user?.email?.toLowerCase() ?? null;
      if (!email) return false;

      const exists = await prisma.user.findUnique({ where: { email } });
      if (!exists) return false; // generic failure only
      return true;
    },

    /**
     * Attach a stable `id` to session.user.
     * Handle both database and jwt cases safely (token can be present depending on strategy).
     */
    async session({ session, token, user }) {
      const id = user?.id ?? token?.sub ?? null;
      if (session.user && id) {
        // Cast to your augmented type (see next-auth.d.ts below)
        (session.user as typeof session.user & { id: string }).id = id;
      }
      return session;
    },
    async redirect({ baseUrl }) {
      // after login, redirect to /budget
      return `${baseUrl}/budget`;
    },
  },
});
