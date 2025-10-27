"use client";

import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCurrency } from "./formatters";
import type { DashboardData } from "@budget/app/(protected)/dashboard/data";

type CashFlowForecastChartProps = {
  data: DashboardData["forecast"]["months"];
  baseline: number;
  onMonthSelect?: (monthKey: string) => void;
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
          <li key={entry.name} className="flex justify-between">
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

export function CashFlowForecastChart({
  data,
  baseline,
  onMonthSelect,
}: CashFlowForecastChartProps) {
  const series = data.map((month) => ({
    ...month,
    expense: month.plannedExpense ?? month.actualExpense,
    income: month.plannedIncome ?? month.actualIncome,
    net: month.netPlanned ?? month.netActual,
  }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart
        data={series}
        margin={{ top: 16, right: 24, left: 12, bottom: 8 }}
        onClick={(state) => {
          if (
            typeof state.activeTooltipIndex === "number" &&
            series[state.activeTooltipIndex]
          ) {
            onMonthSelect?.(series[state.activeTooltipIndex].monthKey);
          }
        }}
      >
        <CartesianGrid strokeDasharray="4 4" stroke="rgba(15,118,110,0.18)" />
        <XAxis
          dataKey="label"
          stroke="rgba(15,118,110,0.55)"
          tick={{ fill: "rgba(15,118,110,0.7)", fontSize: 12 }}
        />
        <YAxis
          stroke="rgba(15,118,110,0.55)"
          tick={{ fill: "rgba(15,118,110,0.7)", fontSize: 12 }}
          tickFormatter={(value) => formatCurrency(Number(value))}
        />
        <Tooltip content={tooltipRenderer} />
        <Legend />
        <ReferenceLine
          y={baseline}
          stroke="#a855f7"
          strokeDasharray="5 4"
          label={{
            value: `Baseline ${formatCurrency(baseline)}`,
            position: "insideTopLeft",
            offset: 10,
            fill: "rgba(88,28,135,0.8)",
          }}
        />
        <Bar
          dataKey="expense"
          name="Projected expenses"
          radius={[6, 6, 0, 0]}
          isAnimationActive
        >
          {series.map((month) => {
            const isFuture = month.isFuture;
            const atRisk = month.atRisk;
            const fill = atRisk
              ? "rgba(248,113,113,0.9)"
              : isFuture
              ? "rgba(45,212,191,0.7)"
              : "rgba(16,185,129,0.85)";
            return <Cell key={month.monthKey} cursor="pointer" fill={fill} />;
          })}
        </Bar>
        <Line
          type="monotone"
          dataKey="income"
          name="Projected income"
          stroke="#0ea5e9"
          strokeWidth={2}
          dot={{ r: 3 }}
          activeDot={{ r: 5 }}
          isAnimationActive
        />
        <Line
          type="monotone"
          dataKey="net"
          name="Projected net"
          stroke="#1d4ed8"
          strokeDasharray="4 4"
          strokeWidth={2}
          dot={{ r: 3 }}
          isAnimationActive
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
