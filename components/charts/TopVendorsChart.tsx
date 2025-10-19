"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import Link from "next/link";
import { formatCurrency } from "./formatters";
import type { DashboardData } from "@budget/app/(protected)/dashboard/data";

type TopVendorsChartProps = {
  vendors: DashboardData["topVendors"]["vendors"];
  transactions: DashboardData["topVendors"]["transactions"];
  onVendorSelect?: (href: string) => void;
};

const tooltipRenderer = ({
  payload,
  label,
}: {
  payload?: Array<{ payload: DashboardData["topVendors"]["vendors"][number] }>;
  label?: string | number;
}) => {
  if (!payload || payload.length === 0) return null;
  const vendor = payload[0].payload;
  return (
    <div className="rounded-xl border border-emerald-900/10 bg-white/95 px-4 py-2 text-sm shadow-lg dark:border-emerald-100/10 dark:bg-emerald-900/90">
      <p className="mb-1 font-semibold text-emerald-950 dark:text-emerald-50">
        {label}
      </p>
      <ul className="space-y-1 text-emerald-900/80 dark:text-emerald-100/80">
        <li className="flex justify-between">
          <span>Total</span>
          <span className="font-medium">{formatCurrency(vendor.total)}</span>
        </li>
        <li className="flex justify-between">
          <span>Transactions</span>
          <span>{vendor.count}</span>
        </li>
        <li className="flex justify-between">
          <span>Average</span>
          <span>{formatCurrency(vendor.average)}</span>
        </li>
      </ul>
    </div>
  );
};

export function TopVendorsChart({
  vendors,
  transactions,
  onVendorSelect,
}: TopVendorsChartProps) {
  const topVendors = vendors.slice(0, 8);

  return (
    <div className="grid gap-6 md:grid-cols-[1.35fr,1fr]">
      <div className="h-[320px] rounded-2xl border border-emerald-900/10 bg-gradient-to-br from-emerald-100/60 via-white/75 to-emerald-50/70 p-4 shadow-inner dark:border-emerald-100/10 dark:from-emerald-900/40 dark:via-emerald-950/40 dark:to-emerald-900/30">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={topVendors}
            layout="vertical"
            margin={{ top: 16, right: 24, left: 12, bottom: 12 }}
            barCategoryGap={20}
          >
            <CartesianGrid
              strokeDasharray="4 4"
              stroke="rgba(15,118,110,0.18)"
              horizontal
              vertical={false}
            />
            <XAxis
              type="number"
              tickFormatter={(value) => formatCurrency(Number(value))}
              stroke="rgba(15,118,110,0.45)"
              tick={{ fill: "rgba(15,118,110,0.75)", fontSize: 12 }}
            />
            <YAxis
              type="category"
              dataKey="label"
              width={160}
              tick={{ fill: "rgba(15,118,110,0.85)", fontSize: 13, fontWeight: 600 }}
            />
            <Tooltip content={tooltipRenderer} />
            <Bar dataKey="total" radius={[8, 8, 8, 8]} maxBarSize={26}>
              {topVendors.map((vendor, index) => (
                <Cell
                  key={vendor.key}
                  cursor="pointer"
                  fill={
                    index === 0
                      ? "rgba(16,185,129,0.9)"
                      : `rgba(59,130,246,${0.85 - index * 0.06})`
                  }
                  onClick={() => onVendorSelect?.(vendor.href)}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <p className="mt-3 text-xs text-emerald-900/70 dark:text-emerald-100/70">
          Click a merchant to open a filtered transaction list.
        </p>
      </div>

      <div className="rounded-2xl border border-emerald-900/10 bg-white/90 p-4 shadow-sm dark:border-emerald-100/10 dark:bg-emerald-950/60">
        <header className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-emerald-950 dark:text-emerald-50">
            Largest transactions
          </h4>
          <span className="text-xs text-emerald-900/60 dark:text-emerald-100/60">
            Top {Math.min(6, transactions.length)}
          </span>
        </header>
        <div className="mt-3 divide-y divide-emerald-900/10 dark:divide-emerald-100/10">
          {transactions.slice(0, 6).map((transaction) => (
            <div
              key={transaction.id}
              className="flex items-center justify-between gap-4 py-2"
            >
              <div>
                <p className="text-sm font-medium text-emerald-950 dark:text-emerald-50">
                  {transaction.label}
                </p>
                <p className="text-xs text-emerald-900/60 dark:text-emerald-100/60">
                  {transaction.vendor} · {transaction.occurredOn}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-xs font-semibold text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-200">
                  {formatCurrency(transaction.amount)}
                </span>
                <Link
                  href={transaction.href}
                  className="text-xs font-semibold text-emerald-600 transition hover:text-emerald-700 dark:text-emerald-200 dark:hover:text-emerald-100"
                >
                  View
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
