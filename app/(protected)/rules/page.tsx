"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type JSX,
} from "react";
import {
  Dialog,
  Transition,
  TransitionChild,
  DialogPanel,
  DialogTitle,
  Description,
} from "@headlessui/react";
import Toast from "@budget/components/Toast";
import { type ToastProps } from "@budget/components/UI/ToastUI";
import { Button } from "@budget/components/UI/Button";
import { Switch } from "@budget/components/UI/Switch";
import { joinClassNames } from "@budget/lib/helpers";
import { getMonthKey } from "@budget/lib/transactions";
import { fetchCategories } from "@budget/lib/api/categories";
import { fetchBudgetSnapshot } from "@budget/lib/api/budgets";
import type {
  BudgetSnapshot as BudgetSnapshotData,
  Category,
} from "@budget/lib/types/domain";

type CategorySection = "EXPENSES" | "RECURRING" | "SAVINGS" | "DEBT";
type RepeatCadence = "MONTHLY" | "ONCE";

type RuleMatchField = "DESCRIPTION" | "MERCHANT" | "RAW";

type RuleMatchType =
  | "CONTAINS"
  | "STARTS_WITH"
  | "ENDS_WITH"
  | "EXACT"
  | "REGEX";

type CategorySummary = {
  id: string;
  name: string;
  emoji: string;
  section: CategorySection;
  carryForwardDefault?: boolean;
  repeatCadenceDefault?: RepeatCadence;
  usage?: {
    budgets: number;
    transactions: number;
    transactionSplits: number;
    rules: number;
  };
};

type RuleRecord = {
  id: string;
  name: string;
  isActive: boolean;
  matchField: RuleMatchField;
  matchType: RuleMatchType;
  matchValue: string;
  categoryId: string | null;
  lastRunAt: string | null;
  createdAt: string;
  updatedAt: string;
  category: CategorySummary | null;
};

type RuleFormState = {
  id?: string;
  name: string;
  categoryId: string;
  matchField: RuleMatchField;
  matchType: RuleMatchType;
  matchValue: string;
  applyToExisting: boolean;
};

const SECTION_ORDER: CategorySection[] = [
  "EXPENSES",
  "RECURRING",
  "SAVINGS",
  "DEBT",
];

const SECTION_META: Record<
  CategorySection,
  { label: string; accent: string; description: string }
> = {
  EXPENSES: {
    label: "Everyday spending",
    accent: "from-emerald-200 via-emerald-50 to-white",
    description: "Groceries, gas, and anything you buy regularly.",
  },
  RECURRING: {
    label: "Subscriptions & bills",
    accent: "from-teal-200 via-teal-50 to-white",
    description: "Keep streaming services and monthly bills tidy.",
  },
  SAVINGS: {
    label: "Savings goals",
    accent: "from-sky-200 via-sky-50 to-white",
    description: "Automate transfers toward future plans.",
  },
  DEBT: {
    label: "Debt payments",
    accent: "from-amber-200 via-amber-50 to-white",
    description: "Ensure repayments are categorized consistently.",
  },
};

const MATCH_FIELD_OPTIONS: Array<{
  value: RuleMatchField;
  label: string;
  helper: string;
}> = [
  {
    value: "DESCRIPTION",
    label: "Description",
    helper: "Matches the bank-provided description line.",
  },
  {
    value: "MERCHANT",
    label: "Merchant",
    helper: "Matches the merchant name when provided.",
  },
  {
    value: "RAW",
    label: "Import text",
    helper: "Matches the raw import text or memo.",
  },
];

const MATCH_TYPE_LABELS: Record<RuleMatchType, string> = {
  CONTAINS: "contains",
  STARTS_WITH: "starts with",
  ENDS_WITH: "ends with",
  EXACT: "matches exactly",
  REGEX: "matches the regex",
};

const MATCH_TYPE_OPTIONS: Array<{ value: RuleMatchType; label: string }> = [
  { value: "CONTAINS", label: "Contains" },
  { value: "STARTS_WITH", label: "Starts with" },
  { value: "ENDS_WITH", label: "Ends with" },
  { value: "EXACT", label: "Matches exactly" },
  { value: "REGEX", label: "Matches regex" },
];

const describeRule = (rule: RuleRecord): string => {
  const field = MATCH_FIELD_OPTIONS.find(
    (option) => option.value === rule.matchField
  )?.label;
  const type = MATCH_TYPE_LABELS[rule.matchType];
  return `${field ?? "Description"} ${type} “${rule.matchValue}”`;
};

