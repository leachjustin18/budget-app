"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Dialog, Transition } from "@headlessui/react";
import { Button } from "@budget/components/UI/Button";
import { type ToastProps } from "@budget/components/UI/ToastUI";
import {
  deleteCategory as apiDeleteCategory,
  fetchCategories,
  updateCategory as apiUpdateCategory,
} from "@budget/lib/api/categories";
import type {
  Category,
  CategorySection,
} from "@budget/lib/types/domain";

export type ManagedCategory = Category;

type ToastPayload = Omit<ToastProps, "id"> & { id?: string };

type CategoryManagerDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  notify?: (toast: ToastPayload) => void;
  onCategoryUpdated?: (category: ManagedCategory) => void;
  onCategoryRemoved?: (
    categoryId: string,
    options: {
      transactionsTargetId: string | null;
      budgetTargetId: string | null;
    }
  ) => void;
};

const SECTION_ORDER: CategorySection[] = [
  "EXPENSES",
  "RECURRING",
  "SAVINGS",
  "DEBT",
];

const SECTION_LABELS: Record<CategorySection, string> = {
  EXPENSES: "Expenses",
  RECURRING: "Recurring",
  SAVINGS: "Savings",
  DEBT: "Debt",
};

const SECTION_DESCRIPTIONS: Record<CategorySection, string> = {
  EXPENSES: "Everyday spending categories you track each month.",
  RECURRING: "Subscriptions and bills that repeat on a schedule.",
  SAVINGS: "Goals and future plans you are setting cash aside for.",
  DEBT: "Loans and repayments you are managing.",
};

type DeleteDraft = {
  category: ManagedCategory;
  transactionsTargetId: string | null;
  budgetTargetId: string | null;
};

