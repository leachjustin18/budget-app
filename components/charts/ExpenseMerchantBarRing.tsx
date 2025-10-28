"use client";

import { useMemo } from "react";
import { Pie, PieChart, ResponsiveContainer } from "recharts";
import type { PieLabelRenderProps } from "recharts";
import type { DashboardData } from "@budget/app/(protected)/dashboard/data";
import { formatCurrency, formatPercent } from "./formatters";
import { toNumber } from "@budget/lib/helpers";

type ExpenseMerchantBarRingProps = {
  merchants: DashboardData["topVendors"]["expenseMerchants"];
  limit: number;
};

type ChartDatum = {
  key: string;
  label: string;
  total: number;
  percent: number;
  count: number;
  href: string;
  fill: string;
};

const palette = [
  "#0f766e",
  "#10b981",
  "#059669",
  "#14b8a6",
  "#0ea5e9",
  "#6366f1",
  "#8b5cf6",
  "#ec4899",
];

const RADIAN = Math.PI / 180;

export function ExpenseMerchantBarRing({
  merchants,
  limit,
}: ExpenseMerchantBarRingProps) {
  const resolvedLimit = limit > 0 ? limit : merchants.length;

  const { data, total } = useMemo(() => {
    const limited = merchants.slice(0, resolvedLimit);
    const totalSpent = limited.reduce(
      (sum, merchant) => sum + merchant.total,
      0
    );
    const items: ChartDatum[] = limited.map((merchant, index) => ({
      key: merchant.key,
      label: merchant.label,
      total: merchant.total,
      percent: totalSpent > 0 ? merchant.total / totalSpent : 0,
      count: merchant.count,
      href: merchant.href,
      fill: palette[index % palette.length],
    }));
    return { data: items, total: totalSpent };
  }, [merchants, resolvedLimit]);

  const renderLabel = ({ percent, ...props }: PieLabelRenderProps) => {
    const cx = toNumber(props.cx);
    const cy = toNumber(props.cy);
    const midAngle = toNumber(props.midAngle);
    const innerRadius = toNumber(props.innerRadius);
    const outerRadius = toNumber(props.outerRadius);
    const pct = toNumber(percent);

    if (pct < 0.03) {
      return <text></text>;
    }
    const radius = (Number(innerRadius) + Number(outerRadius)) / 2;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text
        x={x}
        y={y}
        fill="#f8fafc"
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={12}
        fontWeight={600}
        className="drop-shadow-[0_1px_1px_rgba(15,23,42,0.45)]"
      >
        {formatPercent(pct)}
      </text>
    );
  };

  return (
    <div className="relative">
      <div className="rounded-3xl bg-gradient-to-br from-emerald-100/60 via-white to-emerald-50/60 p-4">
        <div className="aspect-square relative">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart
              style={{
                aspectRatio: 1,
              }}
            >
              <Pie
                data={data}
                dataKey="percent"
                nameKey="label"
                innerRadius="72%"
                outerRadius="100%"
                labelLine={false}
                cornerRadius="50%"
                fill="#8884d8"
                paddingAngle={5}
                label={renderLabel}
              />
            </PieChart>
          </ResponsiveContainer>

          <div className="absolute inset-0 top-[60%] transform-[translateY(-50%)] text-center">
            <p className="text-xs uppercase tracking-wide text-emerald-900/70 dark:text-emerald-100/70">
              Total captured here
            </p>
            <p className="text-2xl font-semibold text-emerald-950 dark:text-emerald-50">
              {formatCurrency(total)}
            </p>
            <p className="mt-2 text-xs text-emerald-900/60 dark:text-emerald-100/60">
              across {data.length} merchant{data.length === 1 ? "" : "s"}.
            </p>
          </div>
        </div>
      </div>

      <ul className="space-y-2 text-sm" aria-label="Expense merchant legend">
        {data.map((datum) => (
          <li
            key={datum.key}
            className="flex items-center justify-between rounded-2xl border border-emerald-900/10 bg-white/75 px-3 py-2 text-emerald-900/80 dark:border-emerald-100/20 dark:bg-emerald-900/50 dark:text-emerald-100/80"
          >
            <span className="inline-flex items-center gap-2">
              <span
                aria-hidden="true"
                className="inline-block size-2 rounded-full"
                style={{ backgroundColor: datum.fill }}
              />
              {datum.label}
            </span>
            <span className="text-right">
              <span className="block font-medium">
                {formatCurrency(datum.total)}
              </span>
              <span className="block text-xs text-emerald-900/70 dark:text-emerald-100/70">
                {formatPercent(datum.percent)} • {datum.count} txn
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
