"use client";

import {
  CartesianGrid,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { formatCurrency, formatPercent } from "./formatters";
import type { DashboardData } from "@budget/app/(protected)/dashboard/data";

type CategoryTrendHeatmapProps = {
  data: DashboardData["categoryTrends"]["categories"];
  months: string[];
  stdThreshold: number;
  percentThreshold: number;
};

type HeatmapPoint = {
  x: string;
  y: string;
  change: number | null;
  percentChange: number | null;
  actual: number;
  flagged: boolean;
};

const monthLabelFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  year: "numeric",
});

const labelFromMonthKey = (monthKey: string) => {
  const [yearStr, monthStr] = monthKey.split("-");
  const year = Number.parseInt(yearStr, 10);
  const monthIndex = Number.parseInt(monthStr, 10) - 1;
  if (Number.isNaN(year) || Number.isNaN(monthIndex)) {
    return monthKey;
  }
  return monthLabelFormatter.format(new Date(year, monthIndex, 1));
};

const buildColor = (
  change: number | null,
  percent: number | null,
  flagged: boolean
) => {
  if (change === null) {
    return "rgba(148, 163, 184, 0.25)";
  }
  const direction = change >= 0 ? 1 : -1;
  const magnitude =
    Math.min(1, Math.max(0, Math.abs(percent ?? 0) * 2)) * (flagged ? 1 : 0.65);
  const base = direction > 0 ? [16, 185, 129] : [239, 68, 68];
  const alpha = 0.25 + magnitude * 0.55;
  return `rgba(${base[0]}, ${base[1]}, ${base[2]}, ${alpha.toFixed(2)})`;
};

const CustomSquare = ({
  cx,
  cy,
  payload,
}: {
  cx?: number;
  cy?: number;
  payload?: HeatmapPoint;
}) => {
  if (!payload || cx === undefined || cy === undefined) return null;
  const size = 22;
  const corner = 6;
  const fill = buildColor(
    payload.change,
    payload.percentChange,
    payload.flagged
  );
  return (
    <rect
      x={cx - size / 2}
      y={cy - size / 2}
      width={size}
      height={size}
      rx={corner}
      ry={corner}
      fill={fill}
      stroke="rgba(15,118,110,0.16)"
      strokeWidth={payload.flagged ? 1 : 0.5}
    />
  );
};

const tooltipRenderer = ({
  payload,
}: {
  payload?: Array<{ payload: HeatmapPoint }>;
}) => {
  if (!payload || payload.length === 0) return null;
  const point = payload[0].payload;
  return (
    <div className="rounded-xl border border-emerald-900/10 bg-white/95 px-4 py-2 text-sm shadow-lg dark:border-emerald-100/10 dark:bg-emerald-900/90">
      <p className="font-semibold text-emerald-950 dark:text-emerald-50">
        {point.y} · {point.x}
      </p>
      <p className="text-emerald-900/80 dark:text-emerald-100/80">
        Actual {formatCurrency(point.actual)}
      </p>
      {point.change !== null ? (
        <p className="text-emerald-900/70 dark:text-emerald-100/70">
          Δ {formatCurrency(point.change)}{" "}
          {point.percentChange !== null
            ? `(${formatPercent(point.percentChange)})`
            : ""}
        </p>
      ) : (
        <p className="text-emerald-900/70 dark:text-emerald-100/70">
          No prior month data
        </p>
      )}
      {point.flagged ? (
        <p className="text-xs font-medium text-amber-600 dark:text-amber-300">
          Notable change detected
        </p>
      ) : null}
    </div>
  );
};

export function CategoryTrendHeatmap({
  data,
  months,
  stdThreshold,
  percentThreshold,
}: CategoryTrendHeatmapProps) {
  const heatmapData = data.map((category) => {
    const points: HeatmapPoint[] = months.map((monthKey) => {
      const entry = category.points.find(
        (point) => point.monthKey === monthKey
      );
      const label = entry?.label ?? labelFromMonthKey(monthKey);
      if (!entry) {
        return {
          x: label,
          y: category.name,
          change: null,
          percentChange: null,
          actual: 0,
          flagged: false,
        };
      }
      const flagged =
        (entry.zScore !== null && Math.abs(entry.zScore) >= stdThreshold) ||
        (entry.percentChange !== null &&
          Math.abs(entry.percentChange) >= percentThreshold);
      return {
        x: label,
        y: category.name,
        change: entry.change,
        percentChange: entry.percentChange,
        actual: entry.actual,
        flagged,
      };
    });
    return {
      categoryId: category.categoryId,
      name: category.name,
      points,
    };
  });

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ScatterChart margin={{ top: 12, right: 20, bottom: 32, left: 140 }}>
        <CartesianGrid strokeDasharray="4 4" stroke="rgba(15,118,110,0.18)" />
        <XAxis
          type="category"
          dataKey="x"
          stroke="rgba(15,118,110,0.55)"
          tick={{ fill: "rgba(15,118,110,0.75)", fontSize: 12 }}
        />
        <YAxis
          type="category"
          dataKey="y"
          stroke="rgba(15,118,110,0.55)"
          tick={{ fill: "rgba(15,118,110,0.85)", fontSize: 12 }}
          width={140}
        />
        <ZAxis type="number" range={[0, 1]} dataKey="flagged" />
        <Tooltip
          cursor={{ fill: "rgba(16, 185, 129, 0.08)" }}
          content={tooltipRenderer}
        />
        {heatmapData.map((category) => (
          <Scatter
            key={category.categoryId}
            data={category.points}
            shape={<CustomSquare />}
            name={category.name}
          />
        ))}
      </ScatterChart>
    </ResponsiveContainer>
  );
}
