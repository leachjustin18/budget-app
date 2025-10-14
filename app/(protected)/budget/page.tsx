"use client";

import data from "@emoji-mart/data";
import Picker from "@emoji-mart/react";
import {
  Dialog,
  Menu,
  MenuButton,
  MenuItem,
  MenuItems,
  Transition,
} from "@headlessui/react";
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  Controller,
  FormProvider,
  useFieldArray,
  useForm,
} from "react-hook-form";
import Toast, { type ToastVariant } from "@budget/components/UI/Toast";
import { Button } from "@budget/components/UI/Button";
import { joinClassNames } from "@budget/lib/helpers";
import CurrencyInput from "@budget/components/CurrencyInput";

type BudgetSectionKey = "expenses" | "recurring" | "savings" | "debt";
type RepeatCadence = "monthly" | "once";

type BudgetCategory = {
  uuid: string;
  name: string;
  emoji: string;
  planned: number | null;
  spent: number | null;
  carryForward: boolean;
  repeat: RepeatCadence;
};

type IncomeLine = {
  uuid: string;
  source: string;
  amount: number | null;
};

type BudgetSections = Record<BudgetSectionKey, BudgetCategory[]>;

type BudgetFormValues = {
  income: IncomeLine[];
  sections: BudgetSections;
};

type ToastMessage = {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
  autoDismissMs?: number;
  actions?: ReactNode;
  dismissible?: boolean;
  persistent?: boolean;
};

type ConfirmState = {
  isOpen: boolean;
  title?: string;
  description?: string;
  onConfirm?: () => void;
};

type EmojiPickerTarget = {
  section: BudgetSectionKey;
  index: number;
} | null;

const createId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `id-${Math.random().toString(36).slice(2, 10)}`;

const monthFormatter = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
});

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const SECTION_CONFIG: Record<
  BudgetSectionKey,
  {
    label: string;
    subtitle: string;
    accent: string;
  }
> = {
  expenses: {
    label: "Expenses",
    subtitle: "Everyday spending",
    accent: "from-emerald-200 via-emerald-50 to-white",
  },
  recurring: {
    label: "Recurring",
    subtitle: "Subscriptions & bills",
    accent: "from-teal-200 via-teal-50 to-white",
  },
  savings: {
    label: "Save",
    subtitle: "Money to keep aside",
    accent: "from-sky-200 via-sky-50 to-white",
  },
  debt: {
    label: "Debt",
    subtitle: "Loans & repayments",
    accent: "from-amber-200 via-amber-50 to-white",
  },
};

const createEmptyBudgetForm = (): BudgetFormValues => ({
  income: [],
  sections: {
    expenses: [],
    recurring: [],
    savings: [],
    debt: [],
  },
});

const createIncomeLine = (uuid: string): IncomeLine => ({
  uuid,
  source: "",
  amount: null,
});

const createCategory = (uuid: string): BudgetCategory => ({
  uuid,
  name: "",
  emoji: "✨",
  planned: null,
  spent: null,
  carryForward: false,
  repeat: "monthly",
});

const sanitizeBudgetValues = (values: BudgetFormValues): BudgetFormValues => {
  const sanitizedIncome = values.income
    .map((item) => ({
      ...item,
      source: item.source.trim(),
      amount: item.amount ?? null,
    }))
    .filter((item) => item.source.length > 0 || item.amount !== null);

  const sanitizedSections = Object.entries(values.sections).reduce(
    (acc, [key, list]) => {
      acc[key as BudgetSectionKey] = list
        .map((item) => ({
          ...item,
          name: item.name.trim(),
          planned: item.planned ?? null,
          spent: item.spent ?? null,
        }))
        .filter(
          (item) =>
            item.name.length > 0 || item.planned !== null || item.spent !== null
        );
      return acc;
    },
    {
      expenses: [] as BudgetCategory[],
      recurring: [] as BudgetCategory[],
      savings: [] as BudgetCategory[],
      debt: [] as BudgetCategory[],
    }
  );

  return {
    income: sanitizedIncome,
    sections: sanitizedSections,
  };
};

type SectionSummary = {
  planned: number;
  spent: number;
  remaining: number;
};

type BudgetSummary = {
  totalIncome: number;
  totalPlanned: number;
  totalSpent: number;
  remaining: number;
  overallProgress: number;
  sections: Record<BudgetSectionKey, SectionSummary>;
};

const calculateSummary = (values: BudgetFormValues): BudgetSummary => {
  const sectionsSummary: Record<BudgetSectionKey, SectionSummary> = {
    expenses: { planned: 0, spent: 0, remaining: 0 },
    recurring: { planned: 0, spent: 0, remaining: 0 },
    savings: { planned: 0, spent: 0, remaining: 0 },
    debt: { planned: 0, spent: 0, remaining: 0 },
  };

  const totalIncome = values.income.reduce(
    (sum, line) => sum + (line.amount ?? 0),
    0
  );

  Object.entries(values.sections).forEach(([key, categories]) => {
    const sectionKey = key as BudgetSectionKey;
    categories.forEach((category) => {
      const planned = category.planned ?? 0;
      const spent = category.spent ?? 0;
      sectionsSummary[sectionKey].planned += planned;
      sectionsSummary[sectionKey].spent += spent;
    });
    sectionsSummary[sectionKey].remaining =
      sectionsSummary[sectionKey].planned - sectionsSummary[sectionKey].spent;
  });

  const totalPlanned = Object.values(sectionsSummary).reduce(
    (sum, section) => sum + section.planned,
    0
  );
  const totalSpent = Object.values(sectionsSummary).reduce(
    (sum, section) => sum + section.spent,
    0
  );
  const remaining = totalIncome - totalPlanned;
  const overallProgress = totalPlanned > 0 ? totalSpent / totalPlanned : 0;

  return {
    totalIncome,
    totalPlanned,
    totalSpent,
    remaining,
    overallProgress,
    sections: sectionsSummary,
  };
};

