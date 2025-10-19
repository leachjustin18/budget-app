import { NextResponse } from "next/server";
import { z } from "zod";
import {
  CategorySection,
  Prisma,
  RepeatCadence,
  TransactionType,
} from "@prisma/client";
import { auth } from "@budget/lib/auth";
import { prisma } from "@budget/lib/prisma";

export const dynamic = "force-dynamic";

const SECTION_KEYS = ["expenses", "recurring", "savings", "debt"] as const;
type SectionKey = (typeof SECTION_KEYS)[number];

const REPEAT_VALUES = ["monthly", "once"] as const;
type RepeatValue = (typeof REPEAT_VALUES)[number];

const sectionToDb: Record<SectionKey, CategorySection> = {
  expenses: CategorySection.EXPENSES,
  recurring: CategorySection.RECURRING,
  savings: CategorySection.SAVINGS,
  debt: CategorySection.DEBT,
};

const sectionFromDb: Record<CategorySection, SectionKey> = {
  [CategorySection.EXPENSES]: "expenses",
  [CategorySection.RECURRING]: "recurring",
  [CategorySection.SAVINGS]: "savings",
  [CategorySection.DEBT]: "debt",
};

const repeatToDb: Record<RepeatValue, RepeatCadence> = {
  monthly: RepeatCadence.MONTHLY,
  once: RepeatCadence.ONCE,
};

const repeatFromDb: Record<RepeatCadence, RepeatValue> = {
  [RepeatCadence.MONTHLY]: "monthly",
  [RepeatCadence.ONCE]: "once",
};

const BudgetCategorySchema = z.object({
  uuid: z.string().min(1),
  name: z.string().trim(),
  emoji: z.string().trim().min(1).max(8).optional().default("✨"),
  planned: z.number().finite().nullable(),
  spent: z.number().finite().nullable(),
  carryForward: z.boolean().default(false),
  repeat: z.enum(REPEAT_VALUES),
});

const BudgetSectionsSchema = z.object({
  expenses: z.array(BudgetCategorySchema),
  recurring: z.array(BudgetCategorySchema),
  savings: z.array(BudgetCategorySchema),
  debt: z.array(BudgetCategorySchema),
});

const IncomeLineSchema = z.object({
  uuid: z.string().min(1),
  source: z.string().trim(),
  amount: z.number().finite().nullable(),
});

const BudgetPayloadSchema = z.object({
  income: z.array(IncomeLineSchema),
  sections: BudgetSectionsSchema,
});

type BudgetPayload = z.infer<typeof BudgetPayloadSchema>;

type Mutable<T> = {
  -readonly [K in keyof T]: T[K];
};

const emptyBudget = (): BudgetPayload => ({
  income: [],
  sections: {
    expenses: [],
    recurring: [],
    savings: [],
    debt: [],
  },
});

const sanitizeBudget = (input: BudgetPayload): BudgetPayload => {
  const sanitizedIncome = input.income
    .map((line) => ({
      uuid: line.uuid,
      source: line.source.trim(),
      amount: line.amount ?? null,
    }))
    .filter((line) => line.source.length > 0 || line.amount !== null);

  const sanitizedSections = SECTION_KEYS.reduce<
    Mutable<BudgetPayload["sections"]>
  >(
    (acc, key) => {
      const list = input.sections[key];
      acc[key] = list
        .map((item) => ({
          uuid: item.uuid,
          name: item.name.trim(),
          emoji: item.emoji?.trim() || "✨",
          planned: item.planned ?? null,
          spent: item.spent ?? null,
          carryForward: item.carryForward,
          repeat: item.repeat,
        }))
        .filter(
          (item) =>
            item.name.length > 0 || item.planned !== null || item.spent !== null
        );
      return acc;
    },
    {
      expenses: [],
      recurring: [],
      savings: [],
      debt: [],
    }
  );

  return {
    income: sanitizedIncome,
    sections: sanitizedSections,
  };
};

const monthKeyToDate = (monthKey: string): Date | null => {
  const match = /^(\d{4})-(\d{2})$/.exec(monthKey);
  if (!match) return null;
  const year = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  if (Number.isNaN(year) || Number.isNaN(month) || month < 1 || month > 12) {
    return null;
  }
  return new Date(year, month - 1, 1);
};

const ensureUser = async () => {
  const session = await auth();
  if (!session?.user?.email) {
    return { type: "error" as const, status: 401, message: "Unauthorized" };
  }

  const email = session.user.email.toLowerCase();

  // const user = await prisma.user.upsert({
  //   where: { email },
  //   update: {
  //     name: session.user.name ?? undefined,
  //     image: session.user.image ?? undefined,
  //   },
  //   create: {
  //     email,
  //     name: session.user.name ?? undefined,
  //     image: session.user.image ?? undefined,
  //   },
  // });

  return { type: "success" as const, email, session };
};

