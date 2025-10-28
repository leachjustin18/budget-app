import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@budget/lib/auth-server";
import { CacheProvider } from "@budget/app/providers/CacheProvider";
import { buildInitialCache } from "@budget/lib/cache/hydration";
import CachePrefetchGate from "./CachePrefetchGate";
import SecureLayoutShell from "./SecureLayoutShell";
import { monthKey } from "@budget/lib/helpers";

type LayoutProps = {
  children: ReactNode;
};

export default async function SecureLayout({ children }: LayoutProps) {
  const session = await getSession();

  if (!session?.user) {
    redirect("/login");
  }

  const primaryMonth = monthKey;
  const initialCacheEntries = await buildInitialCache();

  return (
    <CacheProvider initialEntries={initialCacheEntries}>
      <CachePrefetchGate months={[primaryMonth]} />
      <SecureLayoutShell user={session.user}>{children}</SecureLayoutShell>
    </CacheProvider>
  );
}