const formatCurrency = (value: number | null | undefined) =>
  currencyFormatter.format(value ?? 0);

const addMonths = (date: Date, offset: number) =>
  new Date(date.getFullYear(), date.getMonth() + offset, 1);

const getMonthKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

const buildCarriedBudget = (previous: BudgetFormValues): BudgetFormValues => {
  const sanitized = sanitizeBudgetValues(previous);

  const carriedSections = Object.entries(sanitized.sections).reduce(
    (acc, [key, categories]) => {
      const sectionKey = key as BudgetSectionKey;
      acc[sectionKey] = categories
        .filter((category) => category.repeat === "monthly")
        .map((category) => {
          const planned = category.planned ?? 0;
          const spent = category.spent ?? 0;
          const leftover = category.carryForward
            ? Math.max(planned - spent, 0)
            : 0;

          return {
            ...category,
            planned: Math.max(planned + leftover, 0),
            spent: null,
          } as BudgetCategory;
        });
      return acc;
    },
    {
      expenses: [] as BudgetCategory[],
      recurring: [] as BudgetCategory[],
      savings: [] as BudgetCategory[],
      debt: [] as BudgetCategory[],
    }
  );

  return {
    income: sanitized.income.map((line) => ({ ...line })),
    sections: carriedSections,
  };
};

const useSectionArray = (
  control: ReturnType<typeof useForm<BudgetFormValues>>["control"],
  section: BudgetSectionKey
) =>
  useFieldArray({
    control,
    name: `sections.${section}` as const,
  });

