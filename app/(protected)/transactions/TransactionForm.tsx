"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@budget/components/UI/Button";
import CurrencyInput from "@budget/components/CurrencyInput";
import { joinClassNames } from "@budget/lib/helpers";

type TransactionType = "EXPENSE" | "INCOME" | "TRANSFER";

export type CategoryOption = {
  id: string;
  name: string;
  emoji: string;
  section: string;
};

export type BudgetSnapshot = Record<
  string,
  {
    planned: number;
    spent: number;
  }
>;

type SplitState = {
  id: string;
  categoryId: string;
  amount: string;
  memo: string;
};

export type TransactionFormState = {
  occurredOn: string;
  postedOn: string | null;
  merchant: string;
  description: string;
  memo: string;
  amount: string;
  type: TransactionType;
  splits: SplitState[];
};

export type TransactionFormSubmitPayload = {
  occurredOn: string;
  postedOn?: string | null;
  merchant: string;
  description: string;
  memo?: string;
  amount: number;
  type: TransactionType;
  splits: Array<{
    categoryId: string;
    amount: number;
    memo?: string;
  }>;
};

type TransactionFormProps = {
  categories: CategoryOption[];
  budgetByCategory: BudgetSnapshot;
  defaultCategoryId: string;
  onSubmit: (payload: TransactionFormSubmitPayload) => Promise<void>;
  submitLabel: string;
  initialState?: Partial<TransactionFormState>;
  submitting?: boolean;
  onCancel?: () => void;
  showCancel?: boolean;
  onCreateCategory?: () => Promise<CategoryOption | null>;
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);

const createSplit = (categoryId: string): SplitState => ({
  id:
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `split-${Math.random().toString(36).slice(2, 10)}`,
  categoryId,
  amount: "0",
  memo: "",
});

const groupCategories = (categories: CategoryOption[]) => {
  return categories.reduce<Record<string, CategoryOption[]>>(
    (acc, category) => {
      if (!acc[category.section]) {
        acc[category.section] = [];
      }
      acc[category.section].push(category);
      return acc;
    },
    {}
  );
};

