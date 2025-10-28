// src/lib/auth-server.ts
import { getServerSession, type NextAuthOptions } from "next-auth";
// Import the same options you pass to NextAuth in your route
import { authOptions } from "@budget/lib/auth";

export function getSession() {
  return getServerSession(authOptions as NextAuthOptions);
}
