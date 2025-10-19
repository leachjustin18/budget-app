"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCurrency, formatPercent, formatDateLabel } from "./formatters";
import type { DashboardData } from "@budget/app/(protected)/dashboard/data";

type BurnDownLineChartProps = {
  data: DashboardData["burnDown"];
};

const tooltipRenderer = ({
  payload,
  label,
}: {
  payload?: Array<{ name?: string; value?: number; payload?: unknown }>;
  label?: string | number;
}) => {
  if (!payload || payload.length === 0) return null;
  const point = payload[0]?.payload as
    | DashboardData["burnDown"]["points"][number]
    | undefined;
  const dateLabel = typeof label === "string" ? formatDateLabel(label) : label;
  return (
    <div className="rounded-xl border border-emerald-900/10 bg-white/95 px-4 py-2 text-sm shadow-lg dark:border-emerald-100/10 dark:bg-emerald-900/90">
      <p className="mb-1 font-semibold text-emerald-950 dark:text-emerald-50">
        {dateLabel}
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
      {point?.variance !== null ? (
        <p className="mt-1 text-xs text-emerald-900/70 dark:text-emerald-100/70">
          Variance {formatCurrency(point?.variance || 0)}{" "}
          {point?.variancePercent !== null
            ? `(${formatPercent(point?.variance || 0)})`
            : ""}
        </p>
      ) : null}
    </div>
  );
};

export function BurnDownLineChart({ data }: BurnDownLineChartProps) {
  const points = data.points.map((point) => ({
    ...point,
    label: point.date,
    target: point.cumulativeTarget,
  }));

  return (
    <ResponsiveContainer width="100%" height="100%" minHeight="100%">
      <LineChart
        data={points}
        margin={{ top: 12, right: 24, left: 12, bottom: 12 }}
      >
        <CartesianGrid strokeDasharray="4 4" stroke="rgba(15,118,110,0.18)" />
        <XAxis
          dataKey="label"
          tickFormatter={(value) => formatDateLabel(String(value))}
          stroke="rgba(15,118,110,0.55)"
          tick={{ fill: "rgba(15,118,110,0.7)", fontSize: 11 }}
        />
        <YAxis
          stroke="rgba(15,118,110,0.55)"
          tick={{ fill: "rgba(15,118,110,0.7)", fontSize: 12 }}
          tickFormatter={(value) => formatCurrency(Number(value))}
        />
        <Tooltip content={tooltipRenderer} />
        <Legend />
        <Line
          type="monotone"
          dataKey="cumulativeActual"
          name="Cumulative spend"
          stroke="#ef4444"
          strokeWidth={2}
          dot={{ r: 2 }}
          activeDot={{ r: 4 }}
        />
        <Line
          type="monotone"
          dataKey="target"
          name="Target pace"
          stroke="#0ea5e9"
          strokeDasharray="5 4"
          strokeWidth={2}
          dot={false}
        />
        {points
          .filter((point) => point.isToday)
          .map((point) => (
            <ReferenceLine
              key={point.date}
              x={point.label}
              stroke="#facc15"
              strokeDasharray="2 2"
              label={{
                value: "Today",
                position: "top",
                fill: "#ca8a04",
              }}
            />
          ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
