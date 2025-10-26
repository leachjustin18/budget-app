"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  LabelList,
  type LabelProps,
} from "recharts";
import { formatCurrency } from "./formatters";
import type { DashboardData } from "@budget/app/(protected)/dashboard/data";

type BudgetActualComparisonChartProps = {
  data: DashboardData["monthlySeries"];
  months: string[];
};

const renderCustomizedLabel = ({ x, y, width, value, fill }: LabelProps) => {
  if (x == null || y == null || width == null) {
    return null;
  }
  const radius = 10;

  return (
    <g>
      <text
        x={Number(x) + Number(width) / 2}
        y={Number(y) - radius}
        fill={fill}
        textAnchor="middle"
        dominantBaseline="middle"
        style={{ fontSize: "1vw" }}
      >
        {formatCurrency(Number(value ?? 0))}
      </text>
    </g>
  );
};

const tooltipRenderer = ({
  payload,
  label,
}: {
  payload?: Array<{ name?: string; value?: number }>;
  label?: string | number;
}) => {
  if (!payload || payload.length === 0) return null;
  return (
    <div className="rounded-xl border border-emerald-900/10 bg-white/95 px-4 py-2 text-sm shadow-lg dark:border-emerald-100/10 dark:bg-emerald-900/90">
      <p className="mb-1 font-semibold text-emerald-950 dark:text-emerald-50">
        {label}
      </p>
      <ul className="space-y-1 text-emerald-900/80 dark:text-emerald-100/80">
        {payload.map((entry) => (
          <li key={entry.name} className="flex justify-between gap-6">
            <span>{entry.name}</span>
            <span className="font-medium">
              {formatCurrency(Number(entry.value ?? 0))}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export function BudgetActualComparisonChart({
  data,
  months,
}: BudgetActualComparisonChartProps) {
  const series = data
    .filter((month) => months.includes(month.monthKey))
    .map((month) => ({
      label: month.label,
      plannedIncome: month.plannedIncome ?? 0,
      actualIncome: month.actualIncome,
      plannedExpense: month.plannedExpense ?? 0,
      actualExpense: month.actualExpense,
      netActual: month.actualNet,
      netPlanned: month.plannedNet ?? null,
    }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={series}
        margin={{ top: 16, right: 24, left: 12, bottom: 8 }}
        barCategoryGap={24}
      >
        <CartesianGrid
          strokeDasharray="4 4"
          stroke="rgba(15,118,110,0.18)"
          vertical={false}
        />

        <XAxis
          dataKey="label"
          stroke="rgba(15,118,110,0.55)"
          tick={{ fill: "rgba(15,118,110,0.75)", fontSize: 12 }}
        />
        <YAxis
          stroke="rgba(15,118,110,0.55)"
          tick={{ fill: "rgba(15,118,110,0.75)", fontSize: 12 }}
          tickFormatter={(value) => formatCurrency(Number(value))}
        />
        <Tooltip content={tooltipRenderer} />
        <Legend />
        <ReferenceLine
          y={0}
          stroke="rgba(15,118,110,0.3)"
          strokeDasharray="3 3"
        />
        <Bar
          dataKey="plannedExpense"
          name="Planned expense"
          fill="rgba(248, 191, 100, 0.8)"
          radius={[6, 6, 0, 0]}
        >
          <LabelList
            dataKey="plannedExpense"
            content={renderCustomizedLabel}
            position="top"
            fill="rgba(248, 191, 100, 0.8)"
          />
        </Bar>
        <Bar
          dataKey="actualExpense"
          name="Actual expense"
          fill="rgba(239, 68, 68, 0.85)"
          radius={[6, 6, 0, 0]}
          isAnimationActive
        >
          <LabelList
            dataKey="actualExpense"
            content={renderCustomizedLabel}
            position="top"
            fill="rgba(239, 68, 68, 0.85)"
          />
        </Bar>
        <Bar
          dataKey="plannedIncome"
          name="Planned income"
          fill="rgba(45, 212, 191, 0.65)"
          radius={[6, 6, 0, 0]}
          isAnimationActive
        >
          <LabelList
            dataKey="plannedIncome"
            content={renderCustomizedLabel}
            position="top"
            fill="rgba(45, 212, 191, 0.65)"
          />
        </Bar>
        <Bar
          dataKey="actualIncome"
          name="Actual income"
          fill="rgba(20, 184, 166, 0.9)"
          radius={[6, 6, 0, 0]}
          isAnimationActive
        >
          <LabelList
            dataKey="actualIncome"
            content={renderCustomizedLabel}
            position="top"
            fill="rgba(20, 184, 166, 0.9)"
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
