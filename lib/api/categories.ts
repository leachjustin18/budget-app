import type {
  Category,
  CategorySection,
  RepeatCadence,
} from "@budget/lib/types/domain";

type CategoryApiPayload = {
  id: string;
  name: string;
  emoji?: string | null;
  section: CategorySection;
  carryForwardDefault: boolean;
  repeatCadenceDefault: RepeatCadence;
  usage: Category["usage"];
  sortOrder?: number | null;
  updatedAt?: string | null;
};

type CategoryListResponse = {
  categories?: CategoryApiPayload[];
};

type CategoryResponse = {
  category: CategoryApiPayload;
};

const mapCategoryPayload = (payload: CategoryApiPayload): Category => ({
  id: payload.id,
  name: payload.name,
  emoji: payload.emoji?.trim() || "✨",
  section: payload.section,
  carryForwardDefault: payload.carryForwardDefault,
  repeatCadenceDefault: payload.repeatCadenceDefault,
  usage: payload.usage,
  sortOrder: payload.sortOrder ?? undefined,
  updatedAt: payload.updatedAt ?? undefined,
});

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
    // ignore json parse error
  }
  throw new Error(message);
};

export const fetchCategories = async (
  signal?: AbortSignal
): Promise<Category[]> => {
  const response = await fetch("/api/categories", {
    method: "GET",
    cache: "no-store",
    signal,
  });

  if (!response.ok) {
    await resolveError(response);
  }

  const payload = await readJson<CategoryListResponse>(response);
  const categories = payload.categories ?? [];
  return categories.map(mapCategoryPayload);
};

export const createCategory = async (input: {
  name: string;
  emoji?: string;
  section: CategorySection;
  carryForward?: boolean;
  repeatCadence?: RepeatCadence;
}): Promise<Category> => {
  const response = await fetch("/api/categories", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({
      name: input.name,
      emoji: input.emoji,
      section: input.section,
      carryForward: input.carryForward,
      repeatCadence: input.repeatCadence,
    }),
  });

  if (!response.ok) {
    await resolveError(response);
  }

  const payload = await readJson<CategoryResponse>(response);
  return mapCategoryPayload(payload.category);
};

export const updateCategory = async (
  categoryId: string,
  input: Partial<Pick<Category, "name" | "emoji" | "section">> & {
    carryForwardDefault?: boolean;
    repeatCadenceDefault?: RepeatCadence;
  }
): Promise<Category> => {
  const response = await fetch(`/api/categories/${categoryId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    await resolveError(response);
  }

  const payload = await readJson<CategoryResponse>(response);
  return mapCategoryPayload(payload.category);
};

export const deleteCategory = async (
  categoryId: string,
  options?: { transactionsTargetId?: string | null; budgetTargetId?: string | null }
): Promise<void> => {
  const response = await fetch(`/api/categories/${categoryId}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({
      transactionsTargetId: options?.transactionsTargetId ?? undefined,
      budgetTargetId: options?.budgetTargetId ?? undefined,
    }),
  });

  if (!response.ok) {
    await resolveError(response);
  }
};
