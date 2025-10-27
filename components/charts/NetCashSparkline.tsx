"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TooltipProps } from "recharts";
import type { ValueType, NameType } from "recharts/types/component/DefaultTooltipContent";
import type { DashboardData } from "@budget/app/(protected)/dashboard/data";
import { formatCurrency } from "./formatters";

type NetCashSparklineProps = {
  series: DashboardData["monthlySeries"];
  monthKeys: string[];
  activeMonth?: string | null;
};

type SparklineDatum = {
  monthKey: string;
  label: string;
  net: number;
  income: number;
  expense: number;
};

const CustomTooltip = ({
  active,
  payload,
  label,
}: TooltipProps<ValueType, NameType>) => {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const datum = payload[0]?.payload as SparklineDatum | undefined;
  if (!datum) return null;

  return (
    <div className="rounded-xl border border-emerald-900/10 bg-white/95 px-3 py-2 text-sm shadow-lg dark:border-emerald-100/10 dark:bg-emerald-900/90">
      <p className="font-semibold text-emerald-950 dark:text-emerald-50">
        {label}
      </p>
      <p className="mt-1 text-emerald-900/75 dark:text-emerald-100/75">
        Net {formatCurrency(datum.net)}
      </p>
      <p className="text-xs text-emerald-900/70 dark:text-emerald-100/70">
        Income {formatCurrency(datum.income)} • Spend {formatCurrency(datum.expense)}
      </p>
    </div>
  );
};

export function NetCashSparkline({
  series,
  monthKeys,
  activeMonth,
}: NetCashSparklineProps) {
  const data: SparklineDatum[] = series
    .filter((item) => monthKeys.includes(item.monthKey))
    .map((item) => ({
      monthKey: item.monthKey,
      label: item.label,
      net: item.actualIncome - item.actualExpense,
      income: item.actualIncome,
      expense: item.actualExpense,
    }));

  const maxAbsNet = data.reduce(
    (max, item) => Math.max(max, Math.abs(item.net)),
    0
  );

  const activeLabel = activeMonth
    ? data.find((item) => item.monthKey === activeMonth)?.label
    : undefined;

  return (
    <div className="flex h-full flex-col justify-between">
      <div>
        <p className="text-xs uppercase tracking-wide text-emerald-900/60 dark:text-emerald-100/70">
          Net cash trend
        </p>
        <h3 className="mt-1 text-lg font-semibold text-emerald-950 dark:text-emerald-50">
          {activeLabel ?? "Trailing window"}
        </h3>
        <p className="mt-1 text-xs text-emerald-900/70 dark:text-emerald-100/70">
          Positive months add buffer; negative months eat into reserves.
        </p>
      </div>

      <div className="mt-4 h-48 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ top: 10, right: 12, bottom: 0, left: 0 }}
          >
            <defs>
              <linearGradient id="netGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.05} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="4 4" stroke="rgba(15,118,110,0.15)" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: "rgba(15,118,110,0.75)" }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickFormatter={(value: number) => formatCurrency(Number(value))}
              tick={{ fontSize: 11, fill: "rgba(15,118,110,0.75)" }}
              domain={[-maxAbsNet * 1.1, maxAbsNet * 1.1]}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="net"
              stroke="#0f766e"
              strokeWidth={2}
              fill="url(#netGradient)"
              activeDot={{ r: 5 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