const createLocalId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `toast-${Math.random().toString(36).slice(2, 10)}`;

const mapCategoryToSummary = (category: Category): CategorySummary => ({
  id: category.id,
  name: category.name,
  emoji: category.emoji,
  section: category.section as CategorySection,
  carryForwardDefault: category.carryForwardDefault,
  repeatCadenceDefault: category.repeatCadenceDefault,
  usage: category.usage,
});

type RuleEditorDialogProps = {
  isOpen: boolean;
  mode: "create" | "edit";
  categories: CategorySummary[];
  initialState: RuleFormState;
  onClose: () => void;
  onSubmit: (state: RuleFormState) => Promise<void>;
  submitting: boolean;
};

function RuleEditorDialog({
  isOpen,
  mode,
  categories,
  initialState,
  onClose,
  onSubmit,
  submitting,
}: RuleEditorDialogProps) {
  const [state, setState] = useState<RuleFormState>(initialState);

  useEffect(() => {
    setState(initialState);
  }, [initialState]);

  const categoryGroups = useMemo(() => {
    return categories.reduce<Record<CategorySection, CategorySummary[]>>(
      (acc, category) => {
        if (!acc[category.section]) {
          acc[category.section] = [];
        }
        acc[category.section].push(category);
        return acc;
      },
      {
        EXPENSES: [],
        RECURRING: [],
        SAVINGS: [],
        DEBT: [],
      }
    );
  }, [categories]);

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!state.name.trim() || !state.matchValue.trim() || !state.categoryId) {
        return;
      }
      await onSubmit({
        ...state,
        name: state.name.trim(),
        matchValue: state.matchValue.trim(),
      });
    },
    [onSubmit, state]
  );

  const disableSubmit =
    state.name.trim().length === 0 ||
    state.matchValue.trim().length === 0 ||
    state.categoryId.length === 0;

  return (
    <Transition show={isOpen} as={Fragment}>
      <Dialog onClose={onClose} className="relative z-50">
        <TransitionChild
          as={Fragment}
          enter="ease-out duration-150"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-100"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-emerald-950/30 backdrop-blur-sm" />
        </TransitionChild>

        <div className="fixed inset-0 flex items-center justify-center p-4">
          <TransitionChild
            as={Fragment}
            enter="ease-out duration-150"
            enterFrom="opacity-0 scale-95"
            enterTo="opacity-100 scale-100"
            leave="ease-in duration-100"
            leaveFrom="opacity-100 scale-100"
            leaveTo="opacity-0 scale-95"
          >
            <DialogPanel className="w-full max-w-xl space-y-6 rounded-3xl border border-emerald-200/70 bg-white/95 p-6 shadow-[0_24px_55px_rgba(15,118,110,0.28)]">
              <div>
                <DialogTitle className="text-lg font-semibold text-emerald-950">
                  {mode === "create" ? "Create new rule" : "Edit rule"}
                </DialogTitle>
                <Description className="mt-1 text-sm text-emerald-800/90">
                  Rules automatically categorize incoming transactions. You can
                  optionally reprocess existing matches.
                </Description>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="space-y-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-800/70">
                      Name
                    </span>
                    <input
                      type="text"
                      required
                      value={state.name}
                      onChange={(event) =>
                        setState((prev) => ({
                          ...prev,
                          name: event.target.value,
                        }))
                      }
                      placeholder="e.g., Casey's Gas"
                      className="w-full rounded-xl border border-emerald-300/50 bg-white/95 px-3 py-2 text-sm font-medium text-emerald-900 shadow-inner focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-300"
                    />
                  </label>

                  <label className="space-y-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-800/70">
                      Category
                    </span>
                    <select
                      required
                      value={state.categoryId}
                      onChange={(event) =>
                        setState((prev) => ({
                          ...prev,
                          categoryId: event.target.value,
                        }))
                      }
                      className="w-full rounded-xl border border-emerald-300/50 bg-white/95 px-3 py-2 text-sm font-medium text-emerald-900 shadow-inner focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-300"
                    >
                      <option value="" disabled>
                        Select a category
                      </option>
                      {SECTION_ORDER.map((section) =>
                        categoryGroups[section].length > 0 ? (
                          <optgroup
                            key={section}
                            label={SECTION_META[section].label}
                          >
                            {categoryGroups[section].map((category) => (
                              <option key={category.id} value={category.id}>
                                {category.emoji} {category.name}
                              </option>
                            ))}
                          </optgroup>
                        ) : null
                      )}
                    </select>
                  </label>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="space-y-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-800/70">
                      Match field
                    </span>
                    <div className="rounded-2xl border border-emerald-200/70 bg-emerald-50/70 p-1.5">
                      <select
                        value={state.matchField}
                        onChange={(event) =>
                          setState((prev) => ({
                            ...prev,
                            matchField: event.target.value as RuleMatchField,
                          }))
                        }
                        className="w-full rounded-xl border border-emerald-200/0 bg-white/90 px-3 py-2 text-sm font-semibold text-emerald-900 shadow-inner focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-300"
                      >
                        {MATCH_FIELD_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <p className="px-3 pt-2 text-xs text-emerald-700/80">
                        {
                          MATCH_FIELD_OPTIONS.find(
                            (option) => option.value === state.matchField
                          )?.helper
                        }
                      </p>
                    </div>
                  </label>

                  <label className="space-y-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-800/70">
                      Match type
                    </span>
                    <select
                      value={state.matchType}
                      onChange={(event) =>
                        setState((prev) => ({
                          ...prev,
                          matchType: event.target.value as RuleMatchType,
                        }))
                      }
                      className="w-full rounded-xl border border-emerald-300/50 bg-white/95 px-3 py-2 text-sm font-medium text-emerald-900 shadow-inner focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-300"
                    >
                      {MATCH_TYPE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-800/70">
                    Match value
                  </span>
                  <input
                    type="text"
                    required
                    value={state.matchValue}
                    onChange={(event) =>
                      setState((prev) => ({
                        ...prev,
                        matchValue: event.target.value,
                      }))
                    }
                    placeholder="e.g., caseys or youtube"
                    className="w-full rounded-xl border border-emerald-300/50 bg-white/95 px-3 py-2 text-sm font-medium text-emerald-900 shadow-inner focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-300"
                  />
                </label>

                <div className="rounded-2xl border border-emerald-200/70 bg-emerald-50/70 px-4 py-3">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-800/70">
                        Apply to existing
                      </p>
                      <p className="text-xs text-emerald-700/80">
                        Re-run matches immediately for past transactions.
                      </p>
                    </div>
                    <Switch
                      checked={state.applyToExisting}
                      onChange={(next) =>
                        setState((prev) => ({
                          ...prev,
                          applyToExisting: next,
                        }))
                      }
                      srLabel="Apply rule to existing transactions"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:justify-end">
                  <Button
                    variant="ghost"
                    onClick={onClose}
                    disabled={submitting}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    loading={submitting}
                    disabled={disableSubmit}
                  >
                    {mode === "create" ? "Create rule" : "Save changes"}
                  </Button>
                </div>
              </form>
            </DialogPanel>
          </TransitionChild>
        </div>
      </Dialog>
    </Transition>
  );
}

type ToggleRuleDialogProps = {
  prompt: { rule: RuleRecord; nextState: boolean } | null;
  onClose: () => void;
  onConfirm: (options: { applyToExisting: boolean }) => Promise<void>;
  submitting: boolean;
};

function ToggleRuleDialog({
  prompt,
  onClose,
  onConfirm,
  submitting,
}: ToggleRuleDialogProps) {
  const isOpen = Boolean(prompt);
  const rule = prompt?.rule;

  return (
    <Transition show={isOpen} as={Fragment}>
      <Dialog onClose={onClose} className="relative z-50">
        <TransitionChild
          as={Fragment}
          enter="ease-out duration-150"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-100"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-emerald-950/30 backdrop-blur-sm" />
        </TransitionChild>
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <TransitionChild
            as={Fragment}
            enter="ease-out duration-150"
            enterFrom="opacity-0 scale-95"
            enterTo="opacity-100 scale-100"
            leave="ease-in duration-100"
            leaveFrom="opacity-100 scale-100"
            leaveTo="opacity-0 scale-95"
          >
            <DialogPanel className="w-full max-w-sm space-y-4 rounded-3xl border border-emerald-200/70 bg-white/95 p-6 shadow-[0_24px_55px_rgba(15,118,110,0.28)]">
              <DialogTitle className="text-lg font-semibold text-emerald-950">
                {prompt?.nextState ? "Enable rule?" : "Disable rule?"}
              </DialogTitle>
              <Description className="text-sm text-emerald-800/90">
                {prompt?.nextState
                  ? "Enable this rule to categorize future matches automatically."
                  : "Disabling the rule stops automatic categorization. You can optionally clear existing matches."}
              </Description>
              {rule ? (
                <div className="rounded-2xl border border-emerald-200/70 bg-emerald-50/70 px-4 py-3 text-sm text-emerald-900">
                  {describeRule(rule)}
                </div>
              ) : null}
              <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:justify-end">
                <Button variant="ghost" onClick={onClose} disabled={submitting}>
                  Cancel
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => onConfirm({ applyToExisting: false })}
                  disabled={submitting}
                >
                  {prompt?.nextState ? "Enable rule" : "Disable only"}
                </Button>
                <Button
                  onClick={() => onConfirm({ applyToExisting: true })}
                  loading={submitting}
                >
                  {prompt?.nextState
                    ? "Enable & apply"
                    : "Disable & clear matches"}
                </Button>
              </div>
            </DialogPanel>
          </TransitionChild>
        </div>
      </Dialog>
    </Transition>
  );
}

