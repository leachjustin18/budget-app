"use client";
import { signIn } from "next-auth/react";

export default function Login() {
  return (
    <main className="max-w-md mx-auto py-16 px-6 text-center">
      <h1 className="text-2xl font-semibold mb-6">Sign in</h1>
      <button
        className="px-4 py-2 rounded bg-emerald-600 text-white"
        onClick={() => signIn("google")}
      >
        Continue with Google
      </button>
    </main>
  );
}
