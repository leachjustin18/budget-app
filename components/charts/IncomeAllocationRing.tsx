"use client";

import { Pie, PieChart, ResponsiveContainer } from "recharts";
import type { PieLabelRenderProps } from "recharts";
import type { DashboardData } from "@budget/app/(protected)/dashboard/data";
import { formatCurrency, formatPercent } from "./formatters";
import { toNumber } from "@budget/lib/helpers";

type SectionSlice = DashboardData["monthlySeries"][number]["sections"][number];

type IncomeAllocationRingProps = {
  monthLabel: string;
  income: number;
  sections: SectionSlice[];
};

type ChartDatum = {
  name: string;
  value: number;
  percent: number;
  section: SectionSlice["section"];
  fill: string;
};

const SECTION_COLORS: Record<SectionSlice["section"], string> = {
  expenses: "#047857",
  recurring: "#33d50eff",
  savings: "#2563eb",
  debt: "#b91c1c",
};

const RADIAN = Math.PI / 180;

export function IncomeAllocationRing({
  monthLabel,
  income,
  sections,
}: IncomeAllocationRingProps) {
  const safeIncome = income > 0 ? income : 0;
  const totalAllocated = sections.reduce(
    (sum, section) => (section.planned ? sum + section.planned : sum),
    0
  );
  const unallocated = Math.max(0, safeIncome - totalAllocated);

  const baseData: ChartDatum[] = sections.map((section) => ({
    name: section.label,
    value: Math.max(0, section?.planned ?? 0),
    percent:
      safeIncome > 0 ? Math.max(0, section?.planned ?? 0) / safeIncome : 0,
    section: section.section,
    fill: SECTION_COLORS[section.section] ?? "#0f766e",
  }));

  const data =
    unallocated > 0
      ? [
          ...baseData.filter((data) => data.value > 0),
          {
            name: "Unassigned",
            value: unallocated,
            percent: safeIncome > 0 ? unallocated / safeIncome : 0,
            section: "savings",
            fill: "rgba(15,118,110,0.35)",
          } satisfies ChartDatum,
        ]
      : baseData.filter((data) => data.value > 0);

  const centerLabel = safeIncome > 0 ? formatCurrency(safeIncome) : "No income";

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
                dataKey="value"
                nameKey="name"
                innerRadius="80%"
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
              Planned income
            </p>
            <p className="text-2xl font-semibold text-emerald-950 dark:text-emerald-50">
              {centerLabel}
            </p>
            <p className="mt-2 text-xs text-emerald-900/60 dark:text-emerald-100/60">
              {monthLabel}
            </p>
          </div>
        </div>
      </div>

      <ul className="mt-6 space-y-2 text-sm">
        {data.map((datum) => (
          <li
            key={datum.name}
            className="flex items-center justify-between rounded-2xl border border-emerald-900/10 bg-white/70 px-3 py-2 text-emerald-900/80 dark:border-emerald-100/20 dark:bg-emerald-900/50 dark:text-emerald-100/80"
          >
            <span className="inline-flex items-center gap-2">
              <span
                aria-hidden="true"
                className="inline-block size-2 rounded-full"
                style={{
                  backgroundColor: datum.fill,
                }}
              />
              {datum.name}
            </span>
            <span>
              {formatCurrency(datum.value)} • {formatPercent(datum.percent)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
