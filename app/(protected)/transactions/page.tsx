"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Transition } from "@headlessui/react";
import { type ToastProps } from "@budget/components/UI/ToastUI";
import Toast from "@budget/components/Toast";
import { Button } from "@budget/components/UI/Button";
import ManualTransactionFormContainer from "./ManualTransactionFormContainer";
import { mapCategoryToOption } from "./formHelpers";
import type {
  ApiTransaction,
  BudgetSnapshot,
  CategoryOption,
  TransactionFormSubmitPayload,
  TransactionOrigin,
} from "./types";
import { getMonthKey, parseMonthKey } from "@budget/lib/transactions";
import Modal from "@budget/components/Modal";
import {
  useCache,
  useBudgetByMonth,
  useCategoryCache,
} from "@budget/app/hooks/useCache";
import type { CategorySection } from "@budget/app/providers/CacheProvider";

type ImportSummary = {
  imported: number;
  duplicates: number;
  skipped: number;
  errors: Array<{ row: number; message: string }>;
};

type MerchantResolution = {
  normalizedKey: string;
  suggestedName: string;
  rawNames: string[];
};

type ImportResponsePayload = {
  summary: ImportSummary & { pendingMerchants?: number };
  merchantResolutions?: MerchantResolution[];
};

type MerchantSuggestion = {
  id: string;
  canonicalName: string;
};

const monthFormatter = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
});

const dayFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const formatCurrency = (value: number) => currencyFormatter.format(value);

const formatTransactionOrigin = (origin: TransactionOrigin) => {
  switch (origin) {
    case "IMPORT":
      return "Imported";
    case "ADJUSTMENT":
      return "Adjustment";
    case "MANUAL":
    default:
      return "Manual";
  }
};

