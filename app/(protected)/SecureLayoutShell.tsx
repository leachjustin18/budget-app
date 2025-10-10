"use client";

import {
  Fragment,
  useEffect,
  useMemo,
  useState,
  type JSX,
  type ReactNode,
} from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Menu,
  Transition,
  MenuItem,
  MenuButton,
  MenuItems,
} from "@headlessui/react";
import SignOutButton from "@budget/components/SignOutButton";
import { joinClassNames } from "@budget/lib/helpers";

type ShellUser = {
  name?: string | null;
  email?: string | null;
  image?: string | null;
};

type SecureLayoutShellProps = {
  children: ReactNode;
  user?: ShellUser;
};

type NavItem = {
  key: string;
  href: string;
  label: string;
  Icon: () => JSX.Element;
  description: string;
};

const navItems: NavItem[] = [
  {
    key: "budget",
    href: "/budget",
    label: "Budget",
    description: "Plan envelopes and spending categories",
    Icon: function BudgetIcon() {
      return (
        <svg
          aria-hidden="true"
          role="img"
          viewBox="0 0 24 24"
          className="size-6"
        >
          <path
            d="M4.75 6.5a1.75 1.75 0 0 1 1.75-1.75h10a1.75 1.75 0 0 1 1.75 1.75v11a1.75 1.75 0 0 1-1.75 1.75h-10A1.75 1.75 0 0 1 4.75 17.5zm1.5.25V17h10.5V6.75z"
            fill="currentColor"
            opacity="0.88"
          />
          <path
            d="M9 4.75a.75.75 0 0 1 .75-.75h4.5a.75.75 0 0 1 0 1.5h-4.5A.75.75 0 0 1 9 4.75"
            fill="currentColor"
            opacity="0.88"
          />
          <circle cx="12" cy="12" r="2.25" fill="currentColor" />
        </svg>
      );
    },
  },
  {
    key: "transactions",
    href: "/transactions",
    label: "Transactions",
    description: "Review and categorize recent activity",
    Icon: function TransactionsIcon() {
      return (
        <svg
          aria-hidden="true"
          role="img"
          viewBox="0 0 24 24"
          className="size-6"
        >
          <path
            d="M5.25 6A1.75 1.75 0 0 1 7 4.25h10A1.75 1.75 0 0 1 18.75 6v2.5A1.75 1.75 0 0 1 17 10.25H7A1.75 1.75 0 0 1 5.25 8.5z"
            fill="currentColor"
            opacity="0.9"
          />
          <path
            d="M5.25 15A1.75 1.75 0 0 1 7 13.25h10a1.75 1.75 0 0 1 1.75 1.75v2.5A1.75 1.75 0 0 1 17 19.25H7A1.75 1.75 0 0 1 5.25 17.5z"
            fill="currentColor"
            opacity="0.6"
          />
          <path
            d="M8.25 7.5h7.5a.75.75 0 0 1 0 1.5h-7.5a.75.75 0 0 1 0-1.5m0 6.5H12a.75.75 0 0 1 0 1.5H8.25a.75.75 0 0 1 0-1.5"
            fill="#f9fafb"
          />
        </svg>
      );
    },
  },
  {
    key: "import",
    href: "/import",
    label: "Import",
    description: "Bring in bank files and statements",
    Icon: function ImportIcon() {
      return (
        <svg
          aria-hidden="true"
          role="img"
          viewBox="0 0 24 24"
          className="size-6"
        >
          <path
            d="M12 3.25a.75.75 0 0 1 .75.75v9.19l1.72-1.72a.75.75 0 0 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0l-3.25-3.25A.75.75 0 0 1 9.03 11.5l1.72 1.72V4A.75.75 0 0 1 12 3.25"
            fill="currentColor"
          />
          <path
            d="M5.5 14.75a.75.75 0 0 0-1.5 0v3A2.75 2.75 0 0 0 6.75 20.5h10.5a2.75 2.75 0 0 0 2.75-2.75v-3a.75.75 0 0 0-1.5 0v3c0 .69-.56 1.25-1.25 1.25H6.75c-.69 0-1.25-.56-1.25-1.25z"
            fill="currentColor"
            opacity="0.8"
          />
        </svg>
      );
    },
  },
  {
    key: "rules",
    href: "/rules",
    label: "Rules",
    description: "Automate how transactions get filed",
    Icon: function RulesIcon() {
      return (
        <svg
          aria-hidden="true"
          role="img"
          viewBox="0 0 24 24"
          className="size-6"
        >
          <path
            d="M5.5 4.75A1.75 1.75 0 0 1 7.25 3h9.5A1.75 1.75 0 0 1 18.5 4.75v14.5a.75.75 0 0 1-1.28.53L12 14.56l-5.22 5.22a.75.75 0 0 1-1.28-.53z"
            fill="currentColor"
            opacity="0.85"
          />
          <path
            d="M9 7.25h6a.75.75 0 0 1 0 1.5H9a.75.75 0 0 1 0-1.5m0 3h6a.75.75 0 0 1 0 1.5H9a.75.75 0 0 1 0-1.5"
            fill="#f8fafc"
          />
        </svg>
      );
    },
  },
  {
    key: "dashboard",
    href: "/dashboard",
    label: "Dashboard",
    description: "Insights and high-level trends",
    Icon: function DashboardIcon() {
      return (
        <svg
          aria-hidden="true"
          role="img"
          viewBox="0 0 24 24"
          className="size-6"
        >
          <path
            d="M4.5 12A7.5 7.5 0 0 1 12 4.5a7.5 7.5 0 0 1 7.5 7.5.75.75 0 0 1-1.5 0 6 6 0 0 0-12 0 .75.75 0 0 1-1.5 0"
            fill="currentColor"
            opacity="0.7"
          />
          <path
            d="M12 12.75a.75.75 0 0 1 .53.22l3.5 3.5a.75.75 0 1 1-1.06 1.06l-3.5-3.5A.75.75 0 0 1 12 12.75"
            fill="#f5f9ff"
          />
          <circle cx="12" cy="12" r="1.75" fill="currentColor" />
        </svg>
      );
    },
  },
];

