"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { LabelProps } from "recharts";
import type {
  ValueType,
  NameType,
  Payload,
} from "recharts/types/component/DefaultTooltipContent";
import type { DashboardData } from "@budget/app/(protected)/dashboard/data";
import { formatCurrency, formatPercent } from "./formatters";
import { toNumber as toNumberHelper } from "@budget/lib/helpers";

type CategoryEntry = DashboardData["categoryPlanActual"]["categories"][number];

type EnvelopePlanStackedBarsProps = {
  categories: CategoryEntry[];
  limit?: number;
};

type ChartDatum = {
  categoryId: string;
  label: string;
  planned: number;
  spentWithinPlan: number;
  remaining: number;
  remainingNegative: number;
  overspent: number;
};

type CustomTooltipProps = {
  active?: boolean;
  payload?: Array<Payload<ValueType, NameType>>;
  label?: string | number;
};

const renderCustomizedLabel = (props: LabelProps) => {
  const { x, y, width, value } = props;

  if (x == null || y == null || width == null) {
    return null;
  }
  const radius = 13;

  return (
    <g>
      <text
        x={Number(x) + Number(width) / 2}
        y={Number(y) + radius}
        fill="#4c4a47ff"
        textAnchor="middle"
        dominantBaseline="middle"
      >
        {formatCurrency(toNumberHelper(value))}
      </text>
    </g>
  );
};

const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
  if (!active || !payload || payload.length === 0) return null;

  const spentEntry = payload.find(
    (entry) => entry.dataKey === "spentWithinPlan"
  );
  const remainingEntry = payload.find(
    (entry) => entry.dataKey === "remainingNegative"
  );
  const overspentEntry = payload.find((entry) => entry.dataKey === "overspent");

  const toNumber = (val: ValueType | undefined) =>
    Array.isArray(val) ? Number(val[0] ?? 0) : Number(val ?? 0);

  const spentValue = toNumber(spentEntry?.value);
  const remainingValue = Math.abs(toNumber(remainingEntry?.value));
  const overspentValue = toNumber(overspentEntry?.value);
  const source =
    payload[0]?.payload && typeof payload[0]?.payload === "object"
      ? (payload[0]?.payload as ChartDatum)
      : null;
  const plannedValue = source?.planned ?? spentValue + remainingValue;

  return (
    <div className="rounded-xl border border-emerald-900/10 bg-white/95 px-3 py-2 text-sm shadow-lg dark:border-emerald-100/10 dark:bg-emerald-900/90">
      <p className="font-semibold text-emerald-950 dark:text-emerald-50">
        {label}
      </p>
      <ul className="mt-1 space-y-1 text-xs text-emerald-900/75 dark:text-emerald-100/75">
        <li>Planned: {formatCurrency(plannedValue)}</li>
        <li>Spent: {formatCurrency(spentValue + overspentValue)}</li>
        <li>Left to spend: {formatCurrency(plannedValue - spentValue)}</li>
        <li>Overspent: {formatCurrency(overspentValue)}</li>
      </ul>
    </div>
  );
};

export function EnvelopePlanStackedBars({
  categories,
  limit = 6,
}: EnvelopePlanStackedBarsProps) {
  const expenseCategories = categories.filter(
    (category) => category.section === "expenses"
  );

  const topCategories = expenseCategories
    .filter((category) => (category.planned ?? 0) > 0)
    .sort((a, b) => (b.planned ?? 0) - (a.planned ?? 0))
    .slice(0, limit);

  const data: ChartDatum[] = topCategories.map((category) => {
    const planned = Math.max(0, category.planned ?? 0);
    const spent = Math.max(0, category.actual);
    const spentWithinPlan = Math.min(planned, spent);
    const remaining = Math.max(0, planned - spentWithinPlan);
    const overspent = Math.max(0, spent - planned);

    return {
      categoryId: category.categoryId,
      label: `${category.emoji ?? ""} ${category.name}`,
      planned,
      spentWithinPlan,
      remaining,
      remainingNegative: remaining > 0 ? -remaining : 0,
      overspent,
    };
  });

  if (data.length === 0) {
    return (
      <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-emerald-900/20 bg-white/60 p-4 text-sm text-emerald-900/70 dark:border-emerald-100/30 dark:bg-emerald-900/40 dark:text-emerald-100/70">
        Add planned amounts to envelopes to compare spending progress.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div
        className="h-[360px]"
        role="img"
        aria-label="Stacked bar chart showing planned, spent, remaining, and overspent amounts for the largest envelopes"
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            stackOffset="sign"
            margin={{ top: 16, right: 32, bottom: 16, left: 24 }}
            barCategoryGap="40%"
          >
            <CartesianGrid
              strokeDasharray="4 4"
              stroke="rgba(15,118,110,0.12)"
            />
            <XAxis
              type="number"
              tickFormatter={(value: number) =>
                formatCurrency(Math.abs(Number(value)))
              }
              tick={{ fontSize: 11, fill: "rgba(15,118,110,0.75)" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="label"
              width={260}
              tick={{ fontSize: 12, fill: "rgba(15,118,110,0.9)" }}
              axisLine={false}
              tickLine={false}
            />
            <Legend
              verticalAlign="top"
              align="left"
              wrapperStyle={{
                fontSize: 11,
                color: "rgba(15,118,110,0.8)",
                lineHeight: "16px",
              }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar
              dataKey="planned"
              name="Planned"
              fill="rgba(0, 200, 255, 0.65)"
              barSize={26}
              radius={[0, 12, 12, 0]}
            >
              <LabelList dataKey="planned" content={renderCustomizedLabel} />
            </Bar>
            <Bar
              dataKey="remaining"
              name="Remaining"
              fill="rgba(34,197,94,0.6)"
              barSize={26}
              radius={[0, 12, 12, 0]}
            >
              <LabelList dataKey="remaining" content={renderCustomizedLabel} />
            </Bar>

            <Bar
              dataKey="spentWithinPlan"
              name="Spent"
              fill="rgba(239,68,68,0.65)"
              barSize={26}
              radius={[0, 12, 12, 0]}
            >
              <LabelList
                dataKey="spentWithinPlan"
                content={renderCustomizedLabel}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <ul className="space-y-2 text-sm text-emerald-900/80 dark:text-emerald-100/80">
        {data.map((datum) => {
          const totalActual = datum.spentWithinPlan + datum.overspent;
          const plannedValue = datum.planned;
          const remaining = datum.remaining;
          const overspentPercent =
            plannedValue > 0 ? datum.overspent / plannedValue : 0;

          return (
            <li
              key={datum.categoryId}
              className="rounded-2xl border border-emerald-900/10 bg-white/75 px-3 py-2 shadow-sm dark:border-emerald-100/20 dark:bg-emerald-900/40"
            >
              <p className="font-medium text-emerald-950 dark:text-emerald-50">
                {datum.label}
              </p>
              <p>
                Planned {formatCurrency(plannedValue)} • Spent{" "}
                {formatCurrency(totalActual)} • Remaining{" "}
                {formatCurrency(remaining)}
              </p>
              {datum.overspent > 0 ? (
                <p className="text-xs text-rose-600 dark:text-rose-200">
                  Overspent by {formatCurrency(datum.overspent)} (
                  {formatPercent(overspentPercent)})
                </p>
              ) : (
                <p className="text-xs text-emerald-700 dark:text-emerald-200">
                  On track with {formatCurrency(remaining)} available.
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
