"use client";

import type { ReactNode } from "react";
import {
  LabelList,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  ValueType,
  NameType,
  Payload,
} from "recharts/types/component/DefaultTooltipContent";
import type { DashboardData } from "@budget/app/(protected)/dashboard/data";
import { formatPercent } from "./formatters";

type CategoryEntry = DashboardData["categoryPlanActual"]["categories"][number];

export type TopEnvelopePaceChartProps = {
  categories: CategoryEntry[];
  totalDays: number;
  currentDay: number;
  limit?: number;
};

type PaceDatum = {
  day: number;
  label: string;
  actual: number;
  ideal: number;
  actualLabel?: number | null;
  idealLabel?: number | null;
};

const colors = ["#047857", "#0f766e", "#2563eb", "#b91c1c"];

type CustomTooltipProps = {
  active?: boolean;
  payload?: Array<Payload<ValueType, NameType>>;
  label?: string | number;
};

const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
  if (!active || !payload || payload.length === 0) return null;

  const actualEntry = payload.find(
    (entry) => String(entry.dataKey) === "actual"
  );
  const idealEntry = payload.find((entry) => String(entry.dataKey) === "ideal");

  const toNumber = (val: ValueType | undefined) =>
    Array.isArray(val) ? Number(val[0] ?? 0) : Number(val ?? 0);

  const actualVal = toNumber(actualEntry?.value);
  const idealVal = toNumber(idealEntry?.value);

  return (
    <div className="rounded-xl border border-emerald-900/10 bg-white/95 px-3 py-2 text-sm shadow-lg dark:border-emerald-100/10 dark:bg-emerald-900/90">
      <p className="font-semibold text-emerald-950 dark:text-emerald-50">
        Day {String(label)}
      </p>
      {actualEntry ? (
        <p className="mt-1 text-emerald-900/75 dark:text-emerald-100/75">
          Actual {formatPercent(actualVal / 100)}
        </p>
      ) : null}
      {idealEntry ? (
        <p className="text-xs text-emerald-900/70 dark:text-emerald-100/70">
          Plan pace {formatPercent(idealVal / 100)}
        </p>
      ) : null}
    </div>
  );
};

const labelFormatter = (label: ReactNode) => {
  if (label == null) {
    return "";
  }
  if (typeof label === "number" && Number.isFinite(label)) {
    return formatPercent(label / 100);
  }
  if (typeof label === "string") {
    const parsed = Number.parseFloat(label);
    if (Number.isFinite(parsed)) {
      return formatPercent(parsed / 100);
    }
  }
  return "";
};

const buildDataset = (
  category: CategoryEntry,
  totalDays: number,
  currentDay: number
): PaceDatum[] => {
  const planned = category.planned ?? 0;
  if (planned <= 0 || totalDays <= 0 || currentDay <= 0) {
    return [
      {
        day: 0,
        label: "0",
        actual: 0,
        ideal: 0,
        actualLabel: null,
        idealLabel: null,
      },
      {
        day: totalDays,
        label: `${totalDays}`,
        actual: 0,
        ideal: 0,
        actualLabel: null,
        idealLabel: null,
      },
    ];
  }

  const actualPercent = Math.min(((category.actual ?? 0) / planned) * 100, 200);
  const idealPercentNow = Math.min((currentDay / totalDays) * 100, 200);

  return [
    {
      day: 0,
      label: "0",
      actual: 0,
      ideal: 0,
      actualLabel: null,
      idealLabel: null,
    },
    {
      day: currentDay,
      label: `${currentDay}`,
      actual: actualPercent,
      ideal: idealPercentNow,
      actualLabel: actualPercent,
      idealLabel: idealPercentNow,
    },
    {
      day: totalDays,
      label: `${totalDays}`,
      actual: actualPercent,
      ideal: 100,
      actualLabel: null,
      idealLabel: 100,
    },
  ];
};

