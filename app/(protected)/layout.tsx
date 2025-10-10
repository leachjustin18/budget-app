import { getServerSession } from "next-auth";
import { authOptions } from "@budget/app/api/auth/[...nextauth]/route";
import SignOutButton from "@budget/components/SignOutButton";

export default async function SecureLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  const user = session?.user;
  const name = user?.name;
  const email = user?.email;

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-white/20 bg-white/70 dark:border-slate-800/60 dark:bg-slate-950/60 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-3">
          <div>
            <h1 className="text-lg font-semibold text-indigo-700 dark:text-indigo-200">
              Family Budget
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Signed in as: {name} - {email}
            </p>
          </div>

          <SignOutButton />
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl px-4 py-6 pb-28 sm:px-6">
        {children}m
      </main>
      Bottom nav
    </>
  );
}
