"use client";

import { type ReactNode } from "react";
import { joinClassNames } from "@budget/lib/helpers";

type ChartCardProps = {
  title: string;
  description: string;
  children: ReactNode;
  className?: string;
  footer?: ReactNode;
  actions?: ReactNode;
  minHeight?: number;
  role?: string;
  ariaLabel?: string;
  minWidth?: number;
};

export function ChartCard({
  title,
  description,
  children,
  className,
  footer,
  actions,
  minHeight = 280,
  minWidth = 280,
  role = "img",
  ariaLabel,
}: ChartCardProps) {
  return (
    <section
      className={joinClassNames(
        "flex h-full flex-col rounded-2xl border border-emerald-900/15 bg-white/85 p-5 shadow-[0_20px_38px_-18px_rgba(22,163,74,0.35)] backdrop-blur transition-colors dark:border-emerald-100/10 dark:bg-emerald-950/60 dark:shadow-none",
        className
      )}
    >
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-emerald-950 dark:text-emerald-50">
            {title}
          </h3>
          <p className="text-sm text-emerald-900/80 dark:text-emerald-100/70">
            {description}
          </p>
        </div>
        {actions ? (
          <div className="flex items-center gap-2 text-sm">{actions}</div>
        ) : null}
      </header>
      <div
        className="relative w-full grow"
        style={{ minHeight, minWidth }}
        role={role}
        aria-label={ariaLabel}
      >
        {children}
      </div>
      {footer ? (
        <footer className="mt-4 text-sm text-emerald-900/75 dark:text-emerald-100/70">
          {footer}
        </footer>
      ) : null}
    </section>
  );
}
