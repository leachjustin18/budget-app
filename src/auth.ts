import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "database" },
  providers: [
    Google({
      allowDangerousEmailAccountLinking: false,
    }),
  ],
  pages: {
    signIn: "/login",
    error: "/auth/error",
  },
  callbacks: {
    async signIn({ user }) {
      const email = user?.email?.toLowerCase() ?? null;
      if (!email) return false;
      const exists = await prisma.user.findFirst({ where: { email } });
      if (!exists) return false; // generic failure only
      return true;
    },
    async session({ session, user }) {
      if (session.user && user?.id) {
        session.user = {
          ...session.user,
          id: user.id,
        } as typeof session.user & { id: string };
      }
      return session;
    },
  },
});
