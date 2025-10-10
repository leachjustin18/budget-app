import NextAuth, { type NextAuthOptions } from "next-auth";
import Google from "next-auth/providers/google";

export const authOptions: NextAuthOptions = {
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
    }),
  ],
};

const handler = NextAuth(authOptions);
const { auth } = handler;
export { handler as GET, handler as POST, auth };