export default function TransactionsPage() {
  const { actions } = useCache();
  const [month, setMonth] = useState(() => getMonthKey(new Date()));
  const [transactions, setTransactions] = useState<ApiTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [toasts, setToasts] = useState<ToastProps[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [createInFlight, setCreateInFlight] = useState(false);
  const [editingTransaction, setEditingTransaction] =
    useState<ApiTransaction | null>(null);
  const [editInFlight, setEditInFlight] = useState(false);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [categoryForm, setCategoryForm] = useState({
    name: "",
    section: "EXPENSES",
  });
  const [categorySaving, setCategorySaving] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [deleteState, setDeleteState] = useState<{
    isOpen: boolean;
    amount: number;
    merchant: string;
    transactionId: string;
    occurredOn: string;
    isDeleting?: boolean;
  }>({
    transactionId: "",
    isOpen: false,
    amount: 0,
    merchant: "",
    occurredOn: "",
    isDeleting: false,
  });
  const [createFormKey, setCreateFormKey] = useState(0);
  const pendingCategoryResolver = useRef<
    ((value: CategoryOption | null) => void) | undefined
  >(undefined);
  const [isDragging, setIsDragging] = useState(false);
  const [isWrongExtension, setIsWrongExtension] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [merchantResolutionQueue, setMerchantResolutionQueue] = useState<
    MerchantResolution[]
  >([]);
  const [isResolutionModalOpen, setIsResolutionModalOpen] = useState(false);
  const [isResolvingMerchant, setIsResolvingMerchant] = useState(false);

  const {
    categoriesList: categoryRecords,
    refreshCategories,
    hasHydrated: categoriesHydrated,
    isRefreshing: categoriesRefreshing,
  } = useCategoryCache();
  const hasRequestedCategoryRefresh = useRef(false);
  const categories = useMemo(
    () => categoryRecords.map(mapCategoryToOption),
    [categoryRecords]
  );

  useEffect(() => {
    if (categoriesHydrated || categoriesRefreshing) return;
    if (hasRequestedCategoryRefresh.current) return;
    hasRequestedCategoryRefresh.current = true;
    void refreshCategories().catch((error) => {
      console.warn("Failed to refresh categories", error);
      hasRequestedCategoryRefresh.current = false;
    });
  }, [categoriesHydrated, categoriesRefreshing, refreshCategories]);

  useEffect(() => {
    if (merchantResolutionQueue.length === 0) {
      setIsResolutionModalOpen(false);
    }
  }, [merchantResolutionQueue]);

  const ensuredBudgetMonths = useRef<Set<string>>(new Set());
  const ensureBudget = actions.budgets.ensure;
  const categoryActions = actions.categories;
  const budgetSnapshot = useBudgetByMonth(month);

  useEffect(() => {
    if (budgetSnapshot) return;
    if (ensuredBudgetMonths.current.has(month)) return;
    ensuredBudgetMonths.current.add(month);
    void ensureBudget(month).catch((error) => {
      console.warn("Failed to ensure budget snapshot", error);
      ensuredBudgetMonths.current.delete(month);
    });
  }, [budgetSnapshot, ensureBudget, month]);

  const budgetByCategory = useMemo(() => {
    const snapshot: BudgetSnapshot = {};
    if (!budgetSnapshot) return snapshot;
    for (const sectionEntries of Object.values(budgetSnapshot.sections)) {
      for (const allocation of sectionEntries) {
        snapshot[allocation.categoryId] = {
          planned: allocation.planned ?? 0,
          spent: allocation.spent ?? 0,
        };
      }
    }
    return snapshot;
  }, [budgetSnapshot]);

  const pushToast = useCallback(
    (toast: Omit<ToastProps, "id"> & { id?: string }) => {
      const id =
        toast.id ??
        (typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `toast-${Math.random().toString(36).slice(2, 10)}`);
      setToasts((prev) => [{ id, ...toast }, ...prev]);
    },
    []
  );

  const fetchTransactions = useCallback(
    async (options?: { silent?: boolean }) => {
      if (options?.silent) {
        setIsRefreshing(true);
      } else {
        setLoading(true);
      }

      try {
        const params = new URLSearchParams();
        if (month) params.set("month", month);
        if (debouncedSearch) params.set("search", debouncedSearch);

        const response = await fetch(`/api/transactions?${params.toString()}`, {
          cache: "no-store",
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.error ?? "Unable to load transactions");
        }

        const payload = await response.json();
        const next = payload.transactions ?? [];
        setTransactions((prev) => {
          if (next.length === 0) {
            return prev;
          }

          const nextIds = new Set(
            next.map((transaction: { id: string }) => transaction.id)
          );
          const combined = [...next];

          for (const transaction of prev) {
            if (!nextIds.has(transaction.id)) {
              combined.push(transaction);
            }
          }

          return combined;
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unexpected error";
        pushToast({
          title: "Couldn't load transactions",
          description: message,
          variant: "danger",
        });
      } finally {
        if (options?.silent) {
          setIsRefreshing(false);
        } else {
          setLoading(false);
        }
      }
    },
    [debouncedSearch, month, pushToast]
  );

  const handleImportModalClosing = () => {
    setIsWrongExtension(false);
    setIsImportModalOpen(false);
  };

  const fetchMerchantSuggestions = useCallback(
    async (query: string): Promise<MerchantSuggestion[]> => {
      const trimmed = query.trim();
      if (!trimmed) return [];
      try {
        const response = await fetch(
          `/api/merchants?q=${encodeURIComponent(trimmed)}`,
          { cache: "no-store" }
        );
        if (!response.ok) {
          return [];
        }
        const payload = await response.json().catch(() => ({ merchants: [] }));
        return payload.merchants ?? [];
      } catch (error) {
        console.warn("Failed to load merchant suggestions", error);
        return [];
      }
    },
    []
  );

  const resolveMerchant = useCallback(
    async (normalizedKey: string, canonicalName: string, rawName: string) => {
      setIsResolvingMerchant(true);
      try {
        const response = await fetch("/api/merchants/resolve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            normalizedKey,
            canonicalName,
            rawName,
          }),
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.error ?? "Unable to resolve merchant");
        }

        setMerchantResolutionQueue((prev) =>
          prev.filter((item) => item.normalizedKey !== normalizedKey)
        );

        pushToast({
          title: "Merchant saved",
          description: `${canonicalName} will be used next time`,
          variant: "success",
        });

        await fetchTransactions({ silent: true });
      } catch (error) {
        pushToast({
          title: "Couldn't save merchant",
          description:
            error instanceof Error ? error.message : "Unexpected error",
          variant: "danger",
        });
        throw error;
      } finally {
        setIsResolvingMerchant(false);
      }
    },
    [fetchTransactions, pushToast]
  );

  const dismissToast = useCallback((id?: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchTerm.trim());
    }, 300);

    return () => window.clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    void fetchTransactions();
  }, [fetchTransactions]);

  const handleMonthShift = useCallback(
    (direction: -1 | 1) => {
      const parsed = parseMonthKey(month);
      const base = parsed ?? new Date();
      const shifted = new Date(
        base.getFullYear(),
        base.getMonth() + direction,
        1
      );
      setMonth(getMonthKey(shifted));
    },
    [month]
  );

  const openFilePicker = () => {
    fileInputRef.current?.click();
  };

  const handleFileInputChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];

    if (file?.type === "text/csv") {
      void handleImportFile(file);
      setIsWrongExtension(false);
    } else {
      setIsWrongExtension(true);
    }
  };

  const handleManualSubmit = useCallback(
    async (payload: TransactionFormSubmitPayload) => {
      setCreateInFlight(true);
      try {
        const response = await fetch("/api/transactions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(body.error ?? "Unable to save transaction");
        }

        pushToast({
          title: "Transaction saved",
          description: "We added that to your ledger",
          variant: "success",
        });

        setIsCreateModalOpen(false);
        setCreateFormKey((prev) => prev + 1);

        await fetchTransactions({ silent: true });
      } catch (error) {
        pushToast({
          title: "Couldn’t save transaction",
          description:
            error instanceof Error ? error.message : "Unexpected error",
          variant: "danger",
        });
      } finally {
        setCreateInFlight(false);
      }
    },
    [fetchTransactions, pushToast]
  );

  const handleDeletManualTransaction = useCallback(
    async (transactionId: string) => {
      setDeleteState((prevState) => ({ ...prevState, isDeleting: true }));
      try {
        const response = await fetch(`/api/transactions/${transactionId}`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
        });

        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(body.error ?? "Unable to save transaction");
        }

        pushToast({
          title: "Transaction deleted",
          variant: "success",
        });

        await fetchTransactions({ silent: true });
      } catch (error) {
        pushToast({
          title: "Couldn't delete transaction",
          description:
            error instanceof Error ? error.message : "Unexpected error",
          variant: "danger",
        });
      } finally {
        setDeleteState({
          isOpen: false,
          amount: 0,
          merchant: "",
          transactionId: "",
          occurredOn: "",
          isDeleting: false,
        });
      }
    },
    [fetchTransactions, pushToast]
  );

  const handleImportFile = useCallback(
    async (file: File) => {
      setIsImporting(true);
      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("source", "csv-upload");

        const response = await fetch("/api/transactions/import", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.error ?? "Unable to import file");
        }

        setIsImportModalOpen(false);

        const payload: ImportResponsePayload = await response.json();
        const { summary, merchantResolutions } = payload;

        pushToast({
          title: `Imported ${summary.imported} transactions`,
          description: summary.duplicates
            ? `${summary.duplicates} duplicates ignored`
            : summary.skipped
            ? `${summary.skipped} rows skipped`
            : summary.pendingMerchants
            ? `${summary.pendingMerchants} merchant${
                summary.pendingMerchants === 1 ? "" : "s"
              } need review`
            : undefined,
          variant: "success",
        });

        if (summary.errors.length) {
          pushToast({
            title: "Some rows had issues",
            description: summary.errors
              .slice(0, 3)
              .map((item) => `Row ${item.row}: ${item.message}`)
              .join(" • "),
            variant: "warning",
          });
        }

        if (merchantResolutions?.length) {
          setMerchantResolutionQueue(merchantResolutions);
          setIsResolutionModalOpen(true);
        } else {
          setMerchantResolutionQueue([]);
        }

        await fetchTransactions({ silent: true });
      } catch (error) {
        pushToast({
          title: "Import failed",
          description:
            error instanceof Error ? error.message : "Unexpected error",
          variant: "danger",
        });
      } finally {
        setIsImporting(false);
      }
    },
    [fetchTransactions, pushToast]
  );

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file?.type === "text/csv") {
      void handleImportFile(file);
      setIsWrongExtension(false);
    } else {
      setIsWrongExtension(true);
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(true);
    event.dataTransfer.dropEffect = "copy";
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
    const nextTarget = event.relatedTarget as Node | null;
    if (nextTarget && event.currentTarget.contains(nextTarget)) {
      return;
    }
  };

  const handleDragEnd = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
  };

  const requestCategoryCreation = useCallback(() => {
    return new Promise<CategoryOption | null>((resolve) => {
      pendingCategoryResolver.current = resolve;
      setCategoryForm({ name: "", section: "EXPENSES" });
      setCategoryModalOpen(true);
    });
  }, []);

  const handleCategoryModalClose = useCallback(() => {
    setCategoryModalOpen(false);
    pendingCategoryResolver.current?.(null);
    pendingCategoryResolver.current = undefined;
  }, []);

  const handleCategorySubmit = useCallback(async () => {
    if (!categoryForm.name.trim()) {
      pushToast({
        title: "Category name is required",
        variant: "warning",
      });
      return;
    }

    setCategorySaving(true);
    try {
      const createdCategory = await categoryActions.create({
        name: categoryForm.name.trim(),
        section: categoryForm.section as CategorySection,
      });

      const created = mapCategoryToOption(createdCategory);

      pendingCategoryResolver.current?.(created);
      pendingCategoryResolver.current = undefined;
      setCategoryModalOpen(false);

      pushToast({
        title: "Category created",
        description: created.name,
        variant: "success",
      });
    } catch (error) {
      pushToast({
        title: "Couldn’t create category",
        description:
          error instanceof Error ? error.message : "Unexpected error",
        variant: "danger",
      });
    } finally {
      setCategorySaving(false);
    }
  }, [categoryActions, categoryForm, pushToast]);

  const handleTransactionEdit = useCallback((transaction: ApiTransaction) => {
    setEditingTransaction(transaction);
  }, []);

  const handleEditSubmit = useCallback(
    async (transactionId: string, payload: TransactionFormSubmitPayload) => {
      setEditInFlight(true);
      try {
        const response = await fetch(`/api/transactions/${transactionId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            occurredOn: payload.occurredOn,

            amount: payload.amount,
            type: payload.type,
            merchant: payload.merchant,
            description: payload.description,
            memo: payload.memo,
            splits: payload.splits,
          }),
        });

        const body = await response.json().catch(() => null);

        if (!response.ok || !body?.transaction) {
          throw new Error(body?.error ?? "Unable to update transaction");
        }

        const updatedTransaction = body.transaction as ApiTransaction;

        setTransactions((previous) => {
          const exists = previous.some(
            (transaction) => transaction.id === updatedTransaction.id
          );

          if (!exists) {
            return [updatedTransaction, ...previous];
          }

          return previous.map((transaction) =>
            transaction.id === updatedTransaction.id
              ? updatedTransaction
              : transaction
          );
        });

        pushToast({
          title: "Transaction updated",
          variant: "success",
        });

        setEditingTransaction(null);
      } catch (error) {
        pushToast({
          title: "Update failed",
          description:
            error instanceof Error ? error.message : "Unexpected error",
          variant: "danger",
        });
      } finally {
        setEditInFlight(false);
      }
    },
    [pushToast]
  );

  const currentMonthLabel = useMemo(() => {
    const parsed = parseMonthKey(month);
    return monthFormatter.format(parsed ?? new Date());
  }, [month]);

  const filteredTransactions = transactions;

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-emerald-950">
            Transactions
          </h1>
          <p className="text-sm text-emerald-900/70">
            Review, split, and categorize everything in one place. Imported and
            manual entries stay in sync with your budget.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-white px-3 py-2 shadow-sm">
            <button
              type="button"
              onClick={() => handleMonthShift(-1)}
              className="rounded-full p-1 text-emerald-600 transition hover:bg-emerald-100"
              aria-label="Previous month"
            >
              ‹
            </button>
            <span className="text-sm font-semibold text-emerald-950">
              {currentMonthLabel}
            </span>
            <button
              type="button"
              onClick={() => handleMonthShift(1)}
              className="rounded-full p-1 text-emerald-600 transition hover:bg-emerald-100"
              aria-label="Next month"
            >
              ›
            </button>
          </div>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-2.5 text-emerald-500">
              🔍
            </span>
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search by merchant, amount, or date"
              className="w-64 rounded-2xl border border-emerald-200 bg-white pl-8 pr-3 py-2 text-sm shadow-inner focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200"
            />
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={() => setIsCreateModalOpen(true)}>
              Add manual transaction
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsImportModalOpen(true)}
            >
              Import CSV
            </Button>
          </div>
        </div>
      </header>
      <section className="rounded-3xl border border-emerald-200/50 bg-white/80 p-5 shadow-[0_16px_42px_rgba(16,185,129,0.08)] backdrop-blur">
        <h2 className="text-base font-semibold text-emerald-950">
          Quick actions
        </h2>
        <p className="mt-1 text-sm text-emerald-900/70">
          Use the controls above to add manual activity or import a CSV. We
          deduplicate files automatically and run your categorization rules on
          every import.
        </p>
      </section>
      <section className="rounded-3xl border border-emerald-200/60 bg-white/85 shadow-[0_20px_45px_rgba(16,185,129,0.14)] backdrop-blur">
        <div className="flex items-center justify-between border-b border-emerald-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-emerald-950">Ledger</h2>
            <p className="text-xs text-emerald-900/70">
              {loading
                ? "Loading transactions…"
                : filteredTransactions.length === 0
                ? "No transactions match this view yet"
                : `${filteredTransactions.length} transaction${
                    filteredTransactions.length === 1 ? "" : "s"
                  }`}
            </p>
          </div>
          {isRefreshing ? (
            <span className="text-xs text-emerald-500">Refreshing…</span>
          ) : null}
        </div>
        <div className="divide-y divide-emerald-100">
          {loading ? (
            <div className="space-y-2 px-6 py-6">
              {Array.from({ length: 5 }).map((_, index) => (
                <div
                  key={index}
                  className="h-12 animate-pulse rounded-2xl bg-emerald-100/40"
                />
              ))}
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-emerald-900/70">
              Start by importing a CSV or adding a manual transaction for this
              month.
            </div>
          ) : (
            filteredTransactions.map((transaction) => {
              const occurredDate = dayFormatter.format(
                new Date(`${transaction.occurredOn}T00:00:00`)
              );
              const amountClass =
                transaction.type === "INCOME"
                  ? "text-emerald-600"
                  : transaction.type === "EXPENSE"
                  ? "text-rose-600"
                  : "text-emerald-900";
              const splits = transaction.splits.length
                ? transaction.splits
                : [
                    {
                      id: `${transaction.id}-default`,
                      amount: transaction.amount,
                      memo: transaction.memo,
                      category:
                        transaction.categoryId && categories.length
                          ? categories.find(
                              (category) =>
                                category.id === transaction.categoryId
                            ) ?? null
                          : null,
                    },
                  ];
              const transactionOrigin = formatTransactionOrigin(
                transaction.origin
              );

              return (
                <article
                  key={transaction.id}
                  className="flex flex-col gap-3 px-6 py-4 transition hover:bg-emerald-50/40"
                >
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="flex flex-col text-sm">
                      <span className="font-semibold text-emerald-950">
                        {transaction.merchantName || "No merchant"}
                      </span>
                      <span className="text-xs text-emerald-900/60">
                        {transaction.description || "No description"}
                      </span>
                    </div>
                    <div className="ml-auto text-sm font-semibold">
                      <span className={amountClass}>
                        {transaction.type === "INCOME" ? "" : "-"}
                        {formatCurrency(transaction.amount)}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-emerald-900/70">
                    <span>{occurredDate}</span>
                    <span className="rounded-full bg-emerald-100 px-2 py-1 text-emerald-600">
                      {transactionOrigin}
                    </span>
                    {transaction.importBatchId ? (
                      <span className="rounded-full bg-sky-100 px-2 py-1 text-sky-600">
                        Batch {transaction.importBatchId.slice(0, 5)}
                      </span>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {splits.map((split) => (
                      <span
                        key={split.id}
                        className="inline-flex items-center gap-2 rounded-full bg-emerald-100/80 px-3 py-1 text-xs font-medium text-emerald-900"
                      >
                        <span>
                          {split.category
                            ? `${split.category.emoji} ${split.category.name}`
                            : "Uncategorized"}
                        </span>
                        <span className="rounded-full bg-white/80 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                          {formatCurrency(split.amount)}
                        </span>
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-emerald-900/60">
                    {transaction.memo ? (
                      <span className="italic">“{transaction.memo}”</span>
                    ) : null}
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => handleTransactionEdit(transaction)}
                    >
                      Edit
                    </Button>

                    {transactionOrigin?.toLowerCase() === "manual" ? (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() =>
                          setDeleteState({
                            isOpen: true,
                            amount: transaction.amount,
                            merchant: transaction.merchantName,
                            occurredOn: transaction.occurredOn,
                            transactionId: transaction.id,
                          })
                        }
                      >
                        Delete
                      </Button>
                    ) : (
                      ""
                    )}
                  </div>
                </article>
              );
            })
          )}
        </div>
      </section>

      <Modal
        isOpen={deleteState.isOpen}
        onClose={() => {
          setDeleteState({
            isOpen: false,
            amount: 0,
            merchant: "",
            transactionId: "",
            occurredOn: "",
          });
        }}
        showCancel
        title="Delete Transaction"
        onSave={() => {
          void handleDeletManualTransaction(deleteState.transactionId);
        }}
        saveVariant="destructive"
        isSaving={deleteState.isDeleting}
        saveText="Yes, Delete 💣"
        loadingText="Deleting..."
      >
        <p className="text-m text-emerald-900/70">
          Are you sure you want to delete this manual transaction?{" "}
          <span style={{ fontSize: 25 }}>🤨</span>
        </p>
        <div className="space-y-2">
          <p>
            <label className="text-s font-semibold  text-emerald-900/70">
              Merchant:{" "}
            </label>
            <span className="text-s text-emerald-900/70">
              {deleteState.merchant}
            </span>
          </p>

          <p>
            <label className="text-s font-semibold  text-emerald-900/70">
              Amount:{" "}
            </label>
            <span className="text-s text-emerald-900/70">
              ${deleteState.amount}
            </span>
          </p>

          <p>
            <label className="text-s font-semibold  text-emerald-900/70">
              Date:
            </label>
            {deleteState.occurredOn ? (
              <span className="text-s text-emerald-900/70">
                {dayFormatter.format(
                  new Date(`${deleteState.occurredOn}T00:00:00`)
                )}
              </span>
            ) : (
              ""
            )}
          </p>
        </div>
      </Modal>

      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => {
          if (!createInFlight) {
            setIsCreateModalOpen(false);
            setCreateFormKey((prev) => prev + 1);
          }
        }}
        title="Add a Manual Transaction"
      >
        <ManualTransactionFormContainer
          formKey={createFormKey}
          budgetByCategory={budgetByCategory}
          submitting={createInFlight}
          submitLabel="Save transaction"
          onSubmit={handleManualSubmit}
          showCancel
          onCancel={() => {
            setIsCreateModalOpen(false);
            setCreateFormKey((prev) => prev + 1);
          }}
          onCreateCategory={requestCategoryCreation}
        />
      </Modal>

      <Modal
        isOpen={isImportModalOpen}
        onClose={handleImportModalClosing}
        showCancel
        title="Import transactions"
      >
        <p className="text-sm text-emerald-900/70">
          Upload a CSV export from your bank. We&apos;ll skip duplicates and run
          your categorization rules automatically.
        </p>

        <div
          className={`flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed  px-6 py-10 text-center text-sm text-emerald-900/80 transaction ${
            isDragging
              ? "border-emerald-500  bg-emerald-50/90"
              : "border-emerald-200 bg-emerald-50/60"
          }`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDragEnd={handleDragEnd}
        >
          <input
            type="file"
            ref={fileInputRef}
            accept=".csv"
            className="sr-only"
            disabled={isImporting}
            onChange={handleFileInputChange}
          />
          <span className="text-2xl">📁</span>
          <div>
            <p className="font-semibold">Drag a CSV here</p>
            <p className="text-xs text-emerald-900/60">
              Or browse your files to select one
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            loading={isImporting}
            loadingText="Importing…"
            disabled={isImporting}
            onClick={openFilePicker}
          >
            Browse files
          </Button>
        </div>
        <Transition show={isWrongExtension}>
          <p className="font-semibold text-red-700 data-enter:duration-100 data-enter:data-closed:-translate-y-full">
            🙄 That&apos;s not going to work dummy
          </p>
        </Transition>

        <p className="text-xs text-emerald-900/60">
          Need to add a merchant manually? Use the actions menu to create a
          transaction instead.
        </p>
      </Modal>

      <Modal
        isOpen={categoryModalOpen}
        onClose={handleCategoryModalClose}
        title="Add a category"
        showCancel
        onSave={handleCategorySubmit}
        isSaving={categorySaving}
        saveText="Save category"
      >
        <div className="space-y-3 text-sm">
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase text-emerald-900/70">
              Name
            </label>
            <input
              value={categoryForm.name}
              onChange={(event) =>
                setCategoryForm((prev) => ({
                  ...prev,
                  name: event.target.value,
                }))
              }
              className="w-full rounded-2xl border border-emerald-200 bg-white px-3 py-2 text-sm font-medium text-emerald-900 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200"
              placeholder="Groceries"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase text-emerald-900/70">
              Section
            </label>
            <select
              value={categoryForm.section}
              onChange={(event) =>
                setCategoryForm((prev) => ({
                  ...prev,
                  section: event.target.value as CategoryOption["section"],
                }))
              }
              className="w-full rounded-2xl border border-emerald-200 bg-white px-3 py-2 text-sm font-medium text-emerald-900 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200"
            >
              <option value="EXPENSES">Expenses</option>
              <option value="RECURRING">Recurring</option>
              <option value="SAVINGS">Savings</option>
              <option value="DEBT">Debt</option>
            </select>
          </div>
        </div>
      </Modal>

      <MerchantResolutionModal
        isOpen={isResolutionModalOpen && merchantResolutionQueue.length > 0}
        isResolving={isResolvingMerchant}
        merchant={merchantResolutionQueue[0]}
        onResolve={resolveMerchant}
        onCancel={() => {
          setMerchantResolutionQueue([]);
        }}
        fetchSuggestions={fetchMerchantSuggestions}
      />

      <Modal
        isOpen={Boolean(editingTransaction)}
        onClose={() => setEditingTransaction(null)}
        title="Edit a Transaction"
      >
        {editingTransaction ? (
          <ManualTransactionFormContainer
            transaction={editingTransaction}
            budgetByCategory={budgetByCategory}
            submitting={editInFlight}
            submitLabel="Update transaction"
            onSubmit={(payload) =>
              handleEditSubmit(editingTransaction.id, payload)
            }
            showCancel
            onCancel={() => setEditingTransaction(null)}
            onCreateCategory={requestCategoryCreation}
          />
        ) : null}
      </Modal>

      {toasts.map((toast) => (
        <Fragment key={toast.id}>
          <Toast
            title={toast.title}
            description={toast.description}
            variant={toast.variant}
            dismissible
            onDismiss={() => dismissToast(toast.id)}
          />
        </Fragment>
      ))}
    </div>
  );
}
type MerchantResolutionModalProps = {
  isOpen: boolean;
  isResolving: boolean;
  merchant?: MerchantResolution;
  onResolve: (
    normalizedKey: string,
    canonicalName: string,
    rawName: string
  ) => Promise<void>;
  onCancel: () => void;
  fetchSuggestions: (query: string) => Promise<MerchantSuggestion[]>;
};

function MerchantResolutionModal({
  isOpen,
  isResolving,
  merchant,
  onResolve,
  onCancel,
  fetchSuggestions,
}: MerchantResolutionModalProps) {
  const [inputValue, setInputValue] = useState("");
  const [suggestions, setSuggestions] = useState<MerchantSuggestion[]>([]);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && merchant) {
      setInputValue(merchant.suggestedName || "");
      setLocalError(null);
      setSuggestions([]);
    }
  }, [isOpen, merchant]);

  useEffect(() => {
    if (!isOpen || !merchant) {
      return;
    }
    const trimmed = inputValue.trim();
    if (!trimmed) {
      setSuggestions([]);
      return;
    }

    let active = true;
    const timer = window.setTimeout(() => {
      void fetchSuggestions(trimmed)
        .then((results) => {
          if (active) {
            setSuggestions(results);
          }
        })
        .catch(() => {
          if (active) {
            setSuggestions([]);
          }
        });
    }, 250);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [fetchSuggestions, inputValue, isOpen, merchant]);

  if (!merchant) {
    return null;
  }

  const handleSave = async () => {
    const trimmed = inputValue.trim();
    if (!trimmed) {
      setLocalError("Please provide a merchant name");
      return;
    }

    try {
      await onResolve(
        merchant.normalizedKey,
        trimmed,
        merchant.rawNames[0] ?? trimmed
      );
    } catch (error) {
      setLocalError(
        error instanceof Error ? error.message : "Unable to save merchant"
      );
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      title="Resolve Merchant"
      showCancel
      onSave={handleSave}
      isSaving={isResolving}
      saveText="Save merchant"
      loadingText="Saving merchant..."
    >
      <div className="space-y-4 text-sm text-emerald-900/80">
        <div>
          <p className="text-xs font-semibold uppercase text-emerald-900/60">
            Original values
          </p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {merchant.rawNames.map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
        </div>
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase text-emerald-900/70">
            Merchant name
          </label>
          <input
            value={inputValue}
            onChange={(event) => {
              setInputValue(event.target.value);
              setLocalError(null);
            }}
            list="merchant-suggestion-options"
            className="w-full rounded-2xl border border-emerald-200 bg-white px-3 py-2 text-sm font-medium text-emerald-900 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200"
            placeholder="Start typing to search or create"
            disabled={isResolving}
          />
          <datalist id="merchant-suggestion-options">
            {suggestions.map((suggestion) => (
              <option key={suggestion.id} value={suggestion.canonicalName} />
            ))}
          </datalist>
          {localError ? (
            <p className="text-xs text-red-600">{localError}</p>
          ) : null}
          <p className="text-xs text-emerald-900/60">
            Pick an existing merchant or enter a new name to remember it next
            time.
          </p>
        </div>
      </div>
    </Modal>
  );
}
