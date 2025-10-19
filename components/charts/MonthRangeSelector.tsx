"use client";

import { useMemo } from "react";
import { joinClassNames } from "@budget/lib/helpers";

type MonthOption = {
  monthKey: string;
  label: string;
  longLabel: string;
  isFuture: boolean;
  isCurrent: boolean;
};

type MonthRangeSelectorProps = {
  months: MonthOption[];
  selectedMonth: string;
  onMonthChange: (monthKey: string) => void;
  range: number;
  onRangeChange: (months: number) => void;
  rangeOptions?: number[];
  className?: string;
};

export function MonthRangeSelector({
  months,
  selectedMonth,
  onMonthChange,
  range,
  onRangeChange,
  rangeOptions = [3, 6, 9, 12],
  className,
}: MonthRangeSelectorProps) {
  const monthOptions = useMemo(
    () =>
      months.map((month) => ({
        value: month.monthKey,
        label: month.longLabel,
      })),
    [months]
  );

  const availableRangeOptions = useMemo(() => {
    const filtered = rangeOptions.filter((option) => option <= months.length);
    if (filtered.length === 0) {
      return months.length ? [months.length] : [range];
    }
    return filtered;
  }, [months.length, rangeOptions, range]);

  return (
    <div
      className={joinClassNames(
        "flex flex-wrap items-center gap-4 rounded-2xl border border-emerald-900/10 bg-white/70 px-4 py-3 text-sm shadow-sm backdrop-blur dark:border-emerald-100/10 dark:bg-emerald-950/50",
        className
      )}
      aria-label="Dashboard month and range selector"
    >
      <label className="flex items-center gap-2 text-emerald-950 dark:text-emerald-100/90">
        <span className="text-xs uppercase tracking-wide text-emerald-900/65 dark:text-emerald-100/60">
          Focus month
        </span>
        <select
          className="rounded-xl border border-emerald-900/20 bg-white px-3 py-1.5 font-medium text-emerald-950 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-emerald-100/20 dark:bg-emerald-900/40 dark:text-emerald-100"
          value={selectedMonth}
          onChange={(event) => onMonthChange(event.target.value)}
        >
          {monthOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <fieldset className="flex flex-wrap items-center gap-2 text-emerald-950 dark:text-emerald-100/90">
        <legend className="text-xs uppercase tracking-wide text-emerald-900/65 dark:text-emerald-100/60">
          Trailing window
        </legend>
        <div className="flex items-center gap-1">
          {availableRangeOptions.map((option) => {
            const disabled = option > months.length;
            return (
            <button
              key={option}
              type="button"
              onClick={() => !disabled && onRangeChange(option)}
              className={joinClassNames(
                "rounded-xl px-3 py-1 text-sm font-medium transition-colors",
                option === range
                  ? "bg-emerald-500 text-white shadow-[0_10px_24px_-12px_rgba(16,185,129,0.6)]"
                  : "bg-emerald-50 text-emerald-900 hover:bg-emerald-100 dark:bg-emerald-900/50 dark:text-emerald-100 dark:hover:bg-emerald-900",
                disabled ? "opacity-40 cursor-not-allowed" : ""
              )}
              aria-pressed={option === range}
              disabled={disabled}
            >
              {option}m
            </button>
            );
          })}
        </div>
      </fieldset>

      <p className="text-xs text-emerald-900/60 dark:text-emerald-100/60">
        Applies to historical charts, counting months backward from the selected focus.
      </p>
    </div>
  );
}
