"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TooltipContentProps, MouseHandlerDataParam } from "recharts";
import type {
  NameType,
  ValueType,
  Payload,
} from "recharts/types/component/DefaultTooltipContent";
import { formatCurrency } from "./formatters";
import type { DashboardData } from "@budget/app/(protected)/dashboard/data";

type IncomeExpenseTrendProps = {
  data: DashboardData["monthlySeries"];
  months: string[];
  activeMonth: string;
  onMonthHover?: (monthKey: string | null) => void;
  onMonthSelect?: (monthKey: string) => void;
};

// Properly typed tooltip content component
function CustomTooltip({
  label,
  payload,
}: TooltipContentProps<string | number, string>) {
  if (!payload || payload.length === 0) return null;

  const safeLabel = label != null ? String(label) : "";

  return (
    <div className="rounded-xl border border-emerald-900/10 bg-white/95 px-4 py-2 text-sm shadow-lg dark:border-emerald-100/10 dark:bg-emerald-900/90">
      <p className="mb-1 font-semibold text-emerald-950 dark:text-emerald-50">
        {safeLabel}
      </p>
      <ul className="space-y-1">
        {(payload as Payload<ValueType, NameType>[]).map(
          (entry: Payload<ValueType, NameType>) => {
            const key = String(entry.dataKey ?? entry.name ?? "");
            const color = (entry.color as string) ?? "currentColor";
            const name = String(entry.name ?? "");
            const valueNum = Number(entry.value ?? 0);

            return (
              <li
                key={key}
                className="flex items-center justify-between text-emerald-900/80 dark:text-emerald-100/80"
              >
                <span className="inline-flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="inline-block size-2 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  {name}
                </span>
                <span className="font-medium">{formatCurrency(valueNum)}</span>
              </li>
            );
          }
        )}
      </ul>
    </div>
  );
}

export function IncomeExpenseTrendChart({
  data,
  months,
  activeMonth,
  onMonthHover,
  onMonthSelect,
}: IncomeExpenseTrendProps) {
  const filtered = data.filter((series) => months.includes(series.monthKey));
  const activeLabel = filtered.find((s) => s.monthKey === activeMonth)?.label;

  const handleMouseMove = (state: MouseHandlerDataParam) => {
    const idx = state?.activeTooltipIndex;
    if (typeof idx === "number" && filtered[idx]) {
      onMonthHover?.(filtered[idx].monthKey);
    }
  };

  const handleClick = (state: MouseHandlerDataParam) => {
    const idx = state?.activeTooltipIndex;
    if (typeof idx === "number" && filtered[idx]) {
      onMonthSelect?.(filtered[idx].monthKey);
    }
  };

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart
        data={filtered}
        margin={{ top: 16, right: 24, left: 12, bottom: 8 }}
        onMouseLeave={() => onMonthHover?.(null)}
        onMouseMove={handleMouseMove}
        onClick={handleClick}
      >
        <defs>
          <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#10b981" stopOpacity={0.9} />
            <stop offset="95%" stopColor="#10b981" stopOpacity={0.1} />
          </linearGradient>
          <linearGradient id="expenseGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#ef4444" stopOpacity={0.9} />
            <stop offset="95%" stopColor="#ef4444" stopOpacity={0.1} />
          </linearGradient>
        </defs>

        <CartesianGrid strokeDasharray="4 4" stroke="rgba(15,118,110,0.18)" />

        <XAxis
          dataKey="label"
          stroke="rgba(15,118,110,0.55)"
          tick={{ fill: "rgba(15,118,110,0.7)", fontSize: 12 }}
        />
        <YAxis
          stroke="rgba(15,118,110,0.55)"
          tick={{ fill: "rgba(15,118,110,0.7)", fontSize: 12 }}
          tickFormatter={(value: number) => formatCurrency(Number(value))}
        />

        {/* Pass a React element to match Tooltip's content typing */}
        <Tooltip content={CustomTooltip} />

        <Legend />

        <ReferenceLine
          y={0}
          stroke="rgba(15,118,110,0.35)"
          strokeDasharray="3 3"
        />

        <Area
          type="monotone"
          dataKey="actualIncome"
          name="Income"
          stroke="#0f766e"
          strokeWidth={2}
          fill="url(#incomeGradient)"
          isAnimationActive
          animationDuration={600}
          connectNulls
          activeDot={{ r: 5 }}
        />
        <Area
          type="monotone"
          dataKey="actualExpense"
          name="Expenses"
          stroke="#dc2626"
          strokeWidth={2}
          fill="url(#expenseGradient)"
          isAnimationActive
          animationDuration={600}
          connectNulls
          activeDot={{ r: 5 }}
        />
        <Line
          type="monotone"
          dataKey="actualNet"
          name="Net"
          stroke="#1d4ed8"
          strokeWidth={2}
          dot={{ r: 3 }}
          activeDot={{ r: 5 }}
          isAnimationActive
          animationDuration={600}
        />
        {filtered.some((series) => series.plannedNet !== null) ? (
          <Line
            type="monotone"
            dataKey="plannedNet"
            name="Planned net"
            stroke="#fbbf24"
            strokeDasharray="5 3"
            strokeWidth={2}
            dot={{ r: 2 }}
            isAnimationActive
            animationDuration={600}
          />
        ) : null}

        {activeLabel ? (
          <ReferenceLine
            x={activeLabel}
            stroke="#34d399"
            strokeDasharray="2 2"
          />
        ) : null}
      </AreaChart>
    </ResponsiveContainer>
  );
}
