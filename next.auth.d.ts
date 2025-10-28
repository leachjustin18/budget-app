// src/types/next-auth.d.ts
import { DefaultSession, DefaultUser } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: { id: string } & DefaultSession["user"];
  }

  interface User extends DefaultUser {
    id: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    /** If you copy id into token in the jwt callback, keep this. */
    id?: string;
    /** 'sub' is set by NextAuth to the user id when using JWT strategy. */
    sub?: string;
  }
}
