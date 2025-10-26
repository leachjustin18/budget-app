"use client";

import { joinClassNames } from "@budget/lib/helpers";
import type { MonthStatus } from "@budget/lib/monthStatus";

const STATUS_CONFIG: Record<MonthStatus, { label: string; emoji: string; className: string }> = {
  budgeting: {
    label: "Budgeting",
    emoji: "🧩",
    className: "bg-emerald-100 text-emerald-700 border border-emerald-200",
  },
  on_track: {
    label: "On Track",
    emoji: "⚖️",
    className: "bg-emerald-900 text-white border border-emerald-900/70",
  },
  over: {
    label: "Over",
    emoji: "⛔️",
    className: "bg-red-100 text-red-700 font-semibold border border-red-200",
  },
};

export function MonthStatusBadge({
  status,
  className,
}: {
  status: MonthStatus;
  className?: string;
}) {
  const config = STATUS_CONFIG[status];

  return (
    <span
      className={joinClassNames(
        "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs sm:text-sm",
        "shadow-[0_6px_18px_rgba(16,118,110,0.15)]",
        config.className,
        className
      )}
    >
      <span role="img" aria-hidden>
        {config.emoji}
      </span>
      <span>{config.label}</span>
    </span>
  );
}
