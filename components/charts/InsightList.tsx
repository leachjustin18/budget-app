"use client";

import { formatCurrency, formatPercent } from "./formatters";
import type { DashboardData } from "@budget/app/(protected)/dashboard/data";

type InsightListProps = {
  insights: DashboardData["anomalies"];
};

const SEVERITY_STYLES: Record<
  DashboardData["anomalies"][number]["severity"],
  string
> = {
  info: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-200",
  warning:
    "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200",
  critical:
    "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-200",
};

const TYPE_LABELS: Record<
  DashboardData["anomalies"][number]["type"],
  string
> = {
  spending: "Spending",
  income: "Income",
  plan: "Plan",
  category: "Category",
  forecast: "Forecast",
};

export function InsightList({ insights }: InsightListProps) {
  if (!insights.length) {
    return (
      <div className="rounded-xl border border-dashed border-emerald-200/60 bg-emerald-50/60 p-4 text-sm text-emerald-900/70 dark:border-emerald-100/20 dark:bg-emerald-900/40 dark:text-emerald-100/70">
        We&apos;ll call out unusual shifts and opportunities once more activity
        rolls in.
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {insights.map((insight) => (
        <li
          key={insight.id}
          className="rounded-2xl border border-emerald-900/10 bg-white/90 px-4 py-3 shadow-sm dark:border-emerald-100/10 dark:bg-emerald-900/60"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-emerald-950 dark:text-emerald-50">
                {insight.label}
              </p>
              <p className="mt-1 text-sm text-emerald-900/80 dark:text-emerald-100/80">
                {insight.message}
              </p>
              {insight.detail ? (
                <p className="mt-1 text-xs text-emerald-900/60 dark:text-emerald-100/60">
                  {insight.detail}
                </p>
              ) : null}
              <p className="mt-1 text-xs text-emerald-900/60 dark:text-emerald-100/60">
                Δ {formatCurrency(insight.delta)}{" "}
                {insight.percent !== null
                  ? `(${formatPercent(insight.percent)})`
                  : ""}
              </p>
            </div>
            <span
              className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ${SEVERITY_STYLES[insight.severity]}`}
            >
              {TYPE_LABELS[insight.type]}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}