const mapBudgetToPayload = (
  budget: Awaited<ReturnType<typeof fetchBudgetWithRelations>>
): BudgetPayload => {
  if (!budget) {
    return emptyBudget();
  }

  const sections: Mutable<BudgetPayload["sections"]> = {
    expenses: [],
    recurring: [],
    savings: [],
    debt: [],
  };

  budget.allocations
    .sort((a, b) => a.category.sortOrder - b.category.sortOrder)
    .forEach((allocation) => {
      const sectionKey = sectionFromDb[allocation.section];
      sections[sectionKey].push({
        uuid: allocation.categoryId,
        name: allocation.category.name,
        emoji: allocation.category.emoji ?? "✨",
        planned: Number(allocation.plannedAmount),
        spent: Number(allocation.spentAmount),
        carryForward: allocation.carryForward,
        repeat: repeatFromDb[allocation.repeatCadence],
      });
    });

  const income = budget.incomes
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .map((line) => ({
      uuid: line.id,
      source: line.source,
      amount: Number(line.amount),
    }));

  return {
    income,
    sections,
  };
};

const fetchBudgetWithRelations = async (month: Date) =>
  prisma.budget.findUnique({
    where: {
      month,
    },
    include: {
      incomes: true,
      allocations: {
        include: {
          category: true,
        },
        orderBy: {
          createdAt: "asc",
        },
      },
    },
  });

export async function GET(
  _request: Request,
  { params }: { params: { month: string } }
) {
  const awaitedParams = await params;
  const month = awaitedParams.month;
  const monthDate = monthKeyToDate(month);
  if (!monthDate) {
    return NextResponse.json(
      { error: "Invalid month format" },
      { status: 400 }
    );
  }

  const ensured = await ensureUser();
  if (ensured.type === "error") {
    return NextResponse.json(
      { error: ensured.message },
      { status: ensured.status }
    );
  }

  const budget = await fetchBudgetWithRelations(monthDate);

  return NextResponse.json({
    month,
    budget: mapBudgetToPayload(budget),
    exists: Boolean(budget),
  });
}

