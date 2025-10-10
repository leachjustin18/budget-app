"use client";
import { signIn } from "next-auth/react";
import { Button } from "@budget/components/UI/Button";

export default function SignInButton() {
  const handleSignIn = () => {
    void signIn("google", { callbackUrl: "/budget" });
  };

  return (
    <Button variant="google" size="lg" fullWidth onClick={handleSignIn}>
      Continue with Google
    </Button>
  );
}
