import { getServerSession } from "next-auth";
import { authOptions } from "@budget/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import SignInButton from "@budget/components/SignInButton";

export default async function Home() {
  const session = await getServerSession(authOptions);

  if (session?.user?.email) {
    // already signed in → go to your app
    redirect("/budget"); // or "/budget"
  }

  // render login screen as the main page
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-2xl border p-6 shadow-sm">
        <h1 className="text-2xl font-semibold mb-4 text-center">
          Family Budget — Sign in
        </h1>
        <SignInButton />
        <p className="mt-4 text-xs text-center text-gray-500">
          Google Sign-In is restricted to allowed emails only.
        </p>
      </div>
    </main>
  );
}
