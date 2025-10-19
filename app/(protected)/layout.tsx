import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { auth } from "@budget/lib/auth";
import { CacheProvider } from "@budget/app/providers/CacheProvider";
import CachePrefetchGate from "./CachePrefetchGate";
import SecureLayoutShell from "./SecureLayoutShell";

type LayoutProps = {
  children: ReactNode;
};

export default async function SecureLayout({ children }: LayoutProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const primaryMonth = `${year}-${month}`;

  return (
    <CacheProvider>
      <CachePrefetchGate months={[primaryMonth]} />
      <SecureLayoutShell user={session.user}>{children}</SecureLayoutShell>
    </CacheProvider>
  );
}
