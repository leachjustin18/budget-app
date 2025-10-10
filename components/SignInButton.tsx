"use client";
import { signIn } from "next-auth/react";
import { Button } from "@budget/components/UI/Button";

export default function SignInButton() {
  return (
    <Button
      className="w-full rounded-xl border px-4 py-2 hover:bg-gray-50"
      onClick={() => signIn("google", { callbackUrl: "/budget" })}
    >
      Continue with Google
    </Button>
  );
}