const useHeaderCollapsed = (): boolean => {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    let lastKnownY = window.scrollY;
    let ticking = false;

    const update = () => {
      const currentY = window.scrollY;
      const direction = currentY > lastKnownY ? "down" : "up";
      const shouldCollapse = currentY > 96 && direction === "down";

      setCollapsed((previous) => {
        if (previous === shouldCollapse) {
          return previous;
        }
        return shouldCollapse;
      });

      if (currentY < 48) {
        setCollapsed(false);
      }

      lastKnownY = currentY;
      ticking = false;
    };

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(update);
        ticking = true;
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return collapsed;
};

const UserAvatar = ({ user }: { user?: ShellUser }) => {
  const initials = useMemo(() => {
    if (!user?.name) return "";
    return user.name
      .split(" ")
      .filter(Boolean)
      .map((segment) => segment[0]?.toUpperCase())
      .slice(0, 2)
      .join("");
  }, [user?.name]);

  if (user?.image) {
    return (
      <span className="relative inline-flex size-11 items-center justify-center overflow-hidden rounded-full border border-white/20 bg-white/5 shadow-[0_8px_18px_rgba(15,23,42,0.35)]">
        <Image
          src={user.image}
          alt={user.name ?? "Signed in user"}
          fill
          sizes="44px"
          className="object-cover"
          priority
        />
      </span>
    );
  }

  return (
    <span className="inline-flex size-11 items-center justify-center rounded-full border border-white/15 bg-gradient-to-br from-sky-500/60 via-indigo-500/60 to-purple-500/60 text-sm font-semibold text-white shadow-[0_10px_25px_rgba(59,130,246,0.35)]">
      {initials || ""}
    </span>
  );
};

