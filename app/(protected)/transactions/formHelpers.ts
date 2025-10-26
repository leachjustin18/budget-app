import type { Category } from "@budget/app/providers/CacheProvider";
import type {
  ApiTransaction,
  CategoryOption,
  TransactionFormState,
} from "./types";

export const mapCategoryToOption = (category: Category): CategoryOption => ({
  id: category.id,
  name: category.name,
  emoji: category.emoji,
  section: category.section,
  carryForwardDefault: category.carryForwardDefault,
  repeatCadenceDefault: category.repeatCadenceDefault,
  usage: category.usage,
});

export const mapTransactionToFormState = (
  transaction: ApiTransaction,
  fallbackCategoryId: string
): Partial<TransactionFormState> => {
  const resolvedSplits = transaction.splits.length
    ? transaction.splits
    : [
        {
          id:
            typeof crypto !== "undefined" && crypto.randomUUID
              ? crypto.randomUUID()
              : `split-${Math.random().toString(36).slice(2, 10)}`,
          amount: transaction.amount,
          memo: "",
          category: null,
        },
      ];

  return {
    occurredOn: transaction.occurredOn,

    merchant: transaction.merchantName,
    description: transaction.description,
    memo: transaction.memo,
    amount: transaction.amount.toFixed(2),
    type: transaction.type,
    splits: resolvedSplits.map((split) => ({
      id: split.id,
      categoryId:
        split.category?.id ?? transaction.categoryId ?? fallbackCategoryId,
      amount: split.amount.toFixed(2),
      memo: split.memo ?? "",
    })),
  } satisfies Partial<TransactionFormState>;
};
