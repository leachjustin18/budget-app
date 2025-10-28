import type {
  BudgetLine,
  BudgetSectionKey,
  BudgetSnapshot,
  IncomePlan,
} from "@budget/lib/types/domain";

type BudgetIncomePayload = {
  uuid: string;
  source: string;
  amount: number | null;
};

type BudgetCategoryPayload = {
  uuid: string;
  name: string;
  emoji: string;
  planned: number | null;
  spent: number | null;
  carryForward: boolean;
  repeat: "monthly" | "once";
};

type BudgetResponsePayload = {
  budget: {
    income: BudgetIncomePayload[];
    sections: Record<BudgetSectionKey, BudgetCategoryPayload[]>;
  };
  exists: boolean;
};

type BudgetSectionsPostPayload = Record<
  BudgetSectionKey,
  Array<{
    uuid: string;
    name: string;
    emoji: string;
    planned: number | null;
    spent: number | null;
    carryForward: boolean;
    repeat: "monthly" | "once";
  }>
>;

type BudgetPostPayload = {
  income: Array<{ uuid: string; source: string; amount: number | null }>;
  sections: BudgetSectionsPostPayload;
};

const SECTION_KEYS: BudgetSectionKey[] = [
  "expenses",
  "recurring",
  "savings",
  "debt",
];

const mapIncome = (
  monthKey: string,
  income: BudgetIncomePayload[]
): IncomePlan[] => {
  return income.map((plan) => ({
    id: plan.uuid,
    budgetId: monthKey,
    source: plan.source,
    amount: plan.amount,
  }));
};

const mapSectionEntries = (
  monthKey: string,
  sectionKey: BudgetSectionKey,
  entries: BudgetCategoryPayload[]
): BudgetLine[] => {
  return entries.map((line) => ({
    id: `${monthKey}:${line.uuid}`,
    budgetId: monthKey,
    categoryId: line.uuid,
    section: sectionKey,
    name: line.name,
    emoji: line.emoji ?? "✨",
    planned: line.planned ?? null,
    spent: line.spent ?? null,
    carryForward: line.carryForward,
    repeat: line.repeat,
    notes: null,
  }));
};

const normalizeBudgetResponse = (
  monthKey: string,
  payload: BudgetResponsePayload
): BudgetSnapshot => {
  const income = mapIncome(monthKey, payload.budget.income ?? []);

  const sections: Record<BudgetSectionKey, BudgetLine[]> = {
    expenses: [],
    recurring: [],
    savings: [],
    debt: [],
  };

  for (const sectionKey of SECTION_KEYS) {
    const sectionEntries = payload.budget.sections[sectionKey] ?? [];
    sections[sectionKey] = mapSectionEntries(
      monthKey,
      sectionKey,
      sectionEntries
    );
  }

  return {
    monthKey,
    exists: payload.exists,
    income,
    sections,
  };
};

const serializeSnapshot = (snapshot: BudgetSnapshot): BudgetPostPayload => {
  const income = snapshot.income.map((plan) => ({
    uuid: plan.id,
    source: plan.source,
    amount: plan.amount,
  }));

  const sections: BudgetSectionsPostPayload = {
    expenses: [],
    recurring: [],
    savings: [],
    debt: [],
  };

  for (const sectionKey of SECTION_KEYS) {
    const lines = snapshot.sections[sectionKey] ?? [];
    sections[sectionKey] = lines.map((line) => ({
      uuid: line.categoryId,
      name: line.name,
      emoji: line.emoji,
      planned: line.planned ?? null,
      spent: line.spent ?? null,
      carryForward: line.carryForward,
      repeat: line.repeat,
    }));
  }

  return { income, sections };
};

const readJson = async <T>(response: Response): Promise<T> => {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new Error("Unexpected response from server");
  }
  return (await response.json()) as T;
};

const resolveError = async (response: Response) => {
  let message = `Request failed with status ${response.status}`;
  try {
    const payload = await readJson<{ error?: string }>(response);
    if (payload?.error) {
      message = payload.error;
    }
  } catch {
    // swallow parse error
  }
  throw new Error(message);
};

export const fetchBudgetSnapshot = async (
  monthKey: string
): Promise<BudgetSnapshot> => {
  const response = await fetch(`/api/budgets/${monthKey}`, {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) {
    await resolveError(response);
  }

  const payload = await readJson<BudgetResponsePayload>(response);
  return normalizeBudgetResponse(monthKey, payload);
};

export const saveBudgetSnapshot = async (
  monthKey: string,
  snapshot: BudgetSnapshot
): Promise<BudgetSnapshot> => {
  const response = await fetch(`/api/budgets/${monthKey}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({ budget: serializeSnapshot(snapshot) }),
  });

  if (!response.ok) {
    await resolveError(response);
  }

  const payload = await readJson<BudgetResponsePayload>(response);
  return normalizeBudgetResponse(monthKey, payload);
};