export default function SecureLayoutShell({
  children,
  user,
}: SecureLayoutShellProps) {
  const pathname = usePathname();
  const headerCollapsed = useHeaderCollapsed();

  const activeItem = useMemo(() => {
    if (!pathname) return undefined;
    return navItems.find((item) => pathname.startsWith(item.href));
  }, [pathname]);

  const headerTransform = headerCollapsed
    ? "translateY(calc(-100% + 6rem))"
    : "translateY(0)";

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-[#0b0f1c] via-[#141b2f] to-[#1d1d3b] text-slate-100">
      <div className="pointer-events-none fixed inset-x-0 top-0 z-30 flex justify-center ">
        <header
          className="pointer-events-auto w-full transition-transform duration-300 ease-out"
          style={{ transform: headerTransform }}
        >
          <div className="relative overflow-hidden rounded-b-[30px] border border-white/12 bg-white/10 px-5 py-4 shadow-[0_28px_60px_rgba(15,23,42,0.45)] backdrop-blur-xl">
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.18),transparent_65%)]" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_right,rgba(129,140,248,0.22),transparent_60%)]" />
              <div className="absolute inset-0 bg-gradient-to-br from-white/8 via-transparent to-white/0" />
            </div>

            <div className="relative flex items-center gap-4">
              <Menu as="div" className="relative">
                <MenuButton className="flex items-center gap-3 rounded-full border border-white/15 bg-white/5 px-1.5 py-1 pr-3 text-left text-xs text-slate-200 shadow-[0_12px_30px_rgba(15,23,42,0.25)] backdrop-blur-sm transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/60">
                  <UserAvatar user={user} />
                  <div className="hidden sm:block">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-sky-200/90">
                      Signed in
                    </p>
                    <p className="mt-0.5 text-xs font-medium text-white">
                      {user?.name ?? user?.email ?? "Household"}
                    </p>
                  </div>
                </MenuButton>

                <Transition
                  as={Fragment}
                  enter="transition ease-out duration-150"
                  enterFrom="transform opacity-0 translate-y-1"
                  enterTo="transform opacity-100 translate-y-0"
                  leave="transition ease-in duration-100"
                  leaveFrom="transform opacity-100 translate-y-0"
                  leaveTo="transform opacity-0 translate-y-1"
                >
                  <MenuItems
                    portal
                    anchor={{ to: "bottom start", gap: 12 }}
                    className="z-50 w-52 overflow-hidden rounded-2xl border border-white/12 bg-[#10172a]/95 shadow-[0_24px_55px_rgba(8,13,23,0.55)] backdrop-blur-xl focus:outline-none"
                  >
                    <div className="space-y-3 px-4 py-4">
                      <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200">
                        <p className="font-semibold text-white/90">
                          {user?.name ?? "You"}
                        </p>
                        <p className="truncate text-[11px] text-slate-300/90">
                          {user?.email ?? "Signed in"}
                        </p>
                      </div>
                      <MenuItem>
                        {({ focus }) => (
                          <SignOutButton
                            variant={focus ? "tertiary" : "ghost"}
                            size="sm"
                            fullWidth
                            className={joinClassNames(
                              "justify-between border border-white/10 bg-transparent text-[13px] font-medium text-slate-100",
                              focus
                                ? "bg-white/10 text-white shadow-[0_10px_30px_rgba(56,189,248,0.35)]"
                                : "hover:bg-white/10"
                            )}
                          />
                        )}
                      </MenuItem>
                    </div>
                  </MenuItems>
                </Transition>
              </Menu>

              <div className="flex flex-1 flex-col items-center gap-1 text-center">
                <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-sky-200/75">
                  Our Family Budget
                </p>
                <h1 className="text-lg font-semibold text-white">
                  {activeItem?.label ?? "Budget Overview"}
                </h1>
                <p className="text-[11px] text-slate-300/85">
                  {activeItem?.description ??
                    "Keep tabs on the plan and spend intentionally."}
                </p>
              </div>

              <div className="hidden w-[120px] justify-end sm:flex">
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-right">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-200/80">
                    Status
                  </p>
                  <p className="mt-0.5 text-sm font-medium text-emerald-100">
                    On Track
                  </p>
                </div>
              </div>
            </div>
          </div>
        </header>
      </div>

      <main className="relative z-10 mx-auto w-full max-w-5xl px-5 pb-32 pt-36 sm:pt-40">
        <div className="rounded-[28px] border border-white/10 bg-[#0b1120]/60 p-6 backdrop-blur-xl shadow-[0_24px_60px_rgba(8,15,35,0.45)]">
          {children}
        </div>
      </main>

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center">
        <nav className="pointer-events-auto w-full rounded-t-[30px] border border-white/12 bg-[#0d1528]/90 px-3 py-2.5 shadow-[0_24px_45px_rgba(8,13,25,0.6)] backdrop-blur-2xl">
          <div className="flex items-center justify-around">
            {navItems.map((item) => {
              const isActive = pathname?.startsWith(item.href);
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={joinClassNames(
                    "group flex flex-1 flex-col items-center gap-1 rounded-2xl px-3 py-2 text-[11px] font-medium transition",
                    isActive
                      ? "bg-white/15 text-white shadow-[0_16px_35px_rgba(56,189,248,0.35)]"
                      : "text-slate-300/80 hover:bg-white/10 hover:text-white"
                  )}
                >
                  <span
                    className={joinClassNames(
                      "grid size-9 place-items-center rounded-2xl border border-transparent transition-all",
                      isActive
                        ? "border-white/20 bg-gradient-to-br from-sky-400/70 via-indigo-400/70 to-purple-400/70 text-white"
                        : "bg-white/5 text-slate-200/80 group-hover:border-white/15 group-hover:text-white"
                    )}
                  >
                    <item.Icon />
                  </span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}
