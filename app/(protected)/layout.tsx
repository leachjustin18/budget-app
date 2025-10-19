import type { ReactNode } from "react";
import { auth } from "@/auth";
import SecureLayoutShell from "./SecureLayoutShell";

type LayoutProps = {
  children: ReactNode;
};

export default async function SecureLayout({ children }: LayoutProps) {
  const session = await auth();

  return <SecureLayoutShell user={session?.user}>{children}</SecureLayoutShell>;
}
