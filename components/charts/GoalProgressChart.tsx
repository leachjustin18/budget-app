"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCurrency, formatPercent } from "./formatters";
import type { DashboardData } from "@budget/app/(protected)/dashboard/data";

type GoalProgressChartProps = {
  data: DashboardData["savingsProgress"]["savings"];
  title: string;
  targetLabel: string;
  emptyState?: string;
  maxItems?: number;
};

type GoalEntry = DashboardData["savingsProgress"]["savings"][number];

const tooltipRenderer = ({
  payload,
  label,
}: {
  payload?: Array<{ payload: GoalEntry }>;
  label?: string | number;
}) => {
  if (!payload || payload.length === 0) return null;
  const entry = payload[0].payload;
  const variancePercent =
    entry.variance !== null && entry.target
      ? entry.variance / entry.target
      : null;
  return (
    <div className="rounded-xl border border-emerald-900/10 bg-white/95 px-4 py-2 text-sm shadow-lg dark:border-emerald-100/10 dark:bg-emerald-900/90">
      <p className="mb-1 font-semibold text-emerald-950 dark:text-emerald-50">
        {label}
      </p>
      <p className="text-emerald-900/80 dark:text-emerald-100/80">
        Actual {formatCurrency(entry.actual)}
      </p>
      {entry.target !== null ? (
        <p className="text-emerald-900/70 dark:text-emerald-100/70">
          Target {formatCurrency(entry.target)}
        </p>
      ) : null}
      {entry.variance !== null ? (
        <p className="text-xs text-emerald-900/70 dark:text-emerald-100/70">
          Variance {formatCurrency(entry.variance)}{" "}
          {variancePercent !== null
            ? `(${formatPercent(variancePercent)})`
            : ""}
        </p>
      ) : null}
      {entry.target === null ? (
        <p className="text-xs text-emerald-900/60 dark:text-emerald-100/60">
          No target set — bar scaled to largest contribution.
        </p>
      ) : null}
    </div>
  );
};

export function GoalProgressChart({
  data,
  title,
  targetLabel,
  emptyState = "No targets configured for this section.",
  maxItems = 8,
}: GoalProgressChartProps) {
  const goals = data.slice(0, maxItems);
  const maxActual = goals.reduce(
    (max, entry) => (entry.actual > max ? entry.actual : max),
    0
  );

  if (!goals.length) {
    return (
      <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-emerald-200/60 bg-emerald-50/60 text-sm text-emerald-900/70 dark:border-emerald-100/20 dark:bg-emerald-900/40 dark:text-emerald-100/70">
        {emptyState}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <h4 className="text-sm font-semibold text-emerald-950 dark:text-emerald-50">
        {title}
      </h4>
      <div className="mt-3 grow">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={goals}
            layout="vertical"
            barCategoryGap={12}
            margin={{ top: 12, right: 16, left: 8, bottom: 8 }}
          >
            <CartesianGrid
              strokeDasharray="4 4"
              stroke="rgba(15,118,110,0.18)"
              horizontal
              vertical={false}
            />
            <XAxis
              type="number"
              domain={[0, 1.4]}
              tickFormatter={(value) => formatPercent(Number(value))}
              stroke="rgba(15,118,110,0.45)"
              tick={{ fill: "rgba(15,118,110,0.7)", fontSize: 12 }}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={150}
              tick={{ fill: "rgba(15,118,110,0.85)", fontSize: 12 }}
            />
            <Tooltip content={tooltipRenderer} />
            <ReferenceLine
              x={1}
              stroke="#facc15"
              strokeDasharray="4 4"
              label={{
                value: targetLabel,
                position: "top",
                fill: "#b45309",
              }}
            />
            <Bar
              dataKey={(entry) => {
                const progress = entry.target && entry.target > 0
                  ? entry.actual / entry.target
                  : maxActual > 0
                    ? entry.actual / maxActual
                    : 0;
                return Math.min(progress, 1.4);
              }}
              radius={[4, 4, 4, 4]}
              name="Progress"
            >
              {goals.map((entry) => {
                const hasTarget = entry.target !== null && entry.target > 0;
                const progress = hasTarget
                  ? entry.actual / (entry.target ?? 1)
                  : maxActual > 0
                    ? entry.actual / maxActual
                    : 0;
                const capped = Math.min(progress, 1.4);
                const fill = hasTarget
                  ? capped >= 1
                    ? "rgba(16,185,129,0.85)"
                    : "rgba(59,130,246,0.85)"
                  : "rgba(14,165,233,0.85)";
                return (
                  <Cell
                    key={entry.categoryId}
                    fill={fill}
                    aria-label={`${entry.name} progress ${formatPercent(
                      Math.min(progress, 1)
                    )}`}
                  />
                );
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
