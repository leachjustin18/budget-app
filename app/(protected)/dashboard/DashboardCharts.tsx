"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { DashboardData } from "./data";
import {
  BudgetActualComparisonChart,
  BurnDownLineChart,
  CashFlowForecastChart,
  CategorySharePie,
  CategoryTrendHeatmap,
  CategoryVarianceBars,
  ChartCard,
  IncomeExpenseTrendChart,
  IncomeVsOutflowChart,
  InsightList,
  MonthRangeSelector,
  TopVendorsChart,
} from "@budget/components/charts";
import {
  formatCurrency,
  formatPercent,
} from "@budget/components/charts/formatters";
import { round } from "@budget/lib/helpers";
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
  <div className="rounded-3xl border border-emerald-900/10 bg-white/85 p-4 shadow-[0_16px_36px_-18px_rgba(16,185,129,0.35)] backdrop-blur dark:border-emerald-100/10 dark:bg-emerald-950/60 dark:shadow-none">
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

/** Helpers */
const getSeriesForMonth = (
  series: DashboardData["monthlySeries"],
  monthKey: string,
  fallbackKey?: string,
  months?: DashboardData["months"]
) => {
  const found =
    series.find((s) => s.monthKey === monthKey) ??
    (fallbackKey ? series.find((s) => s.monthKey === fallbackKey) : undefined);
  if (found) return found;

  // safe default
  const label =
    months?.find((m) => m.monthKey === monthKey)?.label ??
    (fallbackKey
      ? months?.find((m) => m.monthKey === fallbackKey)?.label
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

const limitVendors = (
  vendors: DashboardData["topVendors"]["vendors"],
  limit = 6
) => {
  if (!Array.isArray(vendors) || vendors.length <= limit) return vendors;
  const top = vendors.slice(0, limit);
  const rest = vendors.slice(limit);
  const restCount = rest.length;
  const otherTotal = rest.reduce((sum, v) => sum + (v.total ?? 0), 0);
  return [
    ...top,
    {
      key: "__other__",
      label: "Other",
      total: otherTotal,
      count: restCount,
      average: restCount > 0 ? round(otherTotal / restCount) : 0,
      // optional fields tolerated by your chart
    } as (typeof vendors)[number],
  ];
};

export default function DashboardCharts() {
  const data = useDashboardData();
  const {
    months,
    monthlySeries,
    categoryPlanActual,
    categoryHistory,
    categoryTrends,
    forecast,
    burnDown,
    topVendors,
    anomalies,
    summary,
    thresholds,
  } = data;

  const monthKeys = months.map((m) => m.monthKey);
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
  const [hoveredMonth, setHoveredMonth] = useState<string | null>(null);

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

  // Hover only influences highlight in the trend chart.
  const activeMonthKeyForHighlight = hoveredMonth ?? selectedMonth;

  /** Series & snapshots should be based on the SELECTED month for consistency */
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
    (e) => e.monthKey === selectedMonth
  ) ??
    categoryHistory.find((e) => e.monthKey === categoryPlanActual.monthKey) ?? {
      monthKey: categoryPlanActual.monthKey,
      label:
        months.find((m) => m.monthKey === categoryPlanActual.monthKey)?.label ??
        "",
      categories: categoryPlanActual.categories,
      totalActual: categoryPlanActual.totalActual,
      totalPlanned: categoryPlanActual.totalPlanned,
    };

  const trendMonths = useMemo(() => {
    const keys = categoryTrends.monthKeys.slice();
    const sliceStart = Math.max(0, keys.length - range);
    return keys.slice(sliceStart);
  }, [categoryTrends.monthKeys, range]);

  /** Forecast: show only months inside the visible window */
  const forecastSeries = useMemo(() => {
    const firstRangeKey = rangeMonthKeys[0];
    if (!firstRangeKey) return forecast.months.slice();
    return forecast.months.filter((m) => m.monthKey >= firstRangeKey);
  }, [forecast.months, rangeMonthKeys]);

  const filteredAnomalies = useMemo(
    () => anomalies.filter((i) => rangeMonthKeys.includes(i.monthKey)),
    [anomalies, rangeMonthKeys]
  );

  const highlightedCategories = categorySnapshot.categories
    .filter((entry) => entry.overThreshold || entry.underThreshold)
    .slice(0, 4);

  const rangeStartKey = rangeMonthKeys[0] ?? null;
  const rangeEndKey =
    rangeMonthKeys.length > 0
      ? rangeMonthKeys[rangeMonthKeys.length - 1]
      : null;
  const rangeStartLabel = rangeStartKey
    ? months.find((m) => m.monthKey === rangeStartKey)?.label ?? "—"
    : "—";
  const rangeEndLabel = rangeEndKey
    ? months.find((m) => m.monthKey === rangeEndKey)?.label ?? "—"
    : "—";

  /** Planned vs actual tiles should use the SELECTED month (not hover) */
  const hasPlannedExpense = selectedSeries.plannedExpense !== null;
  const hasPlannedIncome = selectedSeries.plannedIncome !== null;
  const hasPlannedNet = selectedSeries.plannedNet !== null;

  const plannedExpenseValue = selectedSeries.plannedExpense ?? 0;
  const plannedIncomeValue = selectedSeries.plannedIncome ?? 0;

  const overPlanSpend = hasPlannedExpense
    ? selectedSeries.actualExpense > plannedExpenseValue
    : false;
  const incomeBelowPlan = hasPlannedIncome
    ? selectedSeries.actualIncome < plannedIncomeValue
    : false;

  const summaryTiles: SummaryTileProps[] = [
    {
      label: `${selectedSeries.label} spend`,
      value: formatCurrency(selectedSeries.actualExpense),
      helper: hasPlannedExpense
        ? `${formatCurrency(
            Math.abs(selectedSeries.actualExpense - plannedExpenseValue)
          )} ${overPlanSpend ? "over" : "under"} plan`
        : undefined,
      intent: hasPlannedExpense
        ? overPlanSpend
          ? "negative"
          : "positive"
        : "neutral",
    },
    {
      label: `${selectedSeries.label} income`,
      value: formatCurrency(selectedSeries.actualIncome),
      helper: hasPlannedIncome
        ? `${formatCurrency(
            Math.abs(selectedSeries.actualIncome - plannedIncomeValue)
          )} ${
            selectedSeries.actualIncome >= plannedIncomeValue
              ? "above"
              : "below"
          } plan`
        : undefined,
      intent: hasPlannedIncome
        ? incomeBelowPlan
          ? "negative"
          : "positive"
        : "neutral",
    },
    {
      label: "Net position",
      value: formatCurrency(
        selectedSeries.actualIncome - selectedSeries.actualExpense
      ),
      helper: hasPlannedNet
        ? `Plan ${formatCurrency(selectedSeries.plannedNet!)}`
        : undefined,
      intent:
        selectedSeries.actualIncome - selectedSeries.actualExpense >= 0
          ? "positive"
          : "negative",
    },
    {
      label: `${rangeMonthKeys.length} mo window`,
      value: `${rangeStartLabel} → ${rangeEndLabel}`,
      helper:
        summary.atRiskMonths.length > 0
          ? `${summary.atRiskMonths.length} month${
              summary.atRiskMonths.length === 1 ? "" : "s"
            } flagged`
          : "No at-risk months detected",
      intent: summary.atRiskMonths.length > 0 ? "negative" : "positive",
    },
  ];

  /** Burn-down: prefer per-month series if available */
  const burnDownForSelected =
    // @ts-expect-error — allow flexible shape: byMonth map if present
    (burnDown?.byMonth && burnDown.byMonth[selectedMonth]) || burnDown;

  /** Top vendors: sort + limit + “Other” bucket for readability */
  const LIMITED_VENDOR_COUNT = 6;
  const topVendorsForSelected =
    selectedMonth === topVendors.monthKey
      ? {
          ...topVendors,
          vendors: limitVendors(
            [...topVendors.vendors].sort(
              (a, b) => (b.total ?? 0) - (a.total ?? 0)
            ),
            LIMITED_VENDOR_COUNT
          ),
        }
      : topVendors;

  return (
    <div className="space-y-8">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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

      <div className="grid gap-6 xl:grid-cols-[2.2fr,1fr]">
        <ChartCard
          title="Spending & income trends"
          description="Tracks income, outflow, and net across the trailing window. Hover to inspect a month; click to focus it."
          ariaLabel="Spending and income trends chart"
          minHeight={320}
        >
          <IncomeExpenseTrendChart
            data={monthlySeries}
            months={rangeMonthKeys}
            activeMonth={activeMonthKeyForHighlight}
            onMonthHover={setHoveredMonth}
            onMonthSelect={setSelectedMonth}
          />
        </ChartCard>

        <ChartCard
          title="Callouts"
          description="Automated notes when spending, income, or plans deviate from expectations."
          ariaLabel="Anomaly insights list"
          minHeight={320}
        >
          <InsightList insights={filteredAnomalies} />
        </ChartCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[2fr,1fr]">
        <ChartCard
          title="Budget vs. actual"
          description="Compare planned and actual income and spending for the trailing months."
          ariaLabel="Budget versus actual comparison chart"
          minHeight={360}
        >
          <BudgetActualComparisonChart
            data={monthlySeries}
            months={rangeMonthKeys}
          />
        </ChartCard>

        <ChartCard
          title="Income vs. outflow"
          description="Two bars: one for income, one for outflow. Optional plan overlays shown when available."
          ariaLabel="Income versus outflow chart"
          minHeight={360}
        >
          <IncomeVsOutflowChart
            actualIncome={selectedSeries.actualIncome}
            actualExpense={selectedSeries.actualExpense}
            plannedIncome={hasPlannedIncome ? plannedIncomeValue : null}
            plannedExpense={hasPlannedExpense ? plannedExpenseValue : null}
          />
        </ChartCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.8fr,1.2fr]">
        <ChartCard
          title="Month-to-date by category"
          description="Live month-to-date envelopes. Red bars are over plan, green bars are under."
          ariaLabel="Month-to-date spending by category"
          minHeight={360}
          footer={
            highlightedCategories.length ? (
              <div className="flex flex-wrap gap-3 text-xs text-emerald-900/70 dark:text-emerald-100/70">
                {highlightedCategories.map((category) => (
                  <span
                    key={category.categoryId}
                    className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 font-medium text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-100"
                  >
                    {category.name}
                    {category.variancePercent !== null
                      ? ` · ${formatPercent(category.variancePercent)}`
                      : ""}
                  </span>
                ))}
              </div>
            ) : null
          }
        >
          <CategoryVarianceBars
            data={categorySnapshot.categories}
            threshold={thresholds.categoryVariance}
            ariaLabel="Month-to-date category variance bars"
          />
        </ChartCard>

        <ChartCard
          title="Category mix"
          description="Share of this month’s spending by category."
          ariaLabel="Category share pie chart"
          minHeight={360}
          minWidth={360}
        >
          <CategorySharePie data={categorySnapshot.categories} />
        </ChartCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.6fr,1.4fr]">
        <ChartCard
          title="Discretionary burn-down"
          description="Actual daily spend vs. target pace for the focus month using local day boundaries."
          ariaLabel="Daily burn-down chart"
          minHeight={380}
          footer={
            <div className="flex flex-wrap items-center gap-3 text-sm text-emerald-900/75 dark:text-emerald-100/70">
              <span>
                Remaining{" "}
                <strong className="font-semibold">
                  {burnDownForSelected?.remainingBudget !== null &&
                  burnDownForSelected?.remainingBudget !== undefined
                    ? formatCurrency(burnDownForSelected.remainingBudget)
                    : "—"}
                </strong>
              </span>
              <span>
                Daily cushion{" "}
                <strong className="font-semibold">
                  {burnDownForSelected?.dailyAllowance !== null &&
                  burnDownForSelected?.dailyAllowance !== undefined
                    ? formatCurrency(burnDownForSelected.dailyAllowance)
                    : "—"}
                </strong>
              </span>
              <span>
                Days left{" "}
                <strong className="font-semibold">
                  {burnDownForSelected?.daysRemaining ?? "—"}
                </strong>
              </span>
            </div>
          }
        >
          <BurnDownLineChart data={burnDownForSelected} />
        </ChartCard>

        <ChartCard
          title="Cash flow forecast"
          description="Projected income and expense vs. historical baseline. Red bars flag negative net plans."
          ariaLabel="Cash flow forecast chart"
          minHeight={360}
        >
          <CashFlowForecastChart
            data={forecastSeries}
            baseline={forecast.baselineNet}
            onMonthSelect={setSelectedMonth}
          />
        </ChartCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.8fr,1.2fr]">
        <ChartCard
          title="Top merchants"
          description="Largest merchants this month with a readable breakdown. Extra entries are grouped as “Other.”"
          ariaLabel="Top merchants bar chart"
          minHeight={360}
          footer={
            selectedMonth === topVendors.monthKey ? null : (
              <p className="text-sm text-emerald-900/75 dark:text-emerald-100/70">
                Merchant insights currently reflect{" "}
                {months.find((m) => m.monthKey === topVendors.monthKey)?.label}.
                Switch the focus month or open the transactions list to explore.
              </p>
            )
          }
        >
          {selectedMonth === topVendors.monthKey ? (
            <TopVendorsChart
              vendors={topVendorsForSelected.vendors}
              transactions={topVendorsForSelected.transactions}
              onVendorSelect={(href) => {
                if (typeof window === "undefined" || !href) return;
                window.open(href, "_blank", "noopener,noreferrer");
              }}
            />
          ) : (
            <div className="flex h-full flex-col items-start justify-center gap-4 rounded-xl border border-dashed border-emerald-200/60 bg-emerald-50/60 p-6 text-sm text-emerald-900/75 dark:border-emerald-100/20 dark:bg-emerald-900/40 dark:text-emerald-100/70">
              <p>
                Merchant insights are currently available for{" "}
                <strong>
                  {
                    months.find((m) => m.monthKey === topVendors.monthKey)
                      ?.label
                  }
                </strong>
                . Switch focus to that month to explore or browse all activity
                below.
              </p>
              <Link
                href="/transactions"
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-500/10 px-4 py-2 font-semibold text-emerald-700 transition hover:bg-emerald-500/20 dark:bg-emerald-500/15 dark:text-emerald-200 dark:hover:bg-emerald-500/25"
              >
                Open transactions
              </Link>
            </div>
          )}
        </ChartCard>

        {/* Removed Savings & debt progress per request */}
      </div>

      <ChartCard
        title="Month-over-month change heatmap"
        description="Saturated squares flag categories with unusual swings. Hover to inspect the change."
        ariaLabel="Category month-over-month change heatmap"
        minHeight={360}
      >
        <CategoryTrendHeatmap
          data={categoryTrends.categories}
          months={trendMonths}
          stdThreshold={thresholds.trendStd}
          percentThreshold={thresholds.trendPercent}
        />
      </ChartCard>
    </div>
  );
}
