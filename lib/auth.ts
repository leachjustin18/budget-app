import NextAuth, {
  type NextAuthOptions,
  type Session,
  type User,
} from "next-auth";
import type { AdapterUser } from "next-auth/adapters";
import type { JWT } from "next-auth/jwt";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "@budget/lib/prisma";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
    error: "/auth/error",
  },
  providers: [
    GoogleProvider({
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
      allowDangerousEmailAccountLinking: true,
    }),
  ],
  callbacks: {
    // v4 types
    async signIn({ user }: { user: User | AdapterUser }) {
      const email = user?.email?.toLowerCase() ?? null;
      if (!email) return false;
      const exists = await prisma.user.findUnique({ where: { email } });
      return !!exists; // generic failure if not found
    },

    async session({
      session,
      token,
      user,
    }: {
      session: Session;
      token: JWT;
      user: User | AdapterUser;
    }): Promise<Session> {
      const id = (user as AdapterUser)?.id ?? token?.sub ?? null;
      if (session.user && id) {
        (session.user as typeof session.user & { id: string }).id = id;
      }
      return session;
    },

    async redirect({
      baseUrl,
    }: {
      url: string;
      baseUrl: string;
    }): Promise<string> {
      return `${baseUrl}/budget`;
    },
  },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
