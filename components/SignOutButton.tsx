"use client";
import { useState } from "react";
import { signOut } from "next-auth/react";
import { Button } from "@budget/components/UI/Button";
import type { ButtonProps } from "@budget/components/UI/Button";

type SignOutButtonProps = {
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  fullWidth?: boolean;
  className?: string;
};

export default function SignOutButton({
  variant = "secondary",
  size = "md",
  fullWidth,
  className,
}: SignOutButtonProps) {
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
      variant={variant}
      size={size}
      fullWidth={fullWidth}
      className={className}
      loading={isSigningOut}
      loadingText="Signing out..."
      onClick={signOutOfApp}
    >
      Sign Out
    </Button>
  );
}