type DeleteRuleDialogProps = {
  prompt: RuleRecord | null;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  submitting: boolean;
};

function DeleteRuleDialog({
  prompt,
  onClose,
  onConfirm,
  submitting,
}: DeleteRuleDialogProps) {
  const isOpen = Boolean(prompt);

  return (
    <Transition show={isOpen} as={Fragment}>
      <Dialog onClose={onClose} className="relative z-50">
        <TransitionChild
          as={Fragment}
          enter="ease-out duration-150"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-100"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-emerald-950/30 backdrop-blur-sm" />
        </TransitionChild>
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <TransitionChild
            as={Fragment}
            enter="ease-out duration-150"
            enterFrom="opacity-0 scale-95"
            enterTo="opacity-100 scale-100"
            leave="ease-in duration-100"
            leaveFrom="opacity-100 scale-100"
            leaveTo="opacity-0 scale-95"
          >
            <DialogPanel className="w-full max-w-sm space-y-4 rounded-3xl border border-emerald-200/70 bg-white/95 p-6 shadow-[0_24px_55px_rgba(15,118,110,0.28)]">
              <DialogTitle className="text-lg font-semibold text-emerald-950">
                Delete rule?
              </DialogTitle>
              <Description className="text-sm text-emerald-800/90">
                Removing a rule stops automatic categorization for future
                matches. Existing transactions keep their current categories.
              </Description>
              {prompt ? (
                <div className="rounded-2xl border border-rose-200/60 bg-rose-50/70 px-4 py-3 text-sm text-rose-700">
                  {describeRule(prompt)}
                </div>
              ) : null}
              <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:justify-end">
                <Button variant="ghost" onClick={onClose} disabled={submitting}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={onConfirm}
                  loading={submitting}
                >
                  Delete rule
                </Button>
              </div>
            </DialogPanel>
          </TransitionChild>
        </div>
      </Dialog>
    </Transition>
  );
}

