import { getSession } from "@budget/lib/auth-server";
import { redirect } from "next/navigation";

type CoinProps = {
  id: string;
  className?: string;
  symbol?: string;
};

const Coin = ({ id, className, symbol = "$" }: CoinProps) => {
  const rimGradient = `${id}-rim`;
  const faceGradient = `${id}-face`;
  const highlightGradient = `${id}-highlight`;
  const sparkleGradient = `${id}-sparkle`;

  return (
    <svg
      className={className}
      viewBox="0 0 128 128"
      aria-hidden="true"
      role="img"
    >
      <defs>
        <linearGradient id={rimGradient} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#fff8d9" />
          <stop offset="45%" stopColor="#f6c744" />
          <stop offset="100%" stopColor="#d77f10" />
        </linearGradient>
        <radialGradient id={faceGradient} cx="48%" cy="36%" r="70%">
          <stop offset="0%" stopColor="#fff4c4" />
          <stop offset="52%" stopColor="#f9d468" />
          <stop offset="100%" stopColor="#f19a1f" />
        </radialGradient>
        <linearGradient
          id={highlightGradient}
          x1="8%"
          y1="6%"
          x2="86%"
          y2="78%"
        >
          <stop offset="0%" stopColor="rgba(255,255,255,0.85)" />
          <stop offset="55%" stopColor="rgba(255,255,255,0.25)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </linearGradient>
        <radialGradient id={sparkleGradient} cx="50%" cy="50%" r="55%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.9)" />
          <stop offset="40%" stopColor="rgba(255,255,255,0.7)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </radialGradient>
      </defs>

      <g>
        <circle
          cx="64"
          cy="64"
          r="60"
          fill={`url(#${rimGradient})`}
          stroke="rgba(255,255,255,0.5)"
          strokeWidth="1.8"
        />
        <circle
          cx="64"
          cy="64"
          r="50"
          fill={`url(#${faceGradient})`}
          stroke="rgba(214,130,26,0.5)"
          strokeWidth="2.4"
        />
        <circle
          cx="64"
          cy="64"
          r="42"
          fill="rgba(255,232,150,0.35)"
          stroke="rgba(199,121,15,0.35)"
          strokeWidth="1.8"
        />
        <circle
          cx="64"
          cy="64"
          r="56"
          fill="none"
          stroke="rgba(255,255,255,0.28)"
          strokeWidth="1.3"
          strokeDasharray="2 6"
          opacity="0.4"
        />
        <path
          d="M30 32c20-16 66-18 92 12 2.6 2.9 2.1 7.4-1 9.7L77 81.5c-3 2.2-7.1 2.2-10.1 0L31 41.4c-2.8-2.3-2.5-6.9-1-9.4z"
          fill={`url(#${highlightGradient})`}
          opacity="0.55"
        />
        <path
          d="M38 44c10 6 42 6 52 0"
          fill="none"
          stroke="rgba(255,255,255,0.55)"
          strokeWidth="3.2"
          strokeLinecap="round"
          opacity="0.75"
        />
        {/* intentionally no shadow stroke beneath the symbol */}
        <circle
          cx="46"
          cy="34"
          r="8"
          fill={`url(#${sparkleGradient})`}
          opacity="0.7"
        />
        <path
          d="M90 30l6-6m-4 14 10-10"
          stroke="rgba(255,255,255,0.6)"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        <text
          x="64"
          y="88"
          fill="#7a430f"
          fontSize="60"
          fontFamily="'Inter', 'Segoe UI', sans-serif"
          fontWeight="700"
          textAnchor="middle"
        >
          {symbol}
        </text>
      </g>
    </svg>
  );
};

export default async function Home() {
  const session = await getSession();

  if (session?.user?.email) {
    // already signed in → go to your app
    redirect("/budget"); // or "/budget"
  } else {
    redirect("/login");
  }

  // render login screen as the main page
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-[#CAEFD1] via-[#e4f7ea] to-[#bdecd1] px-6 py-12 text-emerald-950">
      <div className="absolute inset-0">
        <div className="absolute -left-24 -top-24 h-80 w-80 rounded-full bg-emerald-400/25 blur-3xl" />
        <div className="absolute right-[-120px] top-10 h-96 w-96 rounded-full bg-teal-400/25 blur-[140px]" />
        <div className="absolute bottom-[-160px] left-1/3 h-96 w-96 rounded-full bg-emerald-500/18 blur-[140px]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.22),transparent_65%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_right,rgba(45,212,191,0.2),transparent_60%)]" />
      </div>

      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-16 top-24 hidden h-24 w-24 items-center justify-center md:flex">
          <span className="relative inline-flex h-full w-full items-center justify-center rounded-full shadow-[0_18px_45px_rgba(16,185,129,0.28)]">
            <Coin id="coin-a" className="h-full w-full" />
          </span>
        </div>
        <div className="absolute right-20 top-20 hidden h-32 w-32 -rotate-6 items-center justify-center md:flex">
          <span className="relative inline-flex h-full w-full items-center justify-center rounded-full shadow-[0_24px_55px_rgba(45,212,191,0.32)]">
            <Coin id="coin-b" className="h-full w-full" />
          </span>
        </div>
        <div className="absolute bottom-24 right-[18%] hidden h-20 w-20 rotate-6 items-center justify-center md:flex">
          <span className="relative inline-flex h-full w-full items-center justify-center rounded-full shadow-[0_16px_35px_rgba(20,184,166,0.28)]">
            <Coin id="coin-c" className="h-full w-full" />
          </span>
        </div>
        <div className="absolute bottom-16 left-1/4 hidden h-16 w-16 -rotate-3 items-center justify-center md:flex">
          <span className="relative inline-flex h-full w-full items-center justify-center rounded-full shadow-[0_12px_28px_rgba(16,185,129,0.24)]">
            <Coin id="coin-d" className="h-full w-full" />
          </span>
        </div>
      </div>

      <div className="relative z-10 w-full max-w-lg rounded-[32px] border border-emerald-800/15 bg-white/85 px-8 py-10 shadow-[0_30px_70px_rgba(15,118,110,0.22)] backdrop-blur-xl"></div>
    </main>
  );
}
