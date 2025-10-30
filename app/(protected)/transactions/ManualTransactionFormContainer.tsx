"use client";

import { useMemo } from "react";
import TransactionForm from "./TransactionForm";
import { mapTransactionToFormState } from "./formHelpers";
import type {
  ApiTransaction,
  BudgetSnapshot,
  CategoryOption,
  TransactionFormSubmitPayload,
} from "./types";

type ManualTransactionFormContainerProps = {
  formKey?: number;
  transaction?: ApiTransaction | null;
  budgetByCategory: BudgetSnapshot;
  submitting?: boolean;
  submitLabel: string;
  onSubmit: (payload: TransactionFormSubmitPayload) => Promise<void>;
  onCancel?: () => void;
  showCancel?: boolean;
  onCreateCategory?: () => Promise<CategoryOption | null>;
  categories: CategoryOption[];
  categoriesLoading?: boolean;
};

export function TransactionFormSkeleton() {
  return (
    <div className="space-y-4" data-testid="transaction-form-skeleton">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="space-y-2">
          <div className="h-3 w-24 rounded-full bg-emerald-100/60" />
          <div className="h-10 w-full animate-pulse rounded-2xl bg-emerald-100/80" />
        </div>
      ))}
    </div>
  );
}

export default function ManualTransactionFormContainer({
  formKey,
  transaction,
  budgetByCategory,
  submitting = false,
  submitLabel,
  onSubmit,
  onCancel,
  showCancel,
  onCreateCategory,
  categories,
  categoriesLoading = false,
}: ManualTransactionFormContainerProps) {
  const defaultCategoryId = useMemo(() => {
    if (!categories.length) return "";
    const uncategorized = categories.find(
      (category) => category.name.toLowerCase() === "uncategorized"
    );
    return (uncategorized ?? categories[0]).id;
  }, [categories]);

  const initialState = useMemo(() => {
    if (!transaction) return undefined;
    if (!defaultCategoryId) return undefined;
    return mapTransactionToFormState(transaction, defaultCategoryId);
  }, [transaction, defaultCategoryId]);

  if (categoriesLoading || categories.length === 0) {
    return <TransactionFormSkeleton />;
  }

  return (
    <TransactionForm
      key={formKey}
      categories={categories}
      budgetByCategory={budgetByCategory}
      defaultCategoryId={defaultCategoryId}
      onSubmit={onSubmit}
      submitLabel={submitLabel}
      submitting={submitting}
      showCancel={showCancel}
      onCancel={onCancel}
      onCreateCategory={onCreateCategory}
      initialState={initialState}
    />
  );
}
