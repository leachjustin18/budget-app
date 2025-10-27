"use client";

import { useMemo, useState } from "react";
import type { DashboardData } from "./data";
import {
  ChartCard,
  IncomeAllocationRing,
  MonthRangeSelector,
  TopEnvelopePaceChart,
  EnvelopePlanStackedBars,
  ExpenseMerchantBarRing,
  SpendingCalendar,
} from "@budget/components/charts";
import {
  formatCurrency,
  formatPercent,
} from "@budget/components/charts/formatters";
import { useDashboardData } from "@budget/app/hooks/useDashboardData";

type SummaryTileProps = {
  label: string;
  value: string;
  helper?: string;
  intent?: "positive" | "negative" | "neutral";
};

const intentStyles: Record<NonNullable<SummaryTileProps["intent"]>, string> = {
  positive:
    "bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200",
  negative:
    "bg-rose-500/10 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200",
  neutral:
    "bg-emerald-900/5 text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-100/80",
};

const SummaryTile = ({
  label,
  value,
  helper,
  intent = "neutral",
}: SummaryTileProps) => (
  <div className="flex flex-col justify-between rounded-3xl border border-emerald-900/10 bg-white/85 p-4 shadow-[0_16px_36px_-18px_rgba(16,185,129,0.35)] backdrop-blur dark:border-emerald-100/10 dark:bg-emerald-950/60 dark:shadow-none">
    <p className="text-xs uppercase tracking-wide text-emerald-900/65 dark:text-emerald-100/60">
      {label}
    </p>
    <p className="mt-2 text-2xl font-semibold text-emerald-950 dark:text-emerald-50">
      {value}
    </p>
    {helper ? (
      <span
        className={`mt-3 inline-flex items-center rounded-xl px-2 py-1 text-xs font-medium ${intentStyles[intent]}`}
      >
        {helper}
      </span>
    ) : null}
  </div>
);

const getSeriesForMonth = (
  series: DashboardData["monthlySeries"],
  monthKey: string,
  fallbackKey?: string,
  months?: DashboardData["months"]
) => {
  const found =
    series.find((item) => item.monthKey === monthKey) ??
    (fallbackKey ? series.find((item) => item.monthKey === fallbackKey) : null);

  if (found) {
    return found;
  }

  const label =
    months?.find((month) => month.monthKey === monthKey)?.label ??
    (fallbackKey
      ? months?.find((month) => month.monthKey === fallbackKey)?.label
      : undefined) ??
    "Selected";

  return {
    monthKey,
    monthStart: "",
    monthEnd: "",
    label,
    plannedIncome: null,
    plannedExpense: null,
    plannedNet: null,
    actualIncome: 0,
    actualExpense: 0,
    actualNet: 0,
    varianceExpense: null,
    varianceIncome: null,
    isFuture: false,
    sections: [],
  } as DashboardData["monthlySeries"][number];
};

const getBurnDownForMonth = (
  burnDown: DashboardData["burnDown"],
  monthKey: string
) => {
  const byMonth = (
    burnDown as unknown as {
      byMonth?: Record<string, DashboardData["burnDown"]>;
    }
  ).byMonth;

  if (byMonth && byMonth[monthKey]) {
    return byMonth[monthKey];
  }

  return burnDown;
};

const countPositiveMonths = (
  series: DashboardData["monthlySeries"],
  monthKeys: string[]
) =>
  series
    .filter((item) => monthKeys.includes(item.monthKey))
    .reduce(
      (accumulator, item) =>
        item.actualNet >= 0 ? accumulator + 1 : accumulator,
      0
    );

