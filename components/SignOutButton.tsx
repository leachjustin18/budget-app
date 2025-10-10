"use client";
import { useState } from "react";
import { signOut } from "next-auth/react";
import { Button } from "@budget/components/UI/Button";

export default function SignOutButton() {
  const [logOut, setLogOut] = useState("Sign Out");

  const signOutOfApp = () => {
    signOut({ callbackUrl: "/" });
    setLogOut("Signing out...");
  };
  return (
    <Button
      className="w-full rounded-xl border px-4 py-2 hover:bg-gray-50"
      onClick={signOutOfApp}
    >
      {logOut}
    </Button>
  );
}
