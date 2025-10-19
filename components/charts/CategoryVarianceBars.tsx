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

type CategoryVarianceBarsProps = {
  data: DashboardData["categoryPlanActual"]["categories"];
  threshold: number;
  maxItems?: number;
  ariaLabel?: string;
};

const tooltipContent = ({
  payload,
  label,
}: {
  payload?: Array<{ dataKey?: string; value?: number }>;
  label?: string | number;
}) => {
  if (!payload || payload.length === 0) return null;
  const planned = payload.find((entry) => entry.dataKey === "planned")?.value;
  const actual = payload.find((entry) => entry.dataKey === "actual")?.value;
  const variance =
    typeof planned === "number" && typeof actual === "number"
      ? actual - planned
      : undefined;
  return (
    <div className="rounded-xl border border-emerald-900/10 bg-white/95 px-4 py-2 text-sm shadow-lg dark:border-emerald-100/10 dark:bg-emerald-900/90">
      <p className="mb-1 font-semibold text-emerald-950 dark:text-emerald-50">
        {label}
      </p>
      <div className="space-y-1 text-emerald-900/80 dark:text-emerald-100/80">
        <p>
          <span className="font-medium">Actual: </span>
          {formatCurrency(Number(actual ?? 0))}
        </p>
        <p>
          <span className="font-medium">Planned: </span>
          {typeof planned === "number" ? formatCurrency(planned) : "Not set"}
        </p>
        {typeof variance === "number" ? (
          <p>
            <span className="font-medium">Variance: </span>
            {formatCurrency(variance)}
          </p>
        ) : null}
      </div>
    </div>
  );
};

export function CategoryVarianceBars({
  data,
  threshold,
  maxItems = 12,
  ariaLabel,
}: CategoryVarianceBarsProps) {
  const categories = data.slice(0, maxItems);

  return (
    <ResponsiveContainer width="100%" height="100%" aria-label={ariaLabel}>
      <BarChart
        data={categories}
        layout="vertical"
        margin={{ top: 12, right: 24, left: 12, bottom: 12 }}
        barGap={6}
      >
        <CartesianGrid
          strokeDasharray="4 4"
          stroke="rgba(15,118,110,0.18)"
          horizontal
          vertical={false}
        />
        <XAxis
          type="number"
          tickFormatter={(value) => formatCurrency(Number(value))}
          stroke="rgba(15,118,110,0.55)"
          tick={{ fill: "rgba(15,118,110,0.7)", fontSize: 12 }}
        />
        <YAxis
          type="category"
          dataKey="name"
          width={160}
          tick={{ fill: "rgba(15,118,110,0.85)", fontSize: 12 }}
        />
        <Tooltip content={tooltipContent} />
        <ReferenceLine
          x={0}
          stroke="rgba(15,118,110,0.35)"
          strokeDasharray="3 3"
        />
        <Bar
          dataKey="planned"
          fill="#a7f3d0"
          name="Planned"
          radius={[0, 0, 0, 0]}
          maxBarSize={18}
        />
        <Bar
          dataKey="actual"
          fill="#0f766e"
          name="Actual"
          radius={[4, 4, 4, 4]}
          maxBarSize={18}
        >
          {categories.map((entry) => {
            const variance =
              entry.planned !== null
                ? entry.actual - entry.planned
                : entry.actual;
            const percent =
              entry.variancePercent ??
              (entry.planned ? variance / entry.planned : 0);
            const flagged = Math.abs(percent ?? 0) >= threshold;
            const fill = flagged
              ? percent > 0
                ? "#ef4444"
                : "#10b981"
              : "#0f766e";
            return (
              <Cell
                key={entry.categoryId}
                cursor="pointer"
                fill={fill}
                aria-label={`${entry.name} actual ${formatCurrency(
                  entry.actual
                )} (${formatPercent(percent ?? 0)})`}
              />
            );
          })}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
