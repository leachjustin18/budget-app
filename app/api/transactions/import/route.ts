import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { parse } from "csv-parse/sync";
import {
  Prisma,
  TransactionOrigin,
  TransactionType,
} from "@prisma/client";
import { prisma } from "@budget/lib/prisma";
import {
  computeTransactionFingerprint,
  ensureDefaultCategory,
  linkTransactionToBudget,
  resolveRuleCategory,
  syncBudgetSpentForMonth,
  sanitizeMerchantName,
} from "@budget/lib/transactions";

export const runtime = "nodejs";

type CsvRecord = Record<string, string>;

const normalizeKey = (key: string) =>
  key
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .trim();

const parseDate = (value?: string | null): Date | null => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const isoMatch = /^\d{4}-\d{2}-\d{2}$/;
  if (isoMatch.test(trimmed)) {
    const [year, month, day] = trimmed.split("-").map((part) => Number(part));
    return new Date(year, month - 1, day);
  }

  const slashMatch = /^\d{1,2}\/\d{1,2}\/\d{2,4}$/;
  if (slashMatch.test(trimmed)) {
    const [month, day, year] = trimmed.split("/").map((part) => Number(part));
    const normalizedYear = year < 100 ? 2000 + year : year;
    return new Date(normalizedYear, month - 1, day);
  }

  const dashMatch = /^\d{1,2}-\d{1,2}-\d{2,4}$/;
  if (dashMatch.test(trimmed)) {
    const [month, day, year] = trimmed.split("-").map((part) => Number(part));
    const normalizedYear = year < 100 ? 2000 + year : year;
    return new Date(normalizedYear, month - 1, day);
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
};

const parseAmount = (value?: string | null): number | null => {
  if (!value) return null;
  const normalized = value.replace(/[,$]/g, "").trim();
  if (!normalized) return null;
  const hasParens = normalized.startsWith("(") && normalized.endsWith(")");
  const digits = normalized.replace(/[()]/g, "");
  const parsed = Number.parseFloat(digits);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return hasParens ? -Math.abs(parsed) : parsed;
};