export default function DashboardCharts() {
  const data = useDashboardData();
  const {
    months,
    monthlySeries,
    categoryPlanActual,
    categoryHistory,
    burnDown,
    topVendors,
    summary,
  } = data;

  const monthKeys = months.map((month) => month.monthKey);
  const defaultIndex =
    monthKeys.lastIndexOf(categoryPlanActual.monthKey) !== -1
      ? monthKeys.lastIndexOf(categoryPlanActual.monthKey)
      : monthKeys.length - 1;

  const [selectedMonth, setSelectedMonth] = useState(
    monthKeys[defaultIndex] ?? categoryPlanActual.monthKey
  );
  const [range, setRange] = useState(() =>
    Math.min(6, Math.max(3, monthKeys.length))
  );
  const paceOptions = [
    { value: "3", label: "Top 3" },
    { value: "12", label: "Top 12" },
    { value: "24", label: "Top 24" },
    { value: "all", label: "All" },
  ] as const;
  const [paceChartLimit, setPaceChartLimit] =
    useState<(typeof paceOptions)[number]["value"]>("3");

  const monthLookup = useMemo(
    () =>
      new Map(months.map((month, index) => [month.monthKey, { month, index }])),
    [months]
  );

  const selectedMeta =
    monthLookup.get(selectedMonth) ??
    monthLookup.get(categoryPlanActual.monthKey) ??
    [...monthLookup.values()].at(-1);

  const selectedIndex = selectedMeta?.index ?? monthKeys.length - 1;
  const rangeStartIndex = Math.max(0, selectedIndex - (range - 1));
  const rangeMonthKeys = monthKeys.slice(rangeStartIndex, selectedIndex + 1);

  const selectedSeries = useMemo(
    () =>
      getSeriesForMonth(
        monthlySeries,
        selectedMonth,
        categoryPlanActual.monthKey,
        months
      ),
    [monthlySeries, selectedMonth, categoryPlanActual.monthKey, months]
  );

  const categorySnapshot = categoryHistory.find(
    (entry) => entry.monthKey === selectedMonth
  ) ??
    categoryHistory.find(
      (entry) => entry.monthKey === categoryPlanActual.monthKey
    ) ?? {
      monthKey: categoryPlanActual.monthKey,
      label:
        months.find((month) => month.monthKey === categoryPlanActual.monthKey)
          ?.label ?? "",
      categories: categoryPlanActual.categories,
      totalActual: categoryPlanActual.totalActual,
      totalPlanned: categoryPlanActual.totalPlanned,
    };

  const burnDownForSelected = getBurnDownForMonth(burnDown, selectedMonth);

  const hasPlannedExpense = selectedSeries.plannedExpense !== null;
  const hasPlannedIncome = selectedSeries.plannedIncome !== null;
  const plannedExpenseValue = selectedSeries.plannedExpense ?? 0;
  const plannedIncomeValue = selectedSeries.plannedIncome ?? 0;
  const incomeForRing =
    selectedSeries.plannedIncome ?? selectedSeries.actualIncome;

  const envelopeActualTotal = selectedSeries.sections.reduce(
    (sum, section) => sum + section.actual,
    0
  );
  const envelopePlannedTotal = selectedSeries.sections.reduce(
    (sum, section) => sum + (section.planned ?? 0),
    0
  );

  const averageDailySpend =
    burnDownForSelected.points.length > 0
      ? burnDownForSelected.points.reduce(
          (sum, point) => sum + point.dailyActual,
          0
        ) / burnDownForSelected.points.length
      : 0;

  const trailingNetTotals = monthlySeries
    .filter((item) => rangeMonthKeys.includes(item.monthKey))
    .map((item) => item.actualIncome - item.actualExpense);

  const averageTrailingNet =
    trailingNetTotals.length > 0
      ? trailingNetTotals.reduce((sum, value) => sum + value, 0) /
        trailingNetTotals.length
      : 0;

  const positiveMonthCount = countPositiveMonths(monthlySeries, rangeMonthKeys);

  const spendingFooter = `Average of ${formatCurrency(
    averageDailySpend
  )} per day.`;

  const summaryTiles: SummaryTileProps[] = [
    {
      label: `${selectedSeries.label} spending`,
      value: formatCurrency(selectedSeries.actualExpense),
      helper: hasPlannedExpense
        ? `${formatCurrency(
            Math.abs(selectedSeries.actualExpense - plannedExpenseValue)
          )} ${
            selectedSeries.actualExpense > plannedExpenseValue
              ? "over"
              : "under"
          } plan`
        : undefined,
      intent: hasPlannedExpense
        ? selectedSeries.actualExpense > plannedExpenseValue
          ? "negative"
          : "positive"
        : "neutral",
    },
    {
      label: `${selectedSeries.label} income`,
      value: formatCurrency(selectedSeries.actualIncome),
      helper: hasPlannedIncome
        ? `${formatPercent(
            plannedIncomeValue === 0
              ? 0
              : selectedSeries.actualIncome / plannedIncomeValue
          )} of plan`
        : undefined,
      intent: hasPlannedIncome
        ? selectedSeries.actualIncome < plannedIncomeValue
          ? "negative"
          : "positive"
        : "neutral",
    },
    {
      label: "Envelope coverage",
      value: formatPercent(
        incomeForRing > 0
          ? Math.min(envelopeActualTotal / incomeForRing, 1.5)
          : 0
      ),
      helper:
        hasPlannedIncome && plannedIncomeValue > 0 && envelopePlannedTotal > 0
          ? `${formatPercent(
              Math.min(envelopePlannedTotal / plannedIncomeValue, 1.5)
            )} planned`
          : `${formatCurrency(envelopeActualTotal)} allocated`,
      intent:
        incomeForRing > 0 && envelopeActualTotal > incomeForRing
          ? "negative"
          : "positive",
    },
    {
      label: `${rangeMonthKeys.length} month net`,
      value: formatCurrency(averageTrailingNet),
      helper: `${positiveMonthCount} positive month${
        positiveMonthCount === 1 ? "" : "s"
      }`,
      intent: averageTrailingNet >= 0 ? "positive" : "negative",
    },
  ];

  const atRiskMonths = summary.atRiskMonths.filter((month) =>
    rangeMonthKeys.includes(month.monthKey)
  );

  const derivedMonthLength = (() => {
    if (!selectedSeries.monthStart || !selectedSeries.monthEnd) return null;
    const start = new Date(selectedSeries.monthStart);
    const end = new Date(selectedSeries.monthEnd);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return null;
    }
    const diffMs = end.getTime() - start.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1;
    return Number.isFinite(diffDays) && diffDays > 0 ? diffDays : null;
  })();

  const totalDaysInMonth =
    burnDownForSelected.points.at(-1)?.day ?? derivedMonthLength ?? 30;
  const todayPoint =
    burnDownForSelected.points.find((point) => point.isToday) ??
    burnDownForSelected.points.at(-1) ??
    null;
  const currentDayNumber =
    todayPoint?.day && todayPoint.day > 0
      ? todayPoint.day
      : Math.min(
          typeof totalDaysInMonth === "number" && totalDaysInMonth > 0
            ? totalDaysInMonth
            : 30,
          burnDownForSelected.points.length > 0
            ? burnDownForSelected.points[burnDownForSelected.points.length - 1]
                .day
            : 30
        );
  const safeTotalDays =
    typeof totalDaysInMonth === "number" && totalDaysInMonth > 0
      ? totalDaysInMonth
      : 30;
  const safeCurrentDay = Math.max(
    1,
    Math.min(
      safeTotalDays,
      currentDayNumber > 0 ? currentDayNumber : safeTotalDays
    )
  );
  const resolvedPaceLimit =
    paceChartLimit === "all"
      ? categorySnapshot.categories.length
      : Number.parseInt(paceChartLimit, 10) || 3;
  const expenseMerchants = topVendors?.expenseMerchants ?? [];
  const resolvedMerchantLimit = 5;

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summaryTiles.map((tile, index) => (
          <SummaryTile key={index} {...tile} />
        ))}
      </div>

      <MonthRangeSelector
        months={months}
        selectedMonth={selectedMonth}
        onMonthChange={setSelectedMonth}
        range={range}
        onRangeChange={setRange}
        className="w-full"
      />

      <div className="grid gap-6 xl:grid-cols-12">
        <ChartCard
          title="Envelope coverage"
          description="See how planned envelopes consume the month&rsquo;s income target."
          ariaLabel="Income allocation radial chart"
          minHeight={360}
          className="xl:col-span-6"
        >
          <IncomeAllocationRing
            monthLabel={selectedSeries.label}
            income={incomeForRing}
            sections={selectedSeries.sections}
          />
        </ChartCard>

        <ChartCard
          title="Top 5 expense merchants"
          description="Expenses funneled by merchants so you can see where the 💲 are landing."
          ariaLabel="Expense merchants ranked by spend"
          minHeight={520}
          className="xl:col-span-6"
        >
          <ExpenseMerchantBarRing
            merchants={expenseMerchants}
            limit={resolvedMerchantLimit}
          />
        </ChartCard>
      </div>

      <ChartCard
        title="Spending cadence"
        description="Calendar lays out the month one day at a time so you can compare spend versus the daily target."
        ariaLabel="Daily spending calendar"
        minHeight={420}
        className="xl:col-span-7"
        footer={spendingFooter}
      >
        <SpendingCalendar
          points={burnDownForSelected.points}
          monthLabel={selectedSeries.label}
          dailyAllowance={burnDownForSelected.dailyAllowance}
        />
      </ChartCard>

      <ChartCard
        title="Envelope pace check"
        description="Actual spend pace compared to spreading the plan evenly across the month.  Use the drop down to pick how many envelopes to track."
        ariaLabel="Envelope spend pace line charts"
        minHeight={420}
        actions={
          <div className="flex items-center gap-2 text-xs">
            <label
              htmlFor="pace-limit"
              className="text-emerald-900/70 dark:text-emerald-100/70"
            >
              Envelopes
            </label>
            <select
              id="pace-limit"
              value={paceChartLimit}
              onChange={(event) =>
                setPaceChartLimit(event.target.value as typeof paceChartLimit)
              }
              className="rounded-md border border-emerald-900/20 bg-white/80 px-2 py-1 text-emerald-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-emerald-500 dark:border-emerald-100/20 dark:bg-emerald-900/40 dark:text-emerald-100"
            >
              {paceOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        }
      >
        <TopEnvelopePaceChart
          categories={categorySnapshot.categories}
          totalDays={safeTotalDays}
          currentDay={safeCurrentDay}
          limit={resolvedPaceLimit}
        />
      </ChartCard>

      <ChartCard
        title="Plan vs. spend breakdown"
        description="Planned, spent, and remaining across the envelopes with the largest plans."
        ariaLabel="Stacked bars of planned versus actual spending for top envelopes"
        minHeight={520}
      >
        <EnvelopePlanStackedBars categories={categorySnapshot.categories} />
      </ChartCard>

      <ChartCard
        title="At-risk outlook"
        description="Months that project a net cash shortfall stay on your radar."
        ariaLabel="At-risk month list"
        role="presentation"
        minHeight={420}
      >
        <div className="flex h-full flex-col justify-between">
          {atRiskMonths.length > 0 ? (
            <ul className="space-y-3 text-sm">
              {atRiskMonths.map((month) => (
                <li
                  key={month.monthKey}
                  className="rounded-2xl border border-emerald-900/10 bg-rose-500/10 px-3 py-3 text-emerald-950 shadow-sm dark:border-rose-200/20 dark:bg-rose-500/20 dark:text-rose-50"
                >
                  <p className="text-xs uppercase tracking-wide text-rose-700 dark:text-rose-100">
                    {month.label}
                  </p>
                  <p className="mt-1 text-lg font-semibold">
                    Deficit of {formatCurrency(Math.abs(month.net))}
                  </p>
                  <p className="mt-2 text-xs text-emerald-900/70 dark:text-emerald-100/70">
                    Build a plan to trim envelopes or boost income before this
                    month hits.
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex h-full flex-col items-start justify-center space-y-2 rounded-2xl border border-emerald-900/10 bg-white/70 p-4 text-sm text-emerald-900/80 dark:border-emerald-100/20 dark:bg-emerald-900/50 dark:text-emerald-100/80">
              <p className="text-base font-semibold text-emerald-950 dark:text-emerald-50">
                No red flags in this window
              </p>
              <p>
                Keep glancing at the cash glide to ensure the buffer holds as
                new transactions land.
              </p>
            </div>
          )}

          <p className="mt-4 text-xs text-emerald-900/70 dark:text-emerald-100/70">
            Thresholds come from your variance guardrails so you only see
            material issues.
          </p>
        </div>
      </ChartCard>
    </div>
  );
}
