"use client";

import { memo, useMemo } from "react";
import type { DashboardData } from "@budget/app/(protected)/dashboard/data";
import { formatCurrency, formatCompactCurrency } from "./formatters";

type SpendingCalendarProps = {
  points: DashboardData["burnDown"]["points"];
  monthLabel: string;
  dailyAllowance?: number | null;
};

type CalendarCell =
  | {
      type: "day";
      day: number;
      amount: number;
      isoDate: string;
    }
  | {
      type: "placeholder";
      key: string;
    };

const weekdayLabels = [
  "Sun",
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
] as const;

function buildCalendar(
  points: SpendingCalendarProps["points"]
): CalendarCell[] {
  if (!points.length) {
    return [];
  }

  const firstPoint = points.reduce((min, point) =>
    point.day < min.day ? point : min
  );
  const sampleDate = new Date(firstPoint.date);
  const year = sampleDate.getFullYear();
  const monthIndex = sampleDate.getMonth();
  const firstOfMonth = new Date(year, monthIndex, 1);
  const firstWeekday = firstOfMonth.getDay(); // 0 = Sunday
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

  const byDay = new Map<number, CalendarCell>(
    points.map((point) => [
      point.day,
      {
        type: "day",
        day: point.day,
        amount: point.dailyActual,
        isoDate: point.date,
      } satisfies CalendarCell,
    ])
  );

  const cells: CalendarCell[] = [];

  for (let i = 0; i < firstWeekday; i += 1) {
    cells.push({ type: "placeholder", key: `pre-${i}` });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const existing = byDay.get(day);
    if (existing) {
      cells.push(existing);
      continue;
    }
    const isoDate = new Date(year, monthIndex, day).toISOString();
    cells.push({
      type: "day",
      day,
      amount: 0,
      isoDate,
    });
  }

  const totalCells = Math.ceil(cells.length / 7) * 7;
  while (cells.length < totalCells) {
    const index = cells.length;
    cells.push({ type: "placeholder", key: `post-${index}` });
  }

  return cells;
}

function getIntensity(amount: number, maxAmount: number): number {
  if (maxAmount <= 0) {
    return 0;
  }
  return Math.min(1, amount / maxAmount);
}

export const SpendingCalendar = memo(function SpendingCalendar({
  points,
  monthLabel,
  dailyAllowance,
}: SpendingCalendarProps) {
  const cells = useMemo(() => buildCalendar(points), [points]);
  const maxAmount = useMemo(
    () =>
      points.reduce(
        (accumulator, point) =>
          point.dailyActual > accumulator ? point.dailyActual : accumulator,
        0
      ),
    [points]
  );

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-wide text-emerald-900/60 dark:text-emerald-100/70">
            Daily spend
          </p>
          <h3 className="text-lg font-semibold text-emerald-950 dark:text-emerald-50">
            {monthLabel}
          </h3>
        </div>
      </header>

      <div className="overflow-x-auto pb-1">
        <div className="min-w-[480px] space-y-3 sm:min-w-0">
          <div className="grid grid-cols-7 gap-2 text-center text-[11px] font-medium uppercase tracking-wide text-emerald-900/70 dark:text-emerald-100/70">
            {weekdayLabels.map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-2 text-sm">
            {cells.map((cell) => {
              if (cell.type === "placeholder") {
                return (
                  <div
                    key={cell.key}
                    className="h-16 rounded-2xl border border-transparent"
                    aria-hidden="true"
                  />
                );
              }

              const intensity = getIntensity(cell.amount, maxAmount);
              const background = `rgba(16, 185, 129, ${
                0.16 + intensity * 0.35
              })`;
              const border = `rgba(16, 185, 129, ${0.22 + intensity * 0.25})`;

              const displayValue =
                cell.amount >= 1000
                  ? formatCompactCurrency(cell.amount)
                  : formatCurrency(cell.amount);

              return (
                <div
                  key={cell.isoDate}
                  className="flex h-20 flex-col justify-between rounded-2xl border bg-white/90 p-2 text-left shadow-sm transition dark:bg-emerald-900/60"
                  style={{ backgroundColor: background, borderColor: border }}
                  role="group"
                  aria-label={`${monthLabel} ${
                    cell.day
                  }, spent ${formatCurrency(cell.amount)}`}
                >
                  <span className="text-xs font-semibold text-emerald-950 dark:text-emerald-50">
                    {cell.day}
                  </span>
                  <span className="text-xs font-medium text-emerald-900/80 dark:text-emerald-100/80">
                    {displayValue}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
});