export async function PUT(
  request: Request,
  { params }: { params: { month: string } }
) {
  const awaitedParams = await params;
  const awaitedMonth = await awaitedParams.month;

  const monthDate = monthKeyToDate(awaitedMonth);
  if (!monthDate) {
    return NextResponse.json(
      { error: "Invalid month format" },
      { status: 400 }
    );
  }

  const ensured = await ensureUser();
  if (ensured.type === "error") {
    return NextResponse.json(
      { error: ensured.message },
      { status: ensured.status }
    );
  }

  const json = await request.json().catch(() => null);
  if (!json || typeof json !== "object" || !("budget" in json)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const parsed = BudgetPayloadSchema.safeParse(json.budget);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 422 }
    );
  }

  const budgetData = sanitizeBudget(parsed.data);

  const { responsePayload } = await prisma.$transaction(async (tx) => {
    const budget = await tx.budget.upsert({
      where: {
        month: monthDate,
      },
      update: {},
      create: {
        month: monthDate,
        status: "DRAFT",
      },
    });

    const incomeInputs = budgetData.income;
    const existingIncome = await tx.budgetIncome.findMany({
      where: { budgetId: budget.id },
    });

    const incomeMap = new Map(
      existingIncome.map((income) => [income.id, income])
    );
    const incomingIncomeIds = new Set<string>();
    const incomeIdMapping = new Map<string, string>();

    for (const line of incomeInputs) {
      const amount = line.amount ?? 0;
      if (incomeMap.has(line.uuid)) {
        incomingIncomeIds.add(line.uuid);
        await tx.budgetIncome.update({
          where: { id: line.uuid },
          data: {
            source: line.source,
            amount: new Prisma.Decimal(amount),
          },
        });
        incomeIdMapping.set(line.uuid, line.uuid);
      } else {
        const originalId = line.uuid;
        const created = await tx.budgetIncome.create({
          data: {
            budgetId: budget.id,
            source: line.source,
            amount: new Prisma.Decimal(amount),
          },
        });
        incomingIncomeIds.add(created.id);
        incomeIdMapping.set(originalId, created.id);
      }
    }

    for (const income of existingIncome) {
      if (!incomingIncomeIds.has(income.id)) {
        await tx.budgetIncome.delete({ where: { id: income.id } });
      }
    }

    const sectionEntries = SECTION_KEYS.flatMap((sectionKey) =>
      budgetData.sections[sectionKey].map((category, index) => ({
        sectionKey,
        index,
        category,
      }))
    );

    const existingCategoryIds = sectionEntries
      .map((entry) => entry.category.uuid)
      .filter((id) => id);

    const existingCategories = existingCategoryIds.length
      ? await tx.category.findMany({
          where: {
            id: { in: existingCategoryIds },
          },
        })
      : [];

    const categoryMap = new Map(
      existingCategories.map((item) => [item.id, item])
    );
    const categoryIdMapping = new Map<string, string>();

    for (const entry of sectionEntries) {
      const incoming = entry.category;
      const targetSection = sectionToDb[entry.sectionKey];
      const repeat = repeatToDb[incoming.repeat];

      if (categoryMap.has(incoming.uuid)) {
        await tx.category.update({
          where: { id: incoming.uuid },
          data: {
            name: incoming.name,
            emoji: incoming.emoji,
            section: targetSection,
            carryForwardDefault: incoming.carryForward,
            repeatCadenceDefault: repeat,
            sortOrder: entry.index,
          },
        });
        categoryIdMapping.set(incoming.uuid, incoming.uuid);
      } else {
        const originalUuid = incoming.uuid;
        const created = await tx.category.create({
          data: {
            name: incoming.name,
            emoji: incoming.emoji,
            section: targetSection,
            carryForwardDefault: incoming.carryForward,
            repeatCadenceDefault: repeat,
            sortOrder: entry.index,
          },
        });
        categoryIdMapping.set(originalUuid, created.id);
      }
    }

    const allocations = await tx.budgetAllocation.findMany({
      where: { budgetId: budget.id },
    });
    const allocationMap = new Map(
      allocations.map((allocation) => [`${allocation.categoryId}`, allocation])
    );

    const incomingAllocationKeys = new Set<string>();

    for (const entry of sectionEntries) {
      const resolvedCategoryId =
        categoryIdMapping.get(entry.category.uuid) ?? entry.category.uuid;
      incomingAllocationKeys.add(resolvedCategoryId);
      const planned = entry.category.planned ?? 0;
      const spent = entry.category.spent ?? 0;

      if (allocationMap.has(resolvedCategoryId)) {
        await tx.budgetAllocation.update({
          where: { id: allocationMap.get(resolvedCategoryId)!.id },
          data: {
            section: sectionToDb[entry.sectionKey],
            plannedAmount: new Prisma.Decimal(planned),
            spentAmount: new Prisma.Decimal(spent),
            carryForward: entry.category.carryForward,
            repeatCadence: repeatToDb[entry.category.repeat],
          },
        });
      } else {
        await tx.budgetAllocation.create({
          data: {
            budgetId: budget.id,
            categoryId: resolvedCategoryId,
            section: sectionToDb[entry.sectionKey],
            plannedAmount: new Prisma.Decimal(planned),
            spentAmount: new Prisma.Decimal(spent),
            carryForward: entry.category.carryForward,
            repeatCadence: repeatToDb[entry.category.repeat],
          },
        });
      }
    }

    for (const allocation of allocations) {
      if (!incomingAllocationKeys.has(allocation.categoryId)) {
        await tx.budgetAllocation.delete({ where: { id: allocation.id } });
      }
    }

    // Link transactions with budget categories if they exist but no budget relation yet.
    await tx.transaction.updateMany({
      where: {
        budgetId: null,
        type: { in: [TransactionType.EXPENSE, TransactionType.INCOME] },
        occurredOn: {
          gte: new Date(monthDate.getFullYear(), monthDate.getMonth(), 1),
          lt: new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1),
        },
        OR: [
          { categoryId: { in: Array.from(incomingAllocationKeys) } },
          {
            splits: {
              some: { categoryId: { in: Array.from(incomingAllocationKeys) } },
            },
          },
        ],
      },
      data: {
        budgetId: budget.id,
      },
    });

    const resolvedIncome = incomeInputs.map((line) => ({
      uuid: incomeIdMapping.get(line.uuid) ?? line.uuid,
      source: line.source,
      amount: line.amount ?? null,
    }));

    const resolvedSections = SECTION_KEYS.reduce<
      Mutable<BudgetPayload["sections"]>
    >(
      (acc, key) => {
        acc[key] = budgetData.sections[key].map((category) => ({
          ...category,
          uuid: categoryIdMapping.get(category.uuid) ?? category.uuid,
        }));
        return acc;
      },
      {
        expenses: [],
        recurring: [],
        savings: [],
        debt: [],
      }
    );

    return {
      responsePayload: {
        income: resolvedIncome,
        sections: resolvedSections,
      },
    };
  });

  return NextResponse.json({
    month: awaitedMonth,
    budget: sanitizeBudget(responsePayload),
    exists: true,
  });
}
