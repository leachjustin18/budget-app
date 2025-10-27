// src/types/next-auth.d.ts
import { DefaultSession } from "next-auth";

declare module "next-auth" {
  /**
   * Extend the built-in session types.
   * You add `id` onto `session.user` in your session callback,
   * so make it part of the type here.
   */
  interface Session {
    user: {
      id: string;
    } & DefaultSession["user"];
  }

  /**
   * If you want `user.id` strongly typed when NextAuth returns a User
   * (e.g., in callbacks), include it here as well.
   */
  interface User {
    id: string;
  }
}

declare module "next-auth/jwt" {
  /**
   * You're currently reading the user id from `token.sub` (built-in).
   * If you later copy it to `token.id` in the jwt callback, keep this.
   * It's optional now since you aren't setting it explicitly.
   */
  interface JWT {
    id?: string;
  }
}