export default function BudgetPage() {
  const baseDate = useMemo(() => new Date(), []);
  const [monthsData, setMonthsData] = useState<
    Record<string, BudgetFormValues>
  >({});
  const [monthOffset, setMonthOffset] = useState(0);
  const [draftValues, setDraftValues] = useState<BudgetFormValues>(
    createEmptyBudgetForm()
  );
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [recentlyAdded, setRecentlyAdded] = useState<Record<string, boolean>>(
    {}
  );
  const [collapsedSections, setCollapsedSections] = useState<
    Record<BudgetSectionKey, boolean>
  >({
    expenses: false,
    recurring: false,
    savings: false,
    debt: false,
  });
  const [confirmState, setConfirmState] = useState<ConfirmState>({
    isOpen: false,
  });
  const [emojiPickerTarget, setEmojiPickerTarget] =
    useState<EmojiPickerTarget>(null);
  const [showFutureWarning, setShowFutureWarning] = useState(false);
  const [loadingMonths, setLoadingMonths] = useState<Record<string, boolean>>(
    {}
  );
  const [monthMetadata, setMonthMetadata] = useState<
    Record<string, { exists: boolean }>
  >({});
  const [isSaving, setIsSaving] = useState(false);

  const currentDate = useMemo(
    () => addMonths(baseDate, monthOffset),
    [baseDate, monthOffset]
  );
  const currentMonthKey = useMemo(
    () => getMonthKey(currentDate),
    [currentDate]
  );

  const baseline = useMemo(
    () => monthsData[currentMonthKey] ?? createEmptyBudgetForm(),
    [monthsData, currentMonthKey]
  );

  const formMethods = useForm<BudgetFormValues>({
    mode: "onChange",
    defaultValues: baseline,
  });

  const { control, reset, watch, setValue } = formMethods;

  const incomeArray = useFieldArray({ control, name: "income" });
  const expensesArray = useSectionArray(control, "expenses");
  const recurringArray = useSectionArray(control, "recurring");
  const savingsArray = useSectionArray(control, "savings");
  const debtArray = useSectionArray(control, "debt");

  const sectionArrays = useMemo(
    () => ({
      expenses: expensesArray,
      recurring: recurringArray,
      savings: savingsArray,
      debt: debtArray,
    }),
    [expensesArray, recurringArray, savingsArray, debtArray]
  );

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const upsertToast = useCallback((toast: ToastMessage) => {
    setToasts((prev) => {
      const index = prev.findIndex((item) => item.id === toast.id);
      if (index === -1) {
        return [toast, ...prev];
      }

      const next = [...prev];
      next[index] = { ...next[index], ...toast };
      return next;
    });
  }, []);

  const pushToast = useCallback(
    (message: Omit<ToastMessage, "id"> & { id?: string }) => {
      const messageId = message.id ?? createId();
      const nextToast: ToastMessage = { ...message, id: messageId };
      setToasts((prev) => [
        nextToast,
        ...prev.filter((item) => item.id !== messageId),
      ]);
    },
    []
  );

  const loadBudgetForMonth = useCallback(
    async (monthKey: string) => {
      setLoadingMonths((prev) => ({ ...prev, [monthKey]: true }));
      try {
        const response = await fetch(`/api/budgets/${monthKey}`, {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error(`Request failed with ${response.status}`);
        }

        const payload = (await response.json()) as {
          budget: BudgetFormValues;
          exists: boolean;
        };

        const sanitized = sanitizeBudgetValues(payload.budget);
        setMonthsData((prev) => ({ ...prev, [monthKey]: sanitized }));
        setMonthMetadata((prev) => ({
          ...prev,
          [monthKey]: { exists: payload.exists },
        }));
        return sanitized;
      } catch (error) {
        console.error("Failed to load budget", error);
        pushToast({
          title: "Unable to load budget",
          description: "Starting with a blank sheet for this month.",
          variant: "danger",
          autoDismissMs: 5000,
        });
        const blank = createEmptyBudgetForm();
        setMonthsData((prev) => ({ ...prev, [monthKey]: blank }));
        setMonthMetadata((prev) => ({
          ...prev,
          [monthKey]: { exists: false },
        }));
        return blank;
      } finally {
        setLoadingMonths((prev) => {
          const next = { ...prev };
          delete next[monthKey];
          return next;
        });
      }
    },
    [pushToast]
  );

  useEffect(() => {
    reset(baseline);
    setDraftValues(sanitizeBudgetValues(baseline));
    setHasUnsavedChanges(false);
  }, [baseline, reset]);

  useEffect(() => {
    const subscription = watch((value) => {
      const sanitized = sanitizeBudgetValues(value as BudgetFormValues);
      setDraftValues(sanitized);
      const baselineSanitized = sanitizeBudgetValues(baseline);
      setHasUnsavedChanges(
        JSON.stringify(sanitized) !== JSON.stringify(baselineSanitized)
      );
    });

    return () => subscription.unsubscribe();
  }, [watch, baseline]);

  useEffect(() => {
    if (monthsData[currentMonthKey] || loadingMonths[currentMonthKey]) return;
    void loadBudgetForMonth(currentMonthKey);
  }, [currentMonthKey, monthsData, loadingMonths, loadBudgetForMonth]);

  useEffect(() => {
    setShowFutureWarning(monthOffset > 0);
  }, [monthOffset]);

  const triggerHighlight = useCallback((uuid: string) => {
    setRecentlyAdded((prev) => ({ ...prev, [uuid]: true }));
    window.setTimeout(() => {
      setRecentlyAdded((prev) => {
        const next = { ...prev };
        delete next[uuid];
        return next;
      });
    }, 2400);
  }, []);

  const handleAddIncome = useCallback(() => {
    const uuid = createId();
    incomeArray.prepend(createIncomeLine(uuid));
    triggerHighlight(uuid);
    pushToast({
      title: "Income line added",
      description: "Fill in the new expected income at the top of the list.",
      variant: "success",
      autoDismissMs: 4200,
    });
  }, [incomeArray, triggerHighlight, pushToast]);

  const handleAddCategory = useCallback(
    (section: BudgetSectionKey) => {
      const uuid = createId();
      sectionArrays[section].prepend(createCategory(uuid));
      triggerHighlight(uuid);
      pushToast({
        title: `${SECTION_CONFIG[section].label} updated`,
        description: "Your new category is highlighted at the top.",
        variant: "success",
        autoDismissMs: 4500,
      });
      window.setTimeout(() => setEmojiPickerTarget({ section, index: 0 }), 160);
    },
    [sectionArrays, triggerHighlight, pushToast]
  );

  const handleSaveBudget = useCallback(async () => {
    const sanitized = sanitizeBudgetValues(draftValues);
    setIsSaving(true);
    try {
      const response = await fetch(`/api/budgets/${currentMonthKey}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ budget: sanitized }),
      });

      if (!response.ok) {
        throw new Error(`Save failed with ${response.status}`);
      }

      const payload = (await response.json()) as {
        budget: BudgetFormValues;
        exists: boolean;
      };

      const normalized = sanitizeBudgetValues(payload.budget);
      setMonthsData((prev) => ({
        ...prev,
        [currentMonthKey]: normalized,
      }));
      setMonthMetadata((prev) => ({
        ...prev,
        [currentMonthKey]: { exists: true },
      }));
      reset(normalized);
      setDraftValues(normalized);
      setHasUnsavedChanges(false);
      pushToast({
        title: "Budget saved",
        description: "Everything is synced with your database.",
        variant: "success",
        autoDismissMs: 3600,
      });
    } catch (error) {
      console.error("Failed to save budget", error);
      pushToast({
        title: "Save failed",
        description: "We could not sync those changes. Please try again.",
        variant: "danger",
        persistent: false,
        autoDismissMs: 5000,
      });
    } finally {
      setIsSaving(false);
    }
  }, [draftValues, currentMonthKey, reset, pushToast]);

  const handleCopyPreviousMonth = useCallback(async () => {
    const previousDate = addMonths(currentDate, -1);
    const previousKey = getMonthKey(previousDate);
    let previousData = monthsData[previousKey];

    if (!previousData && !loadingMonths[previousKey]) {
      previousData = await loadBudgetForMonth(previousKey);
    }

    const previousExists = monthMetadata[previousKey]?.exists ?? false;

    if (!previousData || !previousExists) {
      pushToast({
        title: "Nothing to copy yet",
        description: "There is no budget saved for the previous month.",
        variant: "warning",
        autoDismissMs: 4200,
      });
      return;
    }

    const carried = buildCarriedBudget(previousData);
    setMonthsData((prev) => ({
      ...prev,
      [currentMonthKey]: carried,
    }));
    setMonthMetadata((prev) => ({
      ...prev,
      [currentMonthKey]: { exists: false },
    }));
    reset(carried);
    setDraftValues(carried);
    setHasUnsavedChanges(false);
    setShowFutureWarning(false);
    pushToast({
      title: "Copied last month",
      description:
        "Monthly categories carried over. Leftover savings were rolled forward.",
      variant: "info",
      autoDismissMs: 4500,
    });
  }, [
    currentDate,
    currentMonthKey,
    monthsData,
    monthMetadata,
    loadingMonths,
    loadBudgetForMonth,
    reset,
    pushToast,
  ]);

  useEffect(() => {
    if (hasUnsavedChanges) {
      upsertToast({
        id: "unsaved-changes",
        title: "Unsaved changes",
        description:
          "Review your updates and save whenever you are ready to sync.",
        variant: "warning",
        persistent: true,
        actions: (
          <Button
            size="sm"
            variant="primary"
            onClick={handleSaveBudget}
            loading={isSaving}
            loadingText="Saving"
          >
            Save budget
          </Button>
        ),
      });
    } else {
      dismissToast("unsaved-changes");
    }
  }, [
    hasUnsavedChanges,
    upsertToast,
    dismissToast,
    handleSaveBudget,
    isSaving,
  ]);

  useEffect(() => {
    if (showFutureWarning) {
      upsertToast({
        id: "future-warning",
        title: "Planning ahead",
        description:
          "You are viewing a future month. Copy the previous month to start from familiar numbers.",
        variant: "info",
        persistent: true,
        actions: (
          <Button
            size="sm"
            variant="secondary"
            onClick={handleCopyPreviousMonth}
          >
            Copy previous month
          </Button>
        ),
      });
    } else {
      dismissToast("future-warning");
    }
  }, [showFutureWarning, upsertToast, dismissToast, handleCopyPreviousMonth]);

  const summary = useMemo(() => calculateSummary(draftValues), [draftValues]);

  const monthLabel = useMemo(
    () => monthFormatter.format(currentDate),
    [currentDate]
  );

  const openDeleteConfirmation = useCallback(
    (options: {
      title: string;
      description: string;
      onConfirm: () => void;
    }) => {
      setConfirmState({
        isOpen: true,
        title: options.title,
        description: options.description,
        onConfirm: () => {
          options.onConfirm();
          setConfirmState({ isOpen: false });
          pushToast({
            title: "Item deleted",
            description: "That entry has been removed from this month.",
            variant: "danger",
            autoDismissMs: 3800,
          });
        },
      });
    },
    [pushToast]
  );

  const closeConfirm = useCallback(() => {
    setConfirmState({ isOpen: false });
  }, []);

  const { fields: incomeFields, remove: removeIncome } = incomeArray;

  const handleRemoveIncome = useCallback(
    (index: number, label: string) => {
      openDeleteConfirmation({
        title: "Delete income?",
        description: `Remove ${
          label || "this income line"
        } from ${monthLabel}?`,
        onConfirm: () => removeIncome(index),
      });
    },
    [monthLabel, openDeleteConfirmation, removeIncome]
  );

  const handleRemoveCategory = useCallback(
    (section: BudgetSectionKey, index: number, label: string) => {
      openDeleteConfirmation({
        title: "Delete category?",
        description: `This will remove ${label || "the category"} from your ${
          SECTION_CONFIG[section].label
        } plan.`,
        onConfirm: () => sectionArrays[section].remove(index),
      });
    },
    [openDeleteConfirmation, sectionArrays]
  );

  const toggleSection = useCallback((section: BudgetSectionKey) => {
    setCollapsedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  }, []);

  const goToPreviousMonth = useCallback(() => {
    setMonthOffset((offset) => offset - 1);
  }, []);

  const goToNextMonth = useCallback(() => {
    setMonthOffset((offset) => offset + 1);
  }, []);

  return (
    <FormProvider {...formMethods}>
      <div className="pointer-events-none fixed inset-x-0 top-[120px] z-40 flex flex-col items-center gap-3 px-4 sm:items-end">
        {toasts.map((toast) => (
          <Toast
            key={toast.id}
            title={toast.title}
            description={toast.description}
            variant={toast.variant}
            actions={toast.actions}
            dismissible={toast.dismissible}
            persistent={toast.persistent}
            autoDismissMs={toast.autoDismissMs}
            onDismiss={() => dismissToast(toast.id)}
            className="w-full sm:max-w-sm"
          />
        ))}
      </div>
      <section className="space-y-6 pb-16">
        <header className="flex flex-col gap-4 rounded-3xl border border-emerald-700/20 bg-[#CAEFD1]/80 p-5 shadow-[0_20px_45px_rgba(22,101,52,0.22)] backdrop-blur-md sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={goToPreviousMonth}
              className="rounded-2xl border border-emerald-500/40 bg-white/90 p-2 text-emerald-700 shadow-[0_10px_26px_rgba(16,118,110,0.22)] transition hover:scale-[1.02] hover:text-emerald-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
              aria-label="Previous month"
            >
              <svg
                aria-hidden
                className="size-5"
                viewBox="0 0 24 24"
                role="img"
              >
                <path
                  d="m14.53 7.47-4 4a.75.75 0 0 0 0 1.06l4 4a.75.75 0 1 0 1.06-1.06L12.06 12l3.53-3.53a.75.75 0 1 0-1.06-1.06"
                  fill="currentColor"
                />
              </svg>
            </button>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.38em] text-emerald-800/80">
                Budget Month
              </p>
              <p className="text-lg font-semibold text-emerald-950">
                {monthLabel}
              </p>
            </div>
            <button
              type="button"
              onClick={goToNextMonth}
              className="rounded-2xl border border-emerald-500/40 bg-white/90 p-2 text-emerald-700 shadow-[0_10px_26px_rgba(16,118,110,0.22)] transition hover:scale-[1.02] hover:text-emerald-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
              aria-label="Next month"
            >
              <svg
                aria-hidden
                className="size-5"
                viewBox="0 0 24 24"
                role="img"
              >
                <path
                  d="m9.47 7.47 4 4a.75.75 0 0 1 0 1.06l-4 4a.75.75 0 1 1-1.06-1.06L11.94 12 8.41 8.47a.75.75 0 1 1 1.06-1.06"
                  fill="currentColor"
                />
              </svg>
            </button>
          </div>
          <div className="flex flex-col items-start gap-3 sm:items-end">
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-24 rounded-full bg-emerald-500/30">
                <div
                  className="h-1.5 rounded-full bg-emerald-600"
                  style={{
                    width: `${Math.min(summary.overallProgress, 1) * 100}%`,
                  }}
                />
              </div>
              <span className="text-xs font-medium text-emerald-900">
                {Math.round(Math.min(summary.overallProgress, 1) * 100)}%
                allocated
              </span>
            </div>
            <p className="text-[11px] text-emerald-800/80">
              Track envelopes, subscriptions, savings, and debt in one place.
            </p>
          </div>
        </header>

        <div className="grid gap-5 lg:grid-cols-[2fr_1fr]">
          <section className="space-y-4 rounded-3xl border border-emerald-200/60 bg-white/95 p-6 shadow-[0_14px_36px_rgba(15,118,110,0.12)]">
            <header className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-emerald-950">
                  Expected income
                </h2>
                <p className="text-sm text-emerald-800/80">
                  Add each source you plan to receive this month.
                </p>
              </div>
              <Button size="sm" variant="primary" onClick={handleAddIncome}>
                Add income
              </Button>
            </header>

            <div className="space-y-3">
              {incomeFields.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-emerald-300/60 bg-emerald-50/60 px-5 py-6 text-center text-sm text-emerald-800">
                  No income planned yet. Start by adding your first source.
                </div>
              ) : null}

              {incomeFields.map((field, index) => {
                const highlight = recentlyAdded[field.uuid] ?? false;
                const liveValue = draftValues.income.find(
                  (item) => item.uuid === field.uuid
                );

                return (
                  <div
                    key={field.id}
                    className={joinClassNames(
                      "flex flex-col gap-3 rounded-2xl border bg-white/90 px-4 py-4 shadow-sm transition",
                      highlight
                        ? "border-emerald-500/60 bg-emerald-50/80 shadow-[0_10px_28px_rgba(16,118,110,0.22)]"
                        : "border-transparent"
                    )}
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
                      <div className="flex-1">
                        <label className="text-xs font-medium uppercase tracking-[0.22em] text-emerald-800/70">
                          Source
                        </label>
                        <input
                          type="text"
                          {...formMethods.register(
                            `income.${index}.source` as const
                          )}
                          placeholder="e.g., Paycheck"
                          className="mt-1 w-full rounded-xl border border-emerald-300/50 bg-white/95 px-3 py-2 text-sm font-medium text-emerald-900 shadow-inner focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-300"
                        />
                      </div>
                      <div className="w-full md:w-48">
                        <label className="text-xs font-medium uppercase tracking-[0.22em] text-emerald-800/70">
                          Amount
                        </label>
                        <Controller
                          control={control}
                          name={`income.${index}.amount` as const}
                          render={({
                            field: { value, onChange, onBlur, name },
                          }) => (
                            <CurrencyInput
                              name={name}
                              value={value ?? ""}
                              onBlur={onBlur}
                              onValueChange={(val) =>
                                onChange(
                                  val && val.length > 0 ? Number(val) : null
                                )
                              }
                            />
                          )}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          handleRemoveIncome(
                            index,
                            liveValue?.source ?? "this income"
                          )
                        }
                        className="self-start rounded-xl border border-transparent px-3 py-2 text-sm text-emerald-700 transition hover:border-rose-300 hover:text-rose-600"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <aside className="space-y-4 rounded-3xl border border-emerald-200/60 bg-white/95 p-6 shadow-[0_14px_36px_rgba(15,118,110,0.12)]">
            <header>
              <h2 className="text-lg font-semibold text-emerald-950">
                Month snapshot
              </h2>
              <p className="text-sm text-emerald-800/80">
                Quick look at what is planned, spent, and left.
              </p>
            </header>
            <div className="space-y-3 rounded-2xl border border-emerald-200/60 bg-emerald-50/70 p-4">
              <SummaryRow label="Total income" value={summary.totalIncome} />
              <SummaryRow label="Planned" value={summary.totalPlanned} />
              <SummaryRow label="Spent" value={summary.totalSpent} />
              <SummaryRow
                label="Remaining"
                value={summary.remaining}
                highlightNegative
              />
            </div>
            <div className="space-y-3">
              {(
                [
                  "expenses",
                  "recurring",
                  "savings",
                  "debt",
                ] as BudgetSectionKey[]
              ).map((section) => {
                const data = summary.sections[section];
                const progress =
                  data.planned > 0 ? data.spent / data.planned : 0;
                const isOverspent =
                  data.spent > data.planned && data.planned > 0;
                return (
                  <div key={section} className="space-y-1">
                    <div className="flex items-center justify-between text-sm font-medium text-emerald-900">
                      <span>{SECTION_CONFIG[section].label}</span>
                      <span>{formatCurrency(data.spent)}</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-emerald-100">
                      <div
                        className={joinClassNames(
                          "h-full rounded-full transition-all",
                          isOverspent ? "bg-rose-400" : "bg-emerald-500"
                        )}
                        style={{ width: `${Math.min(progress, 1) * 100}%` }}
                      />
                    </div>
                    <p className="text-xs text-emerald-800/80">
                      {formatCurrency(data.planned - data.spent)} remaining
                    </p>
                  </div>
                );
              })}
            </div>
          </aside>
        </div>

        <div className="rounded-3xl border border-emerald-200/60 bg-white/95 p-6 shadow-[0_14px_36px_rgba(15,118,110,0.12)]">
          <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-emerald-950">
                Planned budget
              </h2>
              <p className="text-sm text-emerald-800/80">
                Organize expenses by category, add new ones, and collapse what
                you do not need right now.
              </p>
            </div>
            <Menu as="div" className="relative inline-block text-left">
              <MenuButton as={Button} size="sm" variant="secondary">
                Add category
              </MenuButton>
              <Transition
                as={Fragment}
                enter="transition ease-out duration-100"
                enterFrom="transform opacity-0 scale-95"
                enterTo="transform opacity-100 scale-100"
                leave="transition ease-in duration-75"
                leaveFrom="transform opacity-100 scale-100"
                leaveTo="transform opacity-0 scale-95"
              >
                <MenuItems className="absolute right-0 mt-2 w-52 origin-top-right space-y-1 rounded-2xl border border-emerald-200/60 bg-white p-2 shadow-[0_16px_32px_rgba(15,118,110,0.18)] focus:outline-none">
                  {(
                    [
                      "expenses",
                      "recurring",
                      "savings",
                      "debt",
                    ] as BudgetSectionKey[]
                  ).map((section) => (
                    <MenuItem key={section}>
                      {({ active }) => (
                        <button
                          type="button"
                          onClick={() => handleAddCategory(section)}
                          className={joinClassNames(
                            "flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm font-medium",
                            active
                              ? "bg-emerald-100 text-emerald-900"
                              : "text-emerald-800"
                          )}
                        >
                          <span>{SECTION_CONFIG[section].label}</span>
                          <span className="text-xs text-emerald-600">
                            {SECTION_CONFIG[section].subtitle}
                          </span>
                        </button>
                      )}
                    </MenuItem>
                  ))}
                </MenuItems>
              </Transition>
            </Menu>
          </div>

          <div className="space-y-6">
            {(
              ["expenses", "recurring", "savings", "debt"] as BudgetSectionKey[]
            ).map((section) => {
              const { fields } = sectionArrays[section];
              const isCollapsed = collapsedSections[section];

              return (
                <div
                  key={section}
                  className="rounded-2xl border border-emerald-200/60 bg-white/95 p-4 shadow-sm"
                >
                  <button
                    type="button"
                    onClick={() => toggleSection(section)}
                    className="flex w-full items-center justify-between gap-3 rounded-xl border border-transparent bg-emerald-50/70 px-4 py-3 text-left transition hover:border-emerald-200"
                  >
                    <div>
                      <p className="text-sm font-semibold text-emerald-950">
                        {SECTION_CONFIG[section].label}
                      </p>
                      <p className="text-xs text-emerald-800/80">
                        {SECTION_CONFIG[section].subtitle}
                      </p>
                    </div>
                    <svg
                      aria-hidden
                      className={joinClassNames(
                        "size-4 text-emerald-800 transition-transform",
                        isCollapsed ? "rotate-180" : ""
                      )}
                      viewBox="0 0 24 24"
                      role="img"
                    >
                      <path
                        d="m12 15.5-4.47-4.47a.75.75 0 0 1 1.06-1.06L12 13.94l3.41-3.97a.75.75 0 0 1 1.12 1L12 15.5"
                        fill="currentColor"
                      />
                    </svg>
                  </button>

                  {!isCollapsed ? (
                    <div className="mt-4 space-y-4">
                      {fields.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-emerald-300/60 bg-emerald-50/60 px-4 py-5 text-center text-sm text-emerald-800">
                          No categories yet. Add one to start planning.
                        </div>
                      ) : null}

                      {fields.map((field, index) => {
                        const highlight = recentlyAdded[field.uuid] ?? false;
                        const liveCategory =
                          draftValues.sections[section]?.find(
                            (item) => item.uuid === field.uuid
                          ) ?? field;
                        const planned = liveCategory.planned ?? 0;
                        const spent = liveCategory.spent ?? 0;
                        const progress = planned > 0 ? spent / planned : 0;
                        const overspent = planned > 0 && spent > planned;

                        return (
                          <div
                            key={field.id}
                            className={joinClassNames(
                              "space-y-4 rounded-2xl border bg-white/90 p-4 shadow-sm transition",
                              highlight
                                ? "border-emerald-500/60 bg-emerald-50/80 shadow-[0_10px_28px_rgba(16,118,110,0.22)]"
                                : "border-transparent"
                            )}
                          >
                            <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
                              <div className="flex items-center gap-3">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setEmojiPickerTarget({
                                      section,
                                      index,
                                    })
                                  }
                                  className="grid size-10 place-items-center rounded-2xl border border-emerald-300/60 bg-white text-2xl shadow-inner transition hover:border-emerald-500"
                                  aria-label="Pick emoji"
                                >
                                  {field.emoji}
                                </button>
                                <div>
                                  <label className="text-xs font-medium uppercase tracking-[0.22em] text-emerald-800/70">
                                    Category name
                                  </label>
                                  <input
                                    type="text"
                                    {...formMethods.register(
                                      `sections.${section}.${index}.name` as const
                                    )}
                                    placeholder="Enter a name"
                                    className="mt-1 w-full rounded-xl border border-emerald-300/50 bg-white/95 px-3 py-2 text-sm font-medium text-emerald-900 shadow-inner focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-300"
                                  />
                                </div>
                              </div>
                              <div className="grid flex-1 gap-3 sm:grid-cols-2">
                                <div>
                                  <label className="text-xs font-medium uppercase tracking-[0.22em] text-emerald-800/70">
                                    Planned
                                  </label>
                                  <Controller
                                    control={control}
                                    name={
                                      `sections.${section}.${index}.planned` as const
                                    }
                                    render={({
                                      field: {
                                        value,
                                        onChange,
                                        onBlur,

                                        name,
                                      },
                                    }) => (
                                      <CurrencyInput
                                        name={name}
                                        value={value ?? ""}
                                        onBlur={onBlur}
                                        onValueChange={(val) =>
                                          onChange(
                                            val && val.length > 0
                                              ? Number(val)
                                              : null
                                          )
                                        }
                                      />
                                    )}
                                  />
                                </div>
                                <div>
                                  <label className="text-xs font-medium uppercase tracking-[0.22em] text-emerald-800/70">
                                    Spent
                                  </label>
                                  <Controller
                                    control={control}
                                    name={
                                      `sections.${section}.${index}.spent` as const
                                    }
                                    render={({
                                      field: {
                                        value,
                                        onChange,
                                        onBlur,

                                        name,
                                      },
                                    }) => (
                                      <CurrencyInput
                                        name={name}
                                        value={value ?? ""}
                                        onBlur={onBlur}
                                        onValueChange={(val) =>
                                          onChange(
                                            val && val.length > 0
                                              ? Number(val)
                                              : null
                                          )
                                        }
                                      />
                                    )}
                                  />
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() =>
                                  handleRemoveCategory(
                                    section,
                                    index,
                                    liveCategory.name || "this category"
                                  )
                                }
                                className="self-start rounded-xl border border-transparent px-3 py-2 text-sm text-emerald-700 transition hover:border-rose-300 hover:text-rose-600"
                              >
                                Delete
                              </button>
                            </div>

                            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                              <div className="flex items-center gap-3">
                                <Controller
                                  control={control}
                                  name={
                                    `sections.${section}.${index}.repeat` as const
                                  }
                                  render={({ field: repeatField }) => (
                                    <div className="flex items-center gap-1 rounded-2xl border border-emerald-200/60 bg-emerald-50/70 p-1">
                                      {(
                                        ["monthly", "once"] as RepeatCadence[]
                                      ).map((value) => (
                                        <button
                                          key={value}
                                          type="button"
                                          onClick={() =>
                                            repeatField.onChange(value)
                                          }
                                          className={joinClassNames(
                                            "rounded-xl px-3 py-1.5 text-xs font-semibold transition",
                                            repeatField.value === value
                                              ? "bg-white text-emerald-900 shadow"
                                              : "text-emerald-700 hover:bg-white/70"
                                          )}
                                        >
                                          {value === "monthly"
                                            ? "Monthly"
                                            : "This month"}
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                />
                                <Controller
                                  control={control}
                                  name={
                                    `sections.${section}.${index}.carryForward` as const
                                  }
                                  render={({ field: carryField }) => (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        carryField.onChange(!carryField.value)
                                      }
                                      className={joinClassNames(
                                        "flex items-center gap-2 rounded-2xl border px-3 py-1.5 text-xs font-semibold transition",
                                        carryField.value
                                          ? "border-emerald-400 bg-emerald-50 text-emerald-900"
                                          : "border-emerald-200 bg-white text-emerald-700 hover:border-emerald-300"
                                      )}
                                    >
                                      <span
                                        className={joinClassNames(
                                          "grid size-4 place-items-center rounded-full border",
                                          carryField.value
                                            ? "border-emerald-500 bg-emerald-500"
                                            : "border-emerald-400"
                                        )}
                                      >
                                        {carryField.value ? (
                                          <svg
                                            aria-hidden
                                            className="size-3 text-white"
                                            viewBox="0 0 24 24"
                                            role="img"
                                          >
                                            <path
                                              d="m10.22 15.28-2.47-2.47a.75.75 0 0 1 1.06-1.06l1.94 1.94 4.44-4.44a.75.75 0 0 1 1.06 1.06l-4.97 4.97a.75.75 0 0 1-1.06 0"
                                              fill="currentColor"
                                            />
                                          </svg>
                                        ) : null}
                                      </span>
                                      Carry leftover forward
                                    </button>
                                  )}
                                />
                              </div>
                              <div className="flex flex-1 flex-col gap-2">
                                <div className="flex items-center justify-between text-xs font-medium text-emerald-800/90">
                                  <span>
                                    Spent {formatCurrency(spent)} of{" "}
                                    {formatCurrency(planned)}
                                  </span>
                                  <span
                                    className={joinClassNames(
                                      "font-semibold",
                                      overspent
                                        ? "text-rose-600"
                                        : "text-emerald-700"
                                    )}
                                  >
                                    {overspent
                                      ? `-${formatCurrency(spent - planned)}`
                                      : `${formatCurrency(
                                          planned - spent
                                        )} left`}
                                  </span>
                                </div>
                                <div className="h-2 w-full overflow-hidden rounded-full bg-emerald-100">
                                  <div
                                    className={joinClassNames(
                                      "h-full rounded-full transition-all",
                                      overspent
                                        ? "bg-rose-400"
                                        : "bg-emerald-500"
                                    )}
                                    style={{
                                      width: `${Math.min(progress, 1) * 100}%`,
                                    }}
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>

        <ConfirmDialog
          isOpen={confirmState.isOpen}
          title={confirmState.title}
          description={confirmState.description}
          onCancel={closeConfirm}
          onConfirm={() => {
            confirmState.onConfirm?.();
          }}
        />

        <EmojiPickerDialog
          target={emojiPickerTarget}
          onClose={() => setEmojiPickerTarget(null)}
          onSelect={(emoji) => {
            if (!emojiPickerTarget) return;
            setValue(
              `sections.${emojiPickerTarget.section}.${emojiPickerTarget.index}.emoji` as const,
              emoji
            );
            setEmojiPickerTarget(null);
          }}
        />
      </section>
    </FormProvider>
  );
}

type SummaryRowProps = {
  label: string;
  value: number;
  highlightNegative?: boolean;
};

function SummaryRow({ label, value, highlightNegative }: SummaryRowProps) {
  const isNegative = value < 0;
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="font-medium text-emerald-800/80">{label}</span>
      <span
        className={joinClassNames(
          "font-semibold",
          highlightNegative && isNegative
            ? "text-rose-600"
            : "text-emerald-900",
          highlightNegative && isNegative ? "font-bold" : ""
        )}
      >
        {isNegative
          ? `-${formatCurrency(Math.abs(value))}`
          : formatCurrency(value)}
      </span>
    </div>
  );
}

type ConfirmDialogProps = {
  isOpen: boolean;
  title?: string;
  description?: string;
  onCancel: () => void;
  onConfirm: () => void;
};

function ConfirmDialog({
  isOpen,
  title,
  description,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <Transition show={isOpen} as={Fragment}>
      <Dialog onClose={onCancel} className="relative z-50">
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-150"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-100"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-emerald-950/30 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-150"
            enterFrom="opacity-0 scale-95"
            enterTo="opacity-100 scale-100"
            leave="ease-in duration-100"
            leaveFrom="opacity-100 scale-100"
            leaveTo="opacity-0 scale-95"
          >
            <Dialog.Panel className="w-full max-w-sm space-y-4 rounded-3xl border border-emerald-200/70 bg-white/95 p-6 shadow-[0_24px_55px_rgba(15,118,110,0.28)]">
              <Dialog.Title className="text-lg font-semibold text-emerald-950">
                {title ?? "Are you sure?"}
              </Dialog.Title>
              {description ? (
                <Dialog.Description className="text-sm text-emerald-800/90">
                  {description}
                </Dialog.Description>
              ) : null}
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <Button variant="ghost" size="sm" onClick={onCancel}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    onConfirm();
                    onCancel();
                  }}
                >
                  Delete
                </Button>
              </div>
            </Dialog.Panel>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition>
  );
}

type EmojiPickerDialogProps = {
  target: EmojiPickerTarget;
  onClose: () => void;
  onSelect: (emoji: string) => void;
};

function EmojiPickerDialog({
  target,
  onClose,
  onSelect,
}: EmojiPickerDialogProps) {
  return (
    <Transition show={Boolean(target)} as={Fragment}>
      <Dialog onClose={onClose} className="relative z-50">
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-150"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-100"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-emerald-950/30 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-150"
            enterFrom="opacity-0 scale-95"
            enterTo="opacity-100 scale-100"
            leave="ease-in duration-100"
            leaveFrom="opacity-100 scale-100"
            leaveTo="opacity-0 scale-95"
          >
            <Dialog.Panel className="w-full max-w-md overflow-hidden rounded-3xl border border-emerald-200/70 bg-white/95 p-4 shadow-[0_24px_55px_rgba(15,118,110,0.28)]">
              <Dialog.Title className="mb-3 text-lg font-semibold text-emerald-950">
                Choose an emoji
              </Dialog.Title>
              <Picker
                data={data}
                onEmojiSelect={(emoji: { native: string }) => {
                  onSelect(emoji.native);
                }}
                theme="light"
              />
              <div className="mt-4 flex justify-end">
                <Button variant="ghost" size="sm" onClick={onClose}>
                  Close
                </Button>
              </div>
            </Dialog.Panel>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition>
  );
}
