"use client";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const compactCurrencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

const percentFormatter = new Intl.NumberFormat("en-US", {
  style: "percent",
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});

export const formatCurrency = (value: number): string =>
  currencyFormatter.format(value);

export const formatCompactCurrency = (value: number): string =>
  compactCurrencyFormatter.format(value);

export const formatPercent = (value: number): string =>
  percentFormatter.format(value);

export const formatMonthLabel = (label: string): string => label;

export const formatDateLabel = (isoDate: string): string => {
  const date = new Date(isoDate);
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(date);
};