export function TopEnvelopePaceChart({
  categories,
  totalDays,
  currentDay,
  limit = 3,
}: TopEnvelopePaceChartProps) {
  const topCategories = categories
    .filter((category) => (category.planned ?? 0) > 0)
    .sort((a, b) => (b.planned ?? 0) - (a.planned ?? 0))
    .slice(0, limit);

  if (topCategories.length === 0) {
    return (
      <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-emerald-900/20 bg-white/60 p-4 text-sm text-emerald-900/70 dark:border-emerald-100/30 dark:bg-emerald-900/40 dark:text-emerald-100/70">
        Add planned amounts to your top envelopes to track pacing.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {topCategories.map((category, index) => {
        const data = buildDataset(category, totalDays, currentDay);
        const color = colors[index % colors.length];
        const todayPercent =
          totalDays > 0 ? Math.min((currentDay / totalDays) * 100, 200) : 0;
        const actualPercent =
          (category.planned ?? 0) > 0
            ? Math.min(
                ((category.actual ?? 0) / (category.planned ?? 0)) * 100,
                200
              )
            : 0;

        const paceDelta = actualPercent - todayPercent;

        return (
          <div
            key={category.categoryId}
            className="rounded-2xl border border-emerald-900/10 bg-white/80 p-3 shadow-sm dark:border-emerald-100/15 dark:bg-emerald-900/50"
          >
            <header className="mb-3 flex flex-col gap-1 text-sm sm:flex-row sm:items-center sm:justify-between">
              <span className="font-medium text-emerald-950 dark:text-emerald-50">
                {(category.emoji ?? "") + " "}
                {category.name}
              </span>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-100">
                  {formatPercent(actualPercent / 100)} spent
                </span>
                <span className="rounded-full bg-emerald-900/10 px-2 py-1 text-emerald-900/70 dark:bg-emerald-900/40 dark:text-emerald-100/70">
                  Plan pace {formatPercent(todayPercent / 100)}
                </span>
                <span className="rounded-full bg-white/80 px-2 py-1 text-emerald-900/80 shadow-sm dark:bg-emerald-900/60 dark:text-emerald-100/80">
                  {paceDelta >= 0 ? "Ahead" : "Behind"} by{" "}
                  {formatPercent(Math.abs(paceDelta) / 100)}
                </span>
              </div>
            </header>

            <div
              className="h-40"
              role="img"
              aria-label="Line chart comparing actual envelope spend pace to an even pace over the month"
            >
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={data}
                  margin={{ top: 8, right: 12, bottom: 0, left: 0 }}
                >
                  <Legend
                    verticalAlign="top"
                    align="left"
                    wrapperStyle={{
                      fontSize: 11,
                      lineHeight: "16px",
                      color: "rgba(15,118,110,0.8)",
                      top: -5,
                    }}
                  />
                  <XAxis
                    dataKey="day"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={4}
                    tick={{ fontSize: 10, fill: "rgba(15,118,110,0.7)" }}
                  />
                  <YAxis
                    tickFormatter={(value: number) => `${Math.round(value)}%`}
                    domain={[0, 150]}
                    ticks={[0, 50, 100, 150]}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 10, fill: "rgba(15,118,110,0.7)" }}
                  />
                  <ReferenceLine
                    y={100}
                    stroke="rgba(239,68,68,0.45)"
                    strokeDasharray="4 4"
                    label={{
                      value: "Plan target",
                      position: "insideTopRight",
                      fill: "rgba(239,68,68,0.75)",
                      fontSize: 11,
                    }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="ideal"
                    name="Plan pace"
                    stroke="rgba(15,118,110,0.55)"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                    strokeDasharray="6 4"
                  >
                    <LabelList
                      dataKey="idealLabel"
                      position="top"
                      formatter={labelFormatter}
                      style={{
                        fontSize: 11,
                        fill: "rgba(15,118,110,0.75)",
                      }}
                    />
                  </Line>
                  <Line
                    type="monotone"
                    dataKey="actual"
                    name="Actual pace"
                    stroke={color}
                    strokeWidth={3}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                  >
                    <LabelList
                      dataKey="actualLabel"
                      position="top"
                      formatter={labelFormatter}
                      style={{
                        fontSize: 11,
                        fill: color,
                        fontWeight: 600,
                      }}
                    />
                  </Line>
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        );
      })}
    </div>
  );
}
