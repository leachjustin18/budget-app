"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TooltipProps } from "recharts";
import type { ValueType, NameType } from "recharts/types/component/DefaultTooltipContent";
import type { DashboardData } from "@budget/app/(protected)/dashboard/data";
import { formatCurrency, formatPercent } from "./formatters";

type CategoryDatum = {
  name: string;
  actual: number;
  planned: number;
  variance: number;
  percentOfSpend: number;
};

type CategoryPacingBarsProps = {
  categories: DashboardData["categoryPlanActual"]["categories"];
  totalActual: number;
  limit?: number;
};

const CustomTooltip = ({
  active,
  payload,
  label,
}: TooltipProps<ValueType, NameType>) => {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const datum = payload[0]?.payload as CategoryDatum | undefined;
  if (!datum) return null;

  return (
    <div className="rounded-xl border border-emerald-900/10 bg-white/95 px-3 py-2 text-sm shadow-lg dark:border-emerald-100/10 dark:bg-emerald-900/90">
      <p className="font-semibold text-emerald-950 dark:text-emerald-50">
        {label}
      </p>
      <p className="mt-1 text-emerald-900/75 dark:text-emerald-100/75">
        {formatCurrency(datum.actual)} spent
      </p>
      {datum.planned > 0 ? (
        <p className="text-xs text-emerald-900/70 dark:text-emerald-100/70">
          Plan {formatCurrency(datum.planned)} •{" "}
          {formatCurrency(Math.abs(datum.variance))}{" "}
          {datum.variance >= 0 ? "under" : "over"}
        </p>
      ) : (
        <p className="text-xs text-emerald-900/70 dark:text-emerald-100/70">
          No plan set
        </p>
      )}
    </div>
  );
};

export function CategoryPacingBars({
  categories,
  totalActual,
  limit = 6,
}: CategoryPacingBarsProps) {
  const usableCategories = categories
    .filter((category) => category.actual > 0 || (category.planned ?? 0) > 0)
    .sort((a, b) => b.actual - a.actual)
    .slice(0, limit);

  const data: CategoryDatum[] = usableCategories.map((category) => {
    const plannedValue = category.planned ?? 0;
    const variance = plannedValue - category.actual;
    const percentOfSpend =
      totalActual > 0 ? Math.max(0, category.actual) / totalActual : 0;

    return {
      name: `${category.emoji} ${category.name}`,
      actual: category.actual,
      planned: plannedValue,
      variance,
      percentOfSpend,
    };
  });

  return (
    <div className="flex h-full flex-col gap-4">
      <header>
        <p className="text-xs uppercase tracking-wide text-emerald-900/60 dark:text-emerald-100/70">
          Biggest envelopes
        </p>
        <h3 className="mt-1 text-lg font-semibold text-emerald-950 dark:text-emerald-50">
          {limit} largest plans
        </h3>
        <p className="mt-1 text-xs text-emerald-900/70 dark:text-emerald-100/70">
          Bars show actual spend. Outline marks the plan.
        </p>
      </header>

      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            layout="vertical"
            data={data}
            margin={{ top: 8, right: 12, left: 12, bottom: 8 }}
          >
            <CartesianGrid strokeDasharray="4 4" stroke="rgba(15,118,110,0.12)" />
            <XAxis
              type="number"
              tickFormatter={(value: number) => formatCurrency(Number(value))}
              tick={{ fontSize: 11, fill: "rgba(15,118,110,0.75)" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={140}
              tick={{ fontSize: 12, fill: "rgba(15,118,110,0.9)" }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar
              dataKey="planned"
              fill="transparent"
              stroke="rgba(14,116,144,0.55)"
              strokeWidth={2}
              radius={[12, 12, 12, 12]}
            />
            <Bar
              dataKey="actual"
              fill="rgba(16,185,129,0.75)"
              radius={[12, 12, 12, 12]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <footer className="text-xs text-emerald-900/65 dark:text-emerald-100/65">
        {data.map((datum) => (
          <div
            key={datum.name}
            className="flex items-center justify-between border-t border-emerald-900/10 py-1 first:border-t-0 dark:border-emerald-100/20"
          >
            <span>{datum.name}</span>
            <span>
              {formatPercent(datum.percentOfSpend)} of spend
            </span>
          </div>
        ))}
      </footer>
    </div>
  );
}