type RuleRowProps = {
  rule: RuleRecord;
  onEdit: (rule: RuleRecord) => void;
  onToggle: (rule: RuleRecord) => void;
  onDelete: (rule: RuleRecord) => void;
};

function RuleRow({ rule, onEdit, onToggle, onDelete }: RuleRowProps) {
  return (
    <div
      className={joinClassNames(
        "flex flex-col gap-3 rounded-2xl border bg-white/90 px-4 py-4 text-sm shadow-sm transition md:flex-row md:items-center md:justify-between",
        rule.isActive
          ? "border-transparent"
          : "border-emerald-100 bg-emerald-50/70 text-emerald-800/80"
      )}
    >
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <p className="font-semibold text-emerald-950">{rule.name}</p>
          {!rule.isActive ? (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-700">
              Inactive
            </span>
          ) : null}
        </div>
        <p className="text-xs text-emerald-800/90">{describeRule(rule)}</p>
      </div>
      <div className="flex items-center gap-3">
        <Switch
          checked={rule.isActive}
          onChange={() => onToggle(rule)}
          srLabel={`Toggle ${rule.name}`}
        />
        <Button variant="ghost" size="sm" onClick={() => onEdit(rule)}>
          Edit
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="text-rose-600 hover:bg-rose-50"
          onClick={() => onDelete(rule)}
        >
          Delete
        </Button>
      </div>
    </div>
  );
}

