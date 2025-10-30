import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@budget/lib/auth-server";
import SecureLayoutShell from "./SecureLayoutShell";

type LayoutProps = {
  children: ReactNode;
};

export default async function SecureLayout({ children }: LayoutProps) {
  const session = await getSession();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <SecureLayoutShell user={session.user}>{children}</SecureLayoutShell>
  );
}
