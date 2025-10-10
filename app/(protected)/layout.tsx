import { getServerSession } from "next-auth";
import type { ReactNode } from "react";
import { authOptions } from "@budget/app/api/auth/[...nextauth]/route";
import SecureLayoutShell from "./SecureLayoutShell";

type LayoutProps = {
  children: ReactNode;
};

export default async function SecureLayout({ children }: LayoutProps) {
  const session = await getServerSession(authOptions);

  return <SecureLayoutShell user={session?.user}>{children}</SecureLayoutShell>;
}
