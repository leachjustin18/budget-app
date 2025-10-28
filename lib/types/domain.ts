export type CategorySection = "EXPENSES" | "RECURRING" | "SAVINGS" | "DEBT";

export type RepeatCadence = "MONTHLY" | "ONCE";

export type BudgetSectionKey = "expenses" | "recurring" | "savings" | "debt";

export type CategoryUsage = {
  budgets: number;
  transactions: number;
  transactionSplits: number;
  rules: number;
};

export type Category = {
  id: string;
  name: string;
  emoji: string;
  section: CategorySection;
  carryForwardDefault: boolean;
  repeatCadenceDefault: RepeatCadence;
  usage: CategoryUsage;
  sortOrder?: number;
  updatedAt?: string;
};

export type IncomePlan = {
  id: string;
  budgetId: string;
  source: string;
  amount: number | null;
  createdAt?: string;
  updatedAt?: string;
};

export type BudgetLine = {
  id: string;
  budgetId: string;
  categoryId: string;
  section: BudgetSectionKey;
  name: string;
  emoji: string;
  planned: number | null;
  spent: number | null;
  carryForward: boolean;
  repeat: "monthly" | "once";
  notes?: string | null;
};

export type BudgetSnapshot = {
  monthKey: string;
  exists: boolean;
  income: IncomePlan[];
  sections: Record<BudgetSectionKey, BudgetLine[]>;
};