export default function TransactionForm({
  categories,
  budgetByCategory,
  defaultCategoryId,
  onSubmit,
  submitLabel,
  initialState,
  submitting = false,
  onCancel,
  showCancel,
  onCreateCategory,
}: TransactionFormProps) {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const [state, setState] = useState<TransactionFormState>(() => {
    const base: TransactionFormState = {
      occurredOn: initialState?.occurredOn ?? today,
      postedOn: initialState?.postedOn ?? null,
      merchant: initialState?.merchant ?? "",
      description: initialState?.description ?? "",
      memo: initialState?.memo ?? "",
      amount: initialState?.amount ?? "0",
      type: initialState?.type ?? "EXPENSE",
      splits:
        initialState?.splits && initialState.splits.length > 0
          ? initialState.splits
          : [createSplit(defaultCategoryId)],
    };

    if (!initialState?.splits?.length) {
      base.splits[0].categoryId = defaultCategoryId;
      base.splits[0].amount = initialState?.amount ?? "0";
    }

    return base;
  });

  const [feedback, setFeedback] = useState<string | null>(null);
  const [merchantSuggestions, setMerchantSuggestions] = useState<string[]>([]);
  const [isFetchingMerchant, setIsFetchingMerchant] = useState(false);
  const [showMerchantDropdown, setShowMerchantDropdown] = useState(false);

  const categoryGroups = useMemo(
    () => groupCategories(categories),
    [categories]
  );

  const totalAmount = useMemo(() => {
    const parsed = Number.parseFloat(state.amount ?? "0");
    return Number.isFinite(parsed) ? parsed : 0;
  }, [state.amount]);

  const splitTotal = useMemo(() => {
    return state.splits.reduce((sum, split) => {
      const parsed = Number.parseFloat(split.amount || "0");
      return sum + (Number.isFinite(parsed) ? parsed : 0);
    }, 0);
  }, [state.splits]);

  const remaining = useMemo(
    () => Number((totalAmount - splitTotal).toFixed(2)),
    [totalAmount, splitTotal]
  );

  useEffect(() => {
    if (!state.merchant || state.merchant.length < 2) {
      setMerchantSuggestions([]);
      return;
    }

    let isCancelled = false;
    const controller = new AbortController();

    const fetchSuggestions = async () => {
      setIsFetchingMerchant(true);
      try {
        const response = await fetch(
          `/api/yelp/autocomplete?text=${encodeURIComponent(state.merchant)}`,
          { signal: controller.signal }
        );
        if (!response.ok) {
          throw new Error("Unable to fetch suggestions");
        }
        const payload = await response.json();
        if (!isCancelled) {
          const terms: string[] = [
            ...(payload.terms?.map((item: { text: string }) => item.text) ??
              []),
            ...(payload.businesses?.map(
              (item: { name: string }) => item.name
            ) ?? []),
            ...(payload.categories?.map(
              (item: { title: string }) => item.title
            ) ?? []),
          ];
          const unique = Array.from(new Set(terms.slice(0, 6)));
          setMerchantSuggestions(unique);
        }
      } catch (error) {
        if (!isCancelled) {
          console.error("Merchant autocomplete failed", error);
          setMerchantSuggestions([]);
        }
      } finally {
        if (!isCancelled) {
          setIsFetchingMerchant(false);
        }
      }
    };

    const debounce = window.setTimeout(fetchSuggestions, 250);

    return () => {
      isCancelled = true;
      controller.abort();
      window.clearTimeout(debounce);
    };
  }, [state.merchant]);

  const updateSplit = useCallback(
    (splitId: string, updates: Partial<SplitState>) => {
      setState((prev) => ({
        ...prev,
        splits: prev.splits.map((split) =>
          split.id === splitId
            ? {
                ...split,
                ...updates,
              }
            : split
        ),
      }));
    },
    []
  );

  const removeSplit = useCallback((splitId: string) => {
    setState((prev) => ({
      ...prev,
      splits: prev.splits.filter((split) => split.id !== splitId),
    }));
  }, []);

  const addSplit = useCallback(() => {
    setState((prev) => ({
      ...prev,
      splits: [...prev.splits, createSplit(defaultCategoryId)],
    }));
  }, [defaultCategoryId]);

  const handleSubmit = useCallback(async () => {
    setFeedback(null);
    const amountNumber = Number.parseFloat(state.amount || "0");
    if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
      setFeedback("Enter a valid amount greater than zero");
      return;
    }

    if (state.splits.length === 0) {
      setFeedback("Add at least one category split");
      return;
    }

    const splits = state.splits.map((split) => ({
      categoryId: split.categoryId,
      amount: Number.parseFloat(split.amount || "0"),
      memo: split.memo?.trim() || undefined,
    }));

    if (splits.some((split) => !split.categoryId)) {
      setFeedback("Each split needs a category");
      return;
    }

    if (
      splits.some((split) => !Number.isFinite(split.amount) || split.amount < 0)
    ) {
      setFeedback("Split amounts must be valid numbers");
      return;
    }

    const totalSplits = splits.reduce((sum, split) => sum + split.amount, 0);
    if (Math.abs(totalSplits - amountNumber) > 0.01) {
      setFeedback("Split amounts need to equal the total amount");
      return;
    }

    await onSubmit({
      occurredOn: state.occurredOn,
      postedOn: state.postedOn,
      merchant: state.merchant.trim(),
      description: state.description.trim(),
      memo: state.memo.trim() || undefined,
      amount: amountNumber,
      type: state.type,
      splits,
    });
  }, [onSubmit, state]);

  useEffect(() => {
    if (state.splits.length === 1) {
      const [first] = state.splits;
      if (first.amount !== state.amount) {
        updateSplit(first.id, {
          amount: state.amount,
        });
      }
    }
  }, [state.amount, state.splits, updateSplit]);

  return (
    <form
      className="space-y-6 rounded-3xl border border-emerald-200/40 bg-white/80 p-6 shadow-[0_20px_45px_rgba(16,185,129,0.12)] backdrop-blur"
      onSubmit={(event) => {
        event.preventDefault();
        void handleSubmit();
      }}
    >
      <header className="space-y-1">
        <h3 className="text-lg font-semibold tracking-tight">
          Add a Manual Transaction
        </h3>
        <p className="text-sm text-emerald-900/70">
          Capture cash purchases or anything that hasn’t synced yet.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1">
          <label className="text-sm font-medium text-emerald-950">
            Merchant
          </label>
          <div className="relative">
            <input
              type="text"
              value={state.merchant}
              onFocus={() => setShowMerchantDropdown(true)}
              onBlur={() =>
                setTimeout(() => setShowMerchantDropdown(false), 100)
              }
              onChange={(event) => {
                setShowMerchantDropdown(true);
                setState((prev) => ({
                  ...prev,
                  merchant: event.target.value,
                }));
              }}
              placeholder="Who did you pay?"
              className="w-full rounded-2xl border border-emerald-200/60 bg-white px-4 py-2 text-sm font-medium shadow-inner focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200"
            />
            {showMerchantDropdown && merchantSuggestions.length > 0 && (
              <div
                className="absolute z-[5] mt-1 w-full rounded-2xl border border-emerald-100 bg-white py-2 shadow-xl"
                onMouseDown={(e) => e.preventDefault()} // prevents input blur before click
              >
                {merchantSuggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => {
                      setState((prev) => ({
                        ...prev,
                        merchant: suggestion,
                      }));
                      setShowMerchantDropdown(false);
                    }}
                    className="flex w-full items-center justify-between px-4 py-1.5 text-left text-sm text-emerald-900 hover:bg-emerald-50"
                  >
                    <span>{suggestion}</span>
                  </button>
                ))}
              </div>
            )}
            {isFetchingMerchant ? (
              <span className="absolute right-3 top-2.5 text-xs text-emerald-500">
                searching…
              </span>
            ) : null}
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-emerald-950">
            Description
          </label>
          <input
            type="text"
            value={state.description}
            onChange={(event) =>
              setState((prev) => ({
                ...prev,
                description: event.target.value,
              }))
            }
            placeholder="Optional note that will show on the ledger"
            className="w-full rounded-2xl border border-emerald-200/60 bg-white px-4 py-2 text-sm font-medium shadow-inner focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-emerald-950">
            Occurred On
          </label>
          <input
            type="date"
            value={state.occurredOn}
            onChange={(event) =>
              setState((prev) => ({
                ...prev,
                occurredOn: event.target.value,
              }))
            }
            className="w-full rounded-2xl border border-emerald-200/60 bg-white px-4 py-2 text-sm font-medium shadow-inner focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-emerald-950">
            Posted On
          </label>
          <input
            type="date"
            value={state.postedOn ?? ""}
            onChange={(event) =>
              setState((prev) => ({
                ...prev,
                postedOn: event.target.value || null,
              }))
            }
            className="w-full rounded-2xl border border-emerald-200/60 bg-white px-4 py-2 text-sm font-medium shadow-inner focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-emerald-950">Amount</label>
          <CurrencyInput
            value={state.amount}
            onValueChange={(value) =>
              setState((prev) => ({
                ...prev,
                amount: value ?? "0",
              }))
            }
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-emerald-950">Type</label>
          <div className="flex rounded-2xl border border-emerald-200 bg-white p-1 text-sm font-semibold shadow-inner">
            {["EXPENSE", "INCOME"].map((type) => (
              <button
                key={type}
                type="button"
                onClick={() =>
                  setState((prev) => ({
                    ...prev,
                    type: type as TransactionType,
                  }))
                }
                className={joinClassNames(
                  "flex-1 rounded-2xl px-3 py-2 transition",
                  state.type === type
                    ? "bg-emerald-500 text-white shadow"
                    : "text-emerald-600 hover:bg-emerald-50"
                )}
              >
                {type === "EXPENSE" ? "Expense" : "Income"}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wide text-emerald-900/70">
              Category Splits
            </h4>
            <p className="text-xs text-emerald-900/70">
              Split this transaction across multiple envelopes if needed.
            </p>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={addSplit}
          >
            Add Split
          </Button>
        </div>

        <div className="space-y-3">
          {state.splits.map((split) => {
            const budget = budgetByCategory[split.categoryId];
            const amountNumber = Number.parseFloat(split.amount || "0");
            const currentSpent = budget?.spent ?? 0;
            const planned = budget?.planned ?? 0;
            const remainingBudget = planned - currentSpent;
            const remainingAfter = remainingBudget - amountNumber;

            return (
              <div
                key={split.id}
                className="rounded-2xl border border-emerald-100 bg-emerald-50/60 px-4 py-3 shadow-inner"
              >
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex flex-1 flex-col gap-1">
                    <label className="text-xs font-semibold uppercase text-emerald-900/70">
                      Category
                    </label>
                    <select
                      value={split.categoryId}
                      onChange={async (event) => {
                        const value = event.target.value;
                        if (value === "__new__") {
                          if (onCreateCategory) {
                            const created = await onCreateCategory();
                            if (created) {
                              updateSplit(split.id, {
                                categoryId: created.id,
                              });
                            }
                          }
                          event.target.value = split.categoryId;
                          return;
                        }
                        updateSplit(split.id, { categoryId: value });
                      }}
                      className="w-full rounded-2xl border border-emerald-200 bg-white px-3 py-2 text-sm font-medium text-emerald-900 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                    >
                      {Object.entries(categoryGroups).map(([section, list]) => (
                        <optgroup key={section} label={section}>
                          {list.map((category) => (
                            <option key={category.id} value={category.id}>
                              {category.emoji} {category.name}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                      <option value="__new__">➕ New category…</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold uppercase text-emerald-900/70">
                      Amount
                    </label>
                    <CurrencyInput
                      value={split.amount}
                      onValueChange={(value) =>
                        updateSplit(split.id, { amount: value ?? "0" })
                      }
                    />
                  </div>
                  <div className="flex flex-1 flex-col gap-1">
                    <label className="text-xs font-semibold uppercase text-emerald-900/70">
                      Memo
                    </label>
                    <input
                      type="text"
                      value={split.memo}
                      onChange={(event) =>
                        updateSplit(split.id, { memo: event.target.value })
                      }
                      placeholder="Optional"
                      className="w-full rounded-2xl border border-emerald-200 bg-white px-3 py-2 text-sm font-medium text-emerald-900 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                    />
                  </div>

                  {state.splits.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => removeSplit(split.id)}
                      className="self-start rounded-full border border-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-600 hover:bg-emerald-100"
                    >
                      Remove
                    </button>
                  ) : null}
                </div>

                <p className="mt-2 text-xs text-emerald-900/70">
                  {budget ? (
                    <>
                      {formatCurrency(currentSpent)} spent of{" "}
                      {formatCurrency(planned)}. Left now{" "}
                      {formatCurrency(Math.max(remainingBudget, 0))}, after
                      split{" "}
                      <span
                        className={
                          remainingAfter >= 0
                            ? "text-emerald-600"
                            : "text-rose-600"
                        }
                      >
                        {formatCurrency(remainingAfter)}
                      </span>
                      .
                    </>
                  ) : (
                    <>No budget set for this category yet.</>
                  )}
                </p>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between text-sm font-medium text-emerald-900">
          <span>
            Split total: {formatCurrency(splitTotal)} of{" "}
            {formatCurrency(totalAmount)}
          </span>
          <span
            className={remaining === 0 ? "text-emerald-600" : "text-rose-600"}
          >
            Remaining {formatCurrency(remaining)}
          </span>
        </div>
      </section>

      <section className="space-y-1">
        <label className="text-sm font-medium text-emerald-950">Memo</label>
        <textarea
          value={state.memo}
          onChange={(event) =>
            setState((prev) => ({
              ...prev,
              memo: event.target.value,
            }))
          }
          rows={3}
          placeholder="Optional internal note that doesn’t display on exports"
          className="w-full rounded-2xl border border-emerald-200/60 bg-white px-4 py-2 text-sm font-medium shadow-inner focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200"
        />
      </section>

      {feedback ? (
        <p className="rounded-2xl border border-rose-200/80 bg-rose-50/70 px-4 py-3 text-sm text-rose-800 shadow-inner">
          {feedback}
        </p>
      ) : null}

      <footer className="flex flex-wrap items-center justify-end gap-3">
        {showCancel && onCancel ? (
          <Button type="button" variant="ghost" onClick={() => onCancel?.()}>
            Cancel
          </Button>
        ) : null}
        <Button type="submit" loading={submitting} loadingText="Saving…">
          {submitLabel}
        </Button>
      </footer>
    </form>
  );
}
