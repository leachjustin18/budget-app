"use client";
import { useState } from "react";
import { signOut } from "next-auth/react";
import { Button } from "@budget/components/UI/Button";

export default function SignOutButton() {
  const [isSigningOut, setIsSigningOut] = useState(false);

  const signOutOfApp = async () => {
    setIsSigningOut(true);
    try {
      await signOut({ callbackUrl: "/" });
    } catch (error) {
      setIsSigningOut(false);
      throw error;
    }
  };

  return (
    <Button
      variant="secondary"
      size="md"
      loading={isSigningOut}
      loadingText="Signing out..."
      onClick={signOutOfApp}
    >
      Sign Out
    </Button>
  );
}