export default function RulesPage() {
  const [categories, setCategories] = useState<CategorySummary[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [rules, setRules] = useState<RuleRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState<ToastProps[]>([]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<"create" | "edit">("create");
  const [editorState, setEditorState] = useState<RuleFormState>({
    name: "",
    categoryId: "",
    matchField: "DESCRIPTION",
    matchType: "CONTAINS",
    matchValue: "",
    applyToExisting: true,
  });
  const [editorSubmitting, setEditorSubmitting] = useState(false);
  const [togglePrompt, setTogglePrompt] = useState<{
    rule: RuleRecord;
    nextState: boolean;
  } | null>(null);
  const [toggleSubmitting, setToggleSubmitting] = useState(false);
  const [deletePrompt, setDeletePrompt] = useState<RuleRecord | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [budgetSnapshot, setBudgetSnapshot] = useState<
    BudgetSnapshotData | null
  >(null);
  const [budgetRefreshId, setBudgetRefreshId] = useState(0);

  const dismissToast = useCallback((id?: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const pushToast = useCallback(
    (toast: Omit<ToastProps, "id"> & { id?: string }) => {
      const messageId = toast.id ?? createLocalId();
      const nextToast: ToastProps = { ...toast, id: messageId };
      setToasts((prev) => [
        nextToast,
        ...prev.filter((item) => item.id !== messageId),
      ]);
    },
    []
  );

  useEffect(() => {
    const controller = new AbortController();
    setCategoriesLoading(true);
    fetchCategories(controller.signal)
      .then((list) => {
        if (controller.signal.aborted) return;
        setCategories(list.map(mapCategoryToSummary));
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        console.warn("Failed to load categories", error);
        pushToast({
          title: "Couldn’t load categories",
          description:
            error instanceof Error ? error.message : "Unexpected error",
          variant: "danger",
        });
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setCategoriesLoading(false);
        }
      });

    return () => controller.abort();
  }, [pushToast]);

  const categoriesLookup = useMemo(() => {
    return categories.reduce<Record<string, CategorySummary>>(
      (accumulator, category) => {
        accumulator[category.id] = category;
        return accumulator;
      },
      {}
    );
  }, [categories]);

  const currentMonthKey = useMemo(() => getMonthKey(new Date()), []);
  const requestBudgetRefresh = useCallback(() => {
    setBudgetRefreshId((prev) => prev + 1);
  }, []);

  useEffect(() => {
    let active = true;
    fetchBudgetSnapshot(currentMonthKey)
      .then((snapshot) => {
        if (!active) return;
        setBudgetSnapshot(snapshot);
      })
      .catch((error) => {
        if (!active) return;
        console.warn("Failed to load budget snapshot", error);
        setBudgetSnapshot(null);
      });

    return () => {
      active = false;
    };
  }, [currentMonthKey, budgetRefreshId]);

  const budgetCategoryIds = useMemo(() => {
    if (!budgetSnapshot) return new Set<string>();
    const next = new Set<string>();
    for (const section of Object.values(budgetSnapshot.sections)) {
      for (const line of section) {
        next.add(line.categoryId);
      }
    }
    return next;
  }, [budgetSnapshot]);

  const loadRules = useCallback(async () => {
    setLoading(true);
    try {
      const rulesResponse = await fetch("/api/rules", { cache: "no-store" });
      if (!rulesResponse.ok) {
        throw new Error("Unable to load rules");
      }

      const rulesPayload = (await rulesResponse.json()) as {
        rules: Array<RuleRecord>;
      };

      setRules(rulesPayload.rules);
    } catch (error) {
      console.error(error);
      pushToast({
        title: "Unable to load rules",
        description: "Please refresh to try again.",
        variant: "danger",
        autoDismissMs: 4200,
      });
    } finally {
      setLoading(false);
    }
  }, [pushToast]);

  useEffect(() => {
    void loadRules();
  }, [loadRules]);

  const rulesWithCategory = useMemo(() => {
    return rules.map((rule) => {
      if (rule.categoryId) {
        const resolved = categoriesLookup[rule.categoryId] ?? null;
        if (
          resolved &&
          rule.category &&
          rule.category.id === resolved.id &&
          rule.category.name === resolved.name &&
          rule.category.emoji === resolved.emoji
        ) {
          return rule;
        }
        if (
          !resolved &&
          (rule.category === null || rule.category === undefined)
        ) {
          return { ...rule, category: null };
        }
        return { ...rule, category: resolved };
      }
      if (rule.category === undefined) {
        return { ...rule, category: null };
      }
      return rule;
    });
  }, [rules, categoriesLookup]);

  const openCreateDialog = useCallback(
    (category?: CategorySummary) => {
      const defaultCategoryId = category?.id ?? categories[0]?.id ?? "";
      setEditorMode("create");
      setEditorState({
        name: "",
        categoryId: defaultCategoryId,
        matchField: "DESCRIPTION",
        matchType: "CONTAINS",
        matchValue: "",
        applyToExisting: true,
      });
      setEditorOpen(true);
    },
    [categories]
  );

  const openEditDialog = useCallback(
    (rule: RuleRecord) => {
      setEditorMode("edit");
      setEditorState({
        id: rule.id,
        name: rule.name,
        categoryId: rule.categoryId ?? categories[0]?.id ?? "",
        matchField: rule.matchField,
        matchType: rule.matchType,
        matchValue: rule.matchValue,
        applyToExisting: false,
      });
      setEditorOpen(true);
    },
    [categories]
  );

  const handleEditorSubmit = useCallback(
    async (state: RuleFormState) => {
      setEditorSubmitting(true);
      try {
        if (editorMode === "create") {
          const response = await fetch("/api/rules", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: state.name,
              categoryId: state.categoryId,
              matchField: state.matchField,
              matchType: state.matchType,
              matchValue: state.matchValue,
              applyToExisting: state.applyToExisting,
            }),
          });

          if (!response.ok) {
            throw new Error("Failed to create rule");
          }

          const payload = await response.json();
          const newRule: RuleRecord = payload.rule;
          setRules((prev) => [
            newRule,
            ...prev.filter((item) => item.id !== newRule.id),
          ]);
          requestBudgetRefresh();
          pushToast({
            title: "Rule created",
            description: state.applyToExisting
              ? "Existing matches are being recategorized."
              : "New transactions will be categorized automatically.",
            variant: "success",
            autoDismissMs: 4200,
          });
        } else if (state.id) {
          const response = await fetch(`/api/rules/${state.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: state.name,
              categoryId: state.categoryId,
              matchField: state.matchField,
              matchType: state.matchType,
              matchValue: state.matchValue,
              applyToExisting: state.applyToExisting,
              reassignMode: state.applyToExisting ? "assign" : undefined,
            }),
          });

          if (!response.ok) {
            throw new Error("Failed to update rule");
          }

          const payload = await response.json();
          const updatedRule: RuleRecord = payload.rule;
          setRules((prev) =>
            prev.map((item) =>
              item.id === updatedRule.id ? updatedRule : item
            )
          );
          requestBudgetRefresh();
          pushToast({
            title: "Rule updated",
            description: state.applyToExisting
              ? "Existing matches are being refreshed."
              : "Future matches will use the updated details.",
            variant: "success",
            autoDismissMs: 4200,
          });
        }
        setEditorOpen(false);
      } catch (error) {
        console.error(error);
        pushToast({
          title: "Something went wrong",
          description: "We couldn’t save the rule. Please try again.",
          variant: "danger",
          autoDismissMs: 4500,
        });
      } finally {
        setEditorSubmitting(false);
      }
    },
    [editorMode, pushToast, requestBudgetRefresh]
  );

  const handleToggle = useCallback(
    async (
      prompt: { rule: RuleRecord; nextState: boolean },
      applyToExisting: boolean
    ) => {
      setToggleSubmitting(true);
      try {
        const response = await fetch(`/api/rules/${prompt.rule.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            isActive: prompt.nextState,
            applyToExisting: applyToExisting || undefined,
            reassignMode: applyToExisting
              ? prompt.nextState
                ? "assign"
                : "clear"
              : undefined,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to toggle rule");
        }

        const payload = await response.json();
        const updatedRule: RuleRecord = payload.rule;
        setRules((prev) =>
          prev.map((item) => (item.id === updatedRule.id ? updatedRule : item))
        );
        requestBudgetRefresh();
        pushToast({
          title: prompt.nextState ? "Rule enabled" : "Rule disabled",
          description: applyToExisting
            ? "Existing matches are being reprocessed."
            : "The change will apply to future transactions.",
          variant: "success",
          autoDismissMs: 4200,
        });
      } catch (error) {
        console.error(error);
        pushToast({
          title: "Toggle failed",
          description: "We couldn’t update that rule. Please try again.",
          variant: "danger",
          autoDismissMs: 4500,
        });
      } finally {
        setToggleSubmitting(false);
        setTogglePrompt(null);
      }
    },
    [pushToast, requestBudgetRefresh]
  );

  const handleDelete = useCallback(async () => {
    if (!deletePrompt) return;
    setDeleteSubmitting(true);
    try {
      const response = await fetch(`/api/rules/${deletePrompt.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete rule");
      }

      setRules((prev) => prev.filter((item) => item.id !== deletePrompt.id));
      requestBudgetRefresh();
      pushToast({
        title: "Rule deleted",
        description: "Future transactions will no longer use this automation.",
        variant: "success",
        autoDismissMs: 4200,
      });
    } catch (error) {
      console.error(error);
      pushToast({
        title: "Delete failed",
        description: "We couldn’t remove that rule. Please try again.",
        variant: "danger",
        autoDismissMs: 4500,
      });
    } finally {
      setDeleteSubmitting(false);
      setDeletePrompt(null);
    }
  }, [deletePrompt, pushToast, requestBudgetRefresh]);

  const normalizedSearch = searchTerm.trim().toLowerCase();

  const sectionsContent = SECTION_ORDER.map((section) => {
    const sectionCategories = categories.filter(
      (category) => category.section === section
    );
    if (sectionCategories.length === 0) return null;

    const sectionRulesCount = rulesWithCategory.filter(
      (rule) => rule.category?.section === section
    ).length;

    const sectionElements = sectionCategories
      .map((category) => {
        const categoryRules = rulesWithCategory.filter(
          (rule) => rule.categoryId === category.id
        );
        const hasCategoryRules = categoryRules.length > 0;

        const visibleRules = normalizedSearch
          ? categoryRules.filter((rule) => {
              const description = describeRule(rule).toLowerCase();
              return (
                rule.name.toLowerCase().includes(normalizedSearch) ||
                description.includes(normalizedSearch) ||
                category.name.toLowerCase().includes(normalizedSearch)
              );
            })
          : categoryRules;

        const matchesSearch =
          normalizedSearch.length === 0
            ? true
            : visibleRules.length > 0 ||
              category.name.toLowerCase().includes(normalizedSearch);

        if (!hasCategoryRules && normalizedSearch.length === 0) {
          return null;
        }

        if (!matchesSearch) return null;

        const connectedToBudget = budgetCategoryIds.has(category.id);

        return (
          <div
            key={category.id}
            className="space-y-3 rounded-3xl border border-emerald-100 bg-gradient-to-b from-white to-emerald-50/60 p-5 shadow-[0_18px_40px_rgba(15,118,110,0.08)]"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{category.emoji}</span>
                <div>
                  <p className="text-base font-semibold text-emerald-950">
                    {category.name}
                  </p>
                  <p className="text-xs text-emerald-700/80">
                    {connectedToBudget
                      ? "Rules run after imports and manual entries."
                      : "Not linked to this month’s budget yet."}
                  </p>
                </div>
              </div>
              <Button
                variant="secondary"
                size="sm"
                disabled={categories.length === 0}
                onClick={() => openCreateDialog(category)}
              >
                Add rule
              </Button>
            </div>

            {visibleRules.length > 0 ? (
              <div className="space-y-3">
                {visibleRules.map((rule) => (
                  <RuleRow
                    key={rule.id}
                    rule={rule}
                    onEdit={openEditDialog}
                    onToggle={(candidate) =>
                      setTogglePrompt({
                        rule: candidate,
                        nextState: !candidate.isActive,
                      })
                    }
                    onDelete={(candidate) => setDeletePrompt(candidate)}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-emerald-200/60 bg-white/70 px-4 py-5 text-sm text-emerald-800">
                {categoryRules.length === 0
                  ? "No rules yet. Add one to automate this category."
                  : "No rules match this search."}
              </div>
            )}
          </div>
        );
      })
      .filter(Boolean);

    if (sectionElements.length === 0) return null;

    return (
      <section key={section} className="space-y-3">
        <header className="flex flex-col gap-2 rounded-3xl border border-emerald-100 bg-gradient-to-r p-5 text-emerald-900 shadow-[0_18px_40px_rgba(15,118,110,0.08)] sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-emerald-950">
              {SECTION_META[section].label}
            </h2>
            <p className="text-sm text-emerald-700/80">
              {SECTION_META[section].description}
            </p>
          </div>
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700/80">
            {sectionRulesCount} {sectionRulesCount === 1 ? "rule" : "rules"}
          </span>
        </header>
        <div className="space-y-4">{sectionElements}</div>
      </section>
    );
  });

  const renderedSections = sectionsContent.filter(
    (section): section is JSX.Element => Boolean(section)
  );

  return (
    <Fragment>
      {toasts.map((toast) => (
        <Fragment key={toast.id}>
          <Toast
            title={toast.title}
            description={toast.description}
            variant={toast.variant}
            actions={toast.actions}
            dismissible={toast.dismissible}
            persistent={toast.persistent}
            autoDismissMs={toast.autoDismissMs}
            onDismiss={() => dismissToast(toast.id)}
          />
        </Fragment>
      ))}

      <section className="space-y-6 pb-16">
        <header className="flex flex-col gap-4 rounded-3xl border border-emerald-700/20 bg-[#CAEFD1]/80 p-5 shadow-[0_20px_45px_rgba(22,101,52,0.22)] backdrop-blur-md md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.38em] text-emerald-800/80">
              Automations
            </p>
            <h1 className="text-xl font-semibold text-emerald-950">
              Rules & smart categorization
            </h1>
            <p className="mt-1 text-sm text-emerald-800/80">
              Teach the app how to classify merchants, subscriptions, and
              recurring expenses. We’ll prompt you before reprocessing past
              transactions.
            </p>
          </div>
          <Button
            onClick={() => openCreateDialog()}
            disabled={categoriesLoading || categories.length === 0}
          >
            New rule
          </Button>
        </header>

        <div className="space-y-3 rounded-3xl border border-emerald-100 bg-white/95 p-5 shadow-[0_14px_36px_rgba(15,118,110,0.12)]">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex-1">
              <div className="relative">
                <input
                  type="search"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search rules by name or keyword"
                  className="w-full rounded-2xl border border-emerald-200/70 bg-emerald-50/70 px-4 py-2.5 pr-10 text-sm text-emerald-900 shadow-inner focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-300"
                />
                {searchTerm ? (
                  <button
                    type="button"
                    onClick={() => setSearchTerm("")}
                    className="absolute inset-y-0 right-3 grid place-items-center text-emerald-600/80 transition hover:text-emerald-800"
                    aria-label="Clear search"
                  >
                    ×
                  </button>
                ) : null}
              </div>
            </div>
            <div className="rounded-2xl border border-emerald-200/70 bg-emerald-50/70 px-4 py-3 text-xs text-emerald-800/90">
              <p className="font-semibold uppercase tracking-[0.18em]">
                Heads up
              </p>
              <p>
                Changes save instantly. When something could impact historical
                data we’ll ask before reprocessing existing transactions.
              </p>
            </div>
          </div>

          {loading ? (
            <div className="rounded-2xl border border-emerald-100 bg-white/90 px-5 py-6 text-sm text-emerald-800">
              Loading your rules…
            </div>
          ) : renderedSections.length > 0 ? (
            <div className="space-y-6">{renderedSections}</div>
          ) : (
            <div className="rounded-2xl border border-dashed border-emerald-200/70 bg-emerald-50/70 px-5 py-6 text-center text-sm text-emerald-800">
              {normalizedSearch.length > 0
                ? `No rules match “${searchTerm.trim()}”.`
                : "Create your first rule to automatically categorize transactions."}
            </div>
          )}
        </div>
      </section>

      {editorOpen ? (
        <RuleEditorDialog
          isOpen={editorOpen}
          mode={editorMode}
          categories={categories}
          initialState={editorState}
          onClose={() => setEditorOpen(false)}
          onSubmit={handleEditorSubmit}
          submitting={editorSubmitting}
        />
      ) : null}

      <ToggleRuleDialog
        prompt={togglePrompt}
        onClose={() => setTogglePrompt(null)}
        onConfirm={({ applyToExisting }) =>
          togglePrompt
            ? handleToggle(togglePrompt, applyToExisting)
            : Promise.resolve()
        }
        submitting={toggleSubmitting}
      />
      <DeleteRuleDialog
        prompt={deletePrompt}
        onClose={() => {
          if (!deleteSubmitting) {
            setDeletePrompt(null);
          }
        }}
        onConfirm={handleDelete}
        submitting={deleteSubmitting}
      />
    </Fragment>
  );
}