const extractFromRecord = (record: CsvRecord) => {
  const normalized = new Map<string, string>();
  Object.entries(record).forEach(([key, value]) => {
    normalized.set(normalizeKey(key), value);
  });

  const occurredOn =
    parseDate(normalized.get("transactiondate")) ??
    parseDate(normalized.get("date")) ??
    parseDate(normalized.get("posteddate")) ??
    parseDate(normalized.get("clearingdate"));

  if (!occurredOn) {
    return null;
  }

  const postedOn =
    parseDate(normalized.get("posteddate")) ??
    parseDate(normalized.get("clearingdate")) ??
    null;

  let amount: number | null = null;
  if (normalized.has("amount")) {
    amount = parseAmount(normalized.get("amount"));
  }

  const debit = parseAmount(normalized.get("debit"));
  const credit = parseAmount(normalized.get("credit"));

  if (amount === null) {
    if (debit !== null && debit !== 0) {
      amount = -Math.abs(debit);
    } else if (credit !== null && credit !== 0) {
      amount = Math.abs(credit);
    }
  }

  if (amount === null || amount === 0) {
    return null;
  }

  const description =
    record["Description"] ??
    record["description"] ??
    record["Memo"] ??
    record["memo"] ??
    normalized.get("description") ??
    normalized.get("memo") ??
    "";

  const merchant =
    record["Merchant"] ??
    record["merchant"] ??
    record["Name"] ??
    record["name"] ??
    normalized.get("merchant") ??
    normalized.get("payee") ??
    normalized.get("name") ??
    description;

  const rawMerchant = merchant ?? "";
  const sanitizedMerchant = sanitizeMerchantName(rawMerchant);

  const type = amount < 0 ? TransactionType.EXPENSE : TransactionType.INCOME;
  const absoluteAmount = Math.abs(amount);

  return {
    occurredOn,
    postedOn,
    amount: absoluteAmount,
    type,
    description: description ?? "",
    merchant: rawMerchant,
    sanitizedMerchant,
    raw: JSON.stringify(record),
  };
};

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");
  const sourceParam = formData.get("source");

  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "file is required" },
      { status: 400 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  let records: CsvRecord[];
  try {
    records = parse(buffer.toString("utf8"), {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Unable to parse CSV", details: String(error) },
      { status: 400 }
    );
  }

  if (!records.length) {
    return NextResponse.json(
      { error: "CSV file is empty" },
      { status: 400 }
    );
  }

  const importBatch = await prisma.importBatch.create({
    data: {
      source: typeof sourceParam === "string" ? sourceParam : "manual-upload",
      fileName: file.name,
    },
  });

  const rules = await prisma.rule.findMany({
    where: { isActive: true },
    orderBy: { createdAt: "asc" },
  });

  const defaultCategory = await ensureDefaultCategory(prisma);

  const createdTransactionIds: string[] = [];
  const affectedMonths = new Set<string>();
  let imported = 0;
  let duplicates = 0;
  let skipped = 0;
  const errors: Array<{ row: number; message: string }> = [];

  for (const [index, record] of records.entries()) {
    const parsed = extractFromRecord(record);
    if (!parsed) {
      skipped += 1;
      continue;
    }

    const fingerprint = computeTransactionFingerprint({
      occurredOn: parsed.occurredOn,
      postedOn: parsed.postedOn ?? undefined,
      amount: parsed.amount,
      merchant: parsed.merchant,
      description: parsed.description,
    });

    const existing = await prisma.transaction.findFirst({
      where: { fingerprint },
      select: { id: true },
    });

    if (existing) {
      duplicates += 1;
      continue;
    }

    const categoryFromRule = resolveRuleCategory(rules, {
      description: parsed.description,
      merchant: parsed.merchant,
      raw: parsed.raw,
    });

    const categoryId = categoryFromRule ?? defaultCategory.id;

    try {
      const createdId = await prisma.$transaction(async (tx) => {
        const created = await tx.transaction.create({
          data: {
            id: randomUUID(),
            importBatchId: importBatch.id,
            occurredOn: parsed.occurredOn,
            postedOn: parsed.postedOn,
            amount: new Prisma.Decimal(parsed.amount.toFixed(2)),
            type: parsed.type,
            origin: TransactionOrigin.IMPORT,
            description: parsed.description ? parsed.description.trim() : null,
            merchant: parsed.sanitizedMerchant
              ? parsed.sanitizedMerchant
              : null,
            memo: null,
            isPending: false,
            externalId: `import:${importBatch.id}:${index}`,
            fingerprint,
            categoryId,
          },
        });

        await tx.transactionSplit.create({
          data: {
            transactionId: created.id,
            categoryId,
            amount: new Prisma.Decimal(parsed.amount.toFixed(2)),
            memo: null,
          },
        });

        await linkTransactionToBudget(parsed.occurredOn, created.id, tx);

        return created.id;
      });

      imported += 1;
      createdTransactionIds.push(createdId);
      affectedMonths.add(
        `${parsed.occurredOn.getFullYear()}-${String(
          parsed.occurredOn.getMonth() + 1
        ).padStart(2, "0")}`
      );
    } catch (error) {
      errors.push({ row: index + 1, message: error instanceof Error ? error.message : String(error) });
    }
  }

  for (const monthKey of affectedMonths) {
    const [year, month] = monthKey.split("-").map((value) => Number(value));
    if (!Number.isInteger(year) || !Number.isInteger(month)) continue;
    const date = new Date(year, month - 1, 1);
    await syncBudgetSpentForMonth(date, prisma);
  }

  await prisma.importBatch.update({
    where: { id: importBatch.id },
    data: { completedAt: new Date() },
  });

  const transactions = createdTransactionIds.length
    ? await prisma.transaction.findMany({
        where: { id: { in: createdTransactionIds } },
        include: {
          category: true,
          splits: {
            include: { category: true },
          },
          importBatch: true,
        },
        orderBy: [
          { occurredOn: "desc" },
          { createdAt: "desc" },
        ],
      })
    : [];

  return NextResponse.json({
    importBatchId: importBatch.id,
    summary: {
      imported,
      duplicates,
      skipped,
      errors,
    },
    transactions: transactions.map((transaction) => ({
      id: transaction.id,
      occurredOn: transaction.occurredOn.toISOString().slice(0, 10),
      postedOn: transaction.postedOn
        ? transaction.postedOn.toISOString().slice(0, 10)
        : null,
      amount: Number(transaction.amount.toFixed(2)),
      type: transaction.type,
      origin: transaction.origin,
      description: transaction.description ?? "",
      merchant: transaction.merchant ?? "",
      memo: transaction.memo ?? "",
      categoryId: transaction.categoryId,
      importBatchId: transaction.importBatchId,
      splits: transaction.splits.map((split) => ({
        id: split.id,
        amount: Number(split.amount.toFixed(2)),
        memo: split.memo ?? "",
        category: split.category
          ? {
              id: split.category.id,
              name: split.category.name,
              emoji: split.category.emoji ?? "✨",
              section: split.category.section,
            }
          : null,
      })),
    })),
  });
}