export default function CategoryManagerDialog({
  isOpen,
  onClose,
  notify,
  onCategoryRemoved,
  onCategoryUpdated,
}: CategoryManagerDialogProps) {
  const [categories, setCategories] = useState<ManagedCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deleteDraft, setDeleteDraft] = useState<DeleteDraft | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<
    Record<string, { name: string; emoji: string }>
  >({});

  const loadCategories = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError(null);
      try {
        const next = await fetchCategories(signal);
        if (signal?.aborted) return;
        setCategories(next);
        setDrafts({});
      } catch (cause) {
        if (signal?.aborted) return;
        console.error("Failed to load categories", cause);
        const message =
          cause instanceof Error
            ? cause.message
            : "Unable to load categories right now.";
        setError(message);
      } finally {
        if (!signal?.aborted) {
          setLoading(false);
        }
      }
    },
    []
  );

  useEffect(() => {
    if (!isOpen) return;
    if (categories.length > 0) return;

    const abortController = new AbortController();
    void loadCategories(abortController.signal);

    return () => {
      abortController.abort();
    };
  }, [categories.length, isOpen, loadCategories]);

  const groupedCategories = useMemo(() => {
    return categories.reduce<Record<CategorySection, ManagedCategory[]>>(
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

  const updateDraft = (id: string, field: "name" | "emoji", value: string) => {
    setDrafts((prev) => ({
      ...prev,
      [id]: {
        name: field === "name" ? value : prev[id]?.name ?? "",
        emoji: field === "emoji" ? value : prev[id]?.emoji ?? "",
      },
    }));
  };

  const handleSave = async (category: ManagedCategory) => {
    const draft = drafts[category.id];
    const nextName = draft?.name?.trim() || category.name;
    const nextEmoji = draft?.emoji?.trim() || category.emoji;

    const updatePayload: Partial<Pick<ManagedCategory, "name" | "emoji">> = {};
    if (nextName !== category.name) {
      updatePayload.name = nextName;
    }
    if (nextEmoji !== category.emoji) {
      updatePayload.emoji = nextEmoji;
    }

    if (Object.keys(updatePayload).length === 0) {
      notify?.({
        title: "No changes to save",
        description: "Update the name or emoji before saving.",
        variant: "info",
      });
      return;
    }

    setSavingId(category.id);
    try {
      const updated = await apiUpdateCategory(category.id, updatePayload);
      setCategories((prev) =>
        prev.map((item) => (item.id === updated.id ? updated : item))
      );
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[category.id];
        return next;
      });
      notify?.({
        title: "Category updated",
        description: "Changes apply everywhere this category is used.",
        variant: "success",
      });
      onCategoryUpdated?.(updated);
    } catch (error) {
      console.error("Failed to update category", error);
      notify?.({
        title: "Update failed",
        description:
          error instanceof Error
            ? error.message
            : "We couldn’t update that category.",
        variant: "danger",
      });
    } finally {
      setSavingId(null);
    }
  };

  const openDeletePrompt = (category: ManagedCategory) => {
    setDeleteDraft({
      category,
      transactionsTargetId: null,
      budgetTargetId: null,
    });
  };

  const resetDeleteDraft = () => {
    if (deletingId) return;
    setDeleteDraft(null);
  };

  const handleDelete = async () => {
    if (!deleteDraft) return;
    const { category, transactionsTargetId, budgetTargetId } = deleteDraft;
    setDeletingId(category.id);

    try {
      await apiDeleteCategory(category.id, {
        transactionsTargetId: transactionsTargetId ?? null,
        budgetTargetId: budgetTargetId ?? null,
      });
      setCategories((prev) =>
        prev.filter((existing) => existing.id !== category.id)
      );
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[category.id];
        return next;
      });
      notify?.({
        title: "Category removed",
        description:
          transactionsTargetId || budgetTargetId
            ? "Linked items were reassigned."
            : "Linked items were cleared from this category.",
        variant: "success",
      });
      onCategoryRemoved?.(category.id, {
        transactionsTargetId: transactionsTargetId ?? null,
        budgetTargetId: budgetTargetId ?? null,
      });
      setDeleteDraft(null);
    } catch (error) {
      console.error("Failed to delete category", error);
      notify?.({
        title: "Delete failed",
        description:
          error instanceof Error
            ? error.message
            : "We couldn’t remove that category.",
        variant: "danger",
      });
    } finally {
      setDeletingId(null);
    }
  };

  const hasCategories = categories.length > 0;

  return (
    <Transition show={isOpen} as={Fragment}>
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
            <Dialog.Panel className="w-full max-w-3xl space-y-6 rounded-3xl border border-emerald-200/70 bg-white/95 p-6 shadow-[0_24px_55px_rgba(15,118,110,0.22)]">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <Dialog.Title className="text-lg font-semibold text-emerald-950">
                    Manage categories
                  </Dialog.Title>
                  <Dialog.Description className="text-sm text-emerald-800/90">
                    Rename or remove categories. Changes apply everywhere they
                    are referenced.
                  </Dialog.Description>
                </div>
                <Button variant="ghost" size="sm" onClick={onClose}>
                  Close
                </Button>
              </div>

              {loading ? (
                <div className="rounded-2xl border border-emerald-100 bg-white/90 px-5 py-6 text-sm text-emerald-800">
                  Loading categories…
                </div>
              ) : error ? (
                <div className="rounded-2xl border border-rose-200/70 bg-rose-50/70 px-5 py-6 text-sm text-rose-700">
                  {error}
                </div>
              ) : hasCategories ? (
                <div className="space-y-5">
                  {SECTION_ORDER.map((section) => {
                    const sectionCategories = groupedCategories[section];
                    if (sectionCategories.length === 0) return null;

                    return (
                      <div
                        key={section}
                        className="space-y-3 rounded-3xl border border-emerald-100 bg-gradient-to-b from-white to-emerald-50/50 p-5"
                      >
                        <header className="space-y-1">
                          <h3 className="text-base font-semibold text-emerald-950">
                            {SECTION_LABELS[section]}
                          </h3>
                          <p className="text-sm text-emerald-700/80">
                            {SECTION_DESCRIPTIONS[section]}
                          </p>
                        </header>
                        <div className="space-y-3">
                          {sectionCategories.map((category) => {
                            const draft = drafts[category.id];
                            const nextName = draft?.name ?? category.name;
                            const nextEmoji = draft?.emoji ?? category.emoji;
                            const pendingChanges =
                              nextName.trim() !== category.name ||
                              nextEmoji.trim() !== category.emoji;
                            const saving = savingId === category.id;

                            const transactionImpacts =
                              category.usage.transactions +
                              category.usage.transactionSplits;
                            const showImpacts =
                              transactionImpacts > 0 ||
                              category.usage.budgets > 0 ||
                              category.usage.rules > 0;

                            return (
                              <div
                                key={category.id}
                                className="space-y-3 rounded-2xl border border-emerald-200/60 bg-white/90 p-4 shadow-sm"
                              >
                                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                  <div className="flex flex-1 items-center gap-3">
                                    <input
                                      value={nextEmoji}
                                      onChange={(event) =>
                                        updateDraft(
                                          category.id,
                                          "emoji",
                                          event.target.value.slice(0, 3)
                                        )
                                      }
                                      aria-label={`Emoji for ${category.name}`}
                                      className="w-16 rounded-2xl border border-emerald-200/70 bg-white px-3 py-2 text-center text-2xl shadow-inner focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-300"
                                    />
                                    <div className="flex-1">
                                      <label className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700/70">
                                        Category name
                                      </label>
                                      <input
                                        value={nextName}
                                        onChange={(event) =>
                                          updateDraft(
                                            category.id,
                                            "name",
                                            event.target.value
                                          )
                                        }
                                        className="mt-1 w-full rounded-2xl border border-emerald-200/70 bg-white px-3 py-2 text-sm font-medium text-emerald-900 shadow-inner focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-300"
                                      />
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 self-start md:self-center">
                                    <Button
                                      variant="secondary"
                                      size="sm"
                                      disabled={!pendingChanges}
                                      loading={saving}
                                      onClick={() => handleSave(category)}
                                    >
                                      Save
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="text-rose-600 hover:bg-rose-50"
                                      onClick={() => openDeletePrompt(category)}
                                    >
                                      Delete
                                    </Button>
                                  </div>
                                </div>
                                {showImpacts ? (
                                  <div className="rounded-2xl border border-amber-200/60 bg-amber-50/60 px-4 py-3 text-xs text-amber-800">
                                    <p className="font-semibold uppercase tracking-[0.18em]">
                                      Linked data
                                    </p>
                                    <div className="mt-1 space-y-1">
                                      {transactionImpacts > 0 ? (
                                        <p>
                                          {transactionImpacts} transaction
                                          {transactionImpacts === 1
                                            ? ""
                                            : "s"}{" "}
                                          currently use this category.
                                        </p>
                                      ) : null}
                                      {category.usage.budgets > 0 ? (
                                        <p>
                                          {category.usage.budgets} budget
                                          allocation
                                          {category.usage.budgets === 1
                                            ? ""
                                            : "s"}{" "}
                                          include it.
                                        </p>
                                      ) : null}
                                      {category.usage.rules > 0 ? (
                                        <p>
                                          {category.usage.rules} automation
                                          {category.usage.rules === 1
                                            ? ""
                                            : "s"}{" "}
                                          reference this category.
                                        </p>
                                      ) : null}
                                    </div>
                                  </div>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-emerald-200/70 bg-emerald-50/70 px-5 py-6 text-center text-sm text-emerald-800">
                  You have not created any categories yet.
                </div>
              )}
            </Dialog.Panel>
          </Transition.Child>
        </div>
      </Dialog>

      <Transition show={Boolean(deleteDraft)} as={Fragment}>
        <Dialog onClose={resetDeleteDraft} className="relative z-[60]">
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
              <Dialog.Panel className="w-full max-w-lg space-y-5 rounded-3xl border border-emerald-200/70 bg-white/95 p-6 shadow-[0_24px_55px_rgba(15,118,110,0.28)]">
                {deleteDraft ? (
                  <>
                    <div className="space-y-1">
                      <Dialog.Title className="text-lg font-semibold text-emerald-950">
                        Delete {deleteDraft.category.name}?
                      </Dialog.Title>
                      <Dialog.Description className="text-sm text-emerald-800/90">
                        This action removes the category everywhere. Reassign
                        anything linked to it before proceeding.
                      </Dialog.Description>
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-2 rounded-2xl border border-emerald-200/70 bg-emerald-50/60 px-4 py-3 text-xs text-emerald-800">
                        <p>
                          {deleteDraft.category.usage.transactions +
                            deleteDraft.category.usage.transactionSplits}{" "}
                          transactions, {deleteDraft.category.usage.budgets}{" "}
                          budget allocations, and{" "}
                          {deleteDraft.category.usage.rules} rules currently
                          reference this category.
                        </p>
                        <p>
                          Leaving a reassignment blank will clear those
                          references.
                        </p>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700/70">
                          Reassign transactions to
                        </label>
                        <select
                          value={deleteDraft.transactionsTargetId ?? ""}
                          onChange={(event) =>
                            setDeleteDraft((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    transactionsTargetId:
                                      event.target.value.length > 0
                                        ? event.target.value
                                        : null,
                                  }
                                : prev
                            )
                          }
                          className="w-full rounded-2xl border border-emerald-200/70 bg-white px-3 py-2 text-sm text-emerald-900 shadow-inner focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-300"
                        >
                          <option value="">Clear from transactions</option>
                          {categories
                            .filter((item) => item.id !== deleteDraft.category.id)
                            .map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.emoji} {item.name}
                              </option>
                            ))}
                        </select>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700/70">
                          Move budget amounts to
                        </label>
                        <select
                          value={deleteDraft.budgetTargetId ?? ""}
                          onChange={(event) =>
                            setDeleteDraft((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    budgetTargetId:
                                      event.target.value.length > 0
                                        ? event.target.value
                                        : null,
                                  }
                                : prev
                            )
                          }
                          className="w-full rounded-2xl border border-emerald-200/70 bg-white px-3 py-2 text-sm text-emerald-900 shadow-inner focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-300"
                        >
                          <option value="">Remove from budgets</option>
                          {categories
                            .filter(
                              (item) =>
                                item.id !== deleteDraft.category.id &&
                                item.section === deleteDraft.category.section
                            )
                            .map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.emoji} {item.name}
                              </option>
                            ))}
                        </select>
                        {categories.filter(
                          (item) =>
                            item.id !== deleteDraft.category.id &&
                            item.section === deleteDraft.category.section
                        ).length === 0 ? (
                          <p className="text-xs text-emerald-600">
                            No other categories are available in this section.
                            Leaving this blank will remove matching budget
                            allocations.
                          </p>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={resetDeleteDraft}
                        disabled={Boolean(deletingId)}
                      >
                        Cancel
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        loading={Boolean(deletingId)}
                        onClick={handleDelete}
                      >
                        Delete category
                      </Button>
                    </div>
                  </>
                ) : null}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition>
    </Transition>
  );
}
