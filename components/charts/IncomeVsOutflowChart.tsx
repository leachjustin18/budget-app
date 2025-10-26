"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
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

type IncomeVsOutflowChartProps = {
  actualIncome: number;
  actualExpense: number;
  plannedIncome: number | null;
  plannedExpense: number | null;
};

type ChartRow = {
  label: string;
  income: number;
  expense: number;
};

const renderCustomizedLabel = (props: LabelProps) => {
  const { x, y, width, value } = props;

  if (x == null || y == null || width == null) {
    return null;
  }
  const radius = 10;

  return (
    <g>
      <text
        x={Number(x) + Number(width) / 2}
        y={Number(y) - radius}
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
  payload?: Array<{ dataKey?: string; value?: number }>;
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
          <li key={entry.dataKey} className="flex justify-between gap-6">
            <span className="capitalize">{entry.dataKey}</span>
            <span className="font-medium">
              {formatCurrency(Number(entry.value ?? 0))}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export function IncomeVsOutflowChart({
  actualIncome,
  actualExpense,
  plannedIncome,
  plannedExpense,
}: IncomeVsOutflowChartProps) {
  const rows: ChartRow[] = [
    {
      label: "Actual",
      income: actualIncome,
      expense: actualExpense,
    },
  ];
  if (plannedIncome !== null || plannedExpense !== null) {
    rows.push({
      label: "Plan",
      income: plannedIncome ?? 0,
      expense: plannedExpense ?? 0,
    });
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart
        data={rows}
        margin={{ top: 16, right: 24, left: 12, bottom: 12 }}
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
          stroke="rgba(15,118,110,0.35)"
          strokeDasharray="3 3"
        />
        <Bar
          dataKey="income"
          name="Income"
          fill="rgba(16, 185, 129, 0.85)"
          radius={[6, 6, 0, 0]}
          isAnimationActive
        >
          <LabelList
            position="top"
            dataKey="income"
            content={renderCustomizedLabel}
          />
        </Bar>
        <Bar
          dataKey="expense"
          name="Outflow"
          fill="rgba(239, 68, 68, 0.85)"
          radius={[6, 6, 0, 0]}
          isAnimationActive
        >
          <LabelList
            position="top"
            dataKey="expense"
            content={renderCustomizedLabel}
          />
        </Bar>
      </ComposedChart>
    </ResponsiveContainer>
  );
}
