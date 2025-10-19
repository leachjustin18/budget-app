"use client";

import {
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  Legend,
  type PieLabelRenderProps,
  Cell,
} from "recharts";
import { formatCurrency, formatPercent } from "./formatters";
import type { DashboardData } from "@budget/app/(protected)/dashboard/data";

type CategorySharePieProps = {
  data: DashboardData["categoryShare"]["items"];
  onCategorySelect?: (categoryId: string) => void;
};

const COLORS = [
  "#10b981",
  "#3b82f6",
  "#f97316",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
  "#fbbf24",
  "#22d3ee",
  "#a855f7",
  "#facc15",
  "#0ea5e9",
  "#ef4444",
];

const renderCustomizedLabel = ({
  cx,
  percent,
  fill,
  x,
  y,
}: PieLabelRenderProps) => {
  const cxV = Number(cx) || 0;
  const xV = Number(x) || 0;

  return (
    <text
      x={x}
      y={y}
      fill={fill}
      dominantBaseline="central"
      textAnchor={xV > cxV || 0 ? "start" : "end"}
    >
      {/* @ts-expect-error type unknown https://github.com/recharts/recharts/issues/6380 */}
      {`${((percent ?? 1) * 100).toFixed(0)}%`}
    </text>
  );
};

const tooltipRenderer = ({
  payload,
}: {
  payload?: Array<{
    name?: string;
    value?: number;
    payload?: {
      actual: number;
      share: number;
      planned: number | null;
    };
  }>;
}) => {
  if (!payload || payload.length === 0) return null;
  const item = payload[0];
  if (!item.payload) return null;
  const { actual, share, planned } = item.payload;
  return (
    <div className="rounded-xl border border-emerald-900/10 bg-white/95 px-4 py-2 text-sm shadow-lg dark:border-emerald-100/10 dark:bg-emerald-900/90">
      <p className="font-semibold text-emerald-950 dark:text-emerald-50">
        {item.name}
      </p>
      <p className="text-emerald-900/80 dark:text-emerald-100/80">
        {formatCurrency(actual)} · {formatPercent(share)}
      </p>
      {planned !== null ? (
        <p className="text-xs text-emerald-900/60 dark:text-emerald-100/60">
          Planned {formatCurrency(planned)}
        </p>
      ) : null}
    </div>
  );
};

export function CategorySharePie({ data }: CategorySharePieProps) {
  const items = data.filter((entry) => entry.actual > 0);
  if (!items.length) {
    return (
      <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-emerald-200/60 bg-emerald-50/60 text-sm text-emerald-900/70 dark:border-emerald-100/20 dark:bg-emerald-900/40 dark:text-emerald-100/70">
        No spending recorded for this month yet.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Tooltip content={tooltipRenderer} />
        <Legend verticalAlign="bottom" height={48} className="p-5" />
        <Pie
          data={items}
          label={renderCustomizedLabel}
          fill="#8884d8"
          dataKey="actual"
          isAnimationActive
          nameKey="name"
        >
          {data.map((entry, index) => (
            <Cell
              key={`cell-${entry.name}`}
              fill={COLORS[index % COLORS.length]}
            />
          ))}
        </Pie>
      </PieChart>
    </ResponsiveContainer>
  );
}
