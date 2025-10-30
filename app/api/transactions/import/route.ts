import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { parse } from "csv-parse/sync";
import { Prisma, TransactionOrigin, TransactionType } from "@prisma/client";
import { prisma } from "@budget/lib/prisma";
import {
  computeTransactionFingerprint,
  ensureDefaultCategory,
  linkTransactionToBudget,
  resolveRuleCategory,
  syncBudgetSpentForMonth,
  sanitizeMerchantName,
} from "@budget/lib/transactions";
import {
  merchantAliasComponents,
  normalizeMerchantKey,
} from "@budget/lib/merchantNormalization";
import {
  fetchYelpAutocomplete,
  type YelpAutocompleteResult,
  type YelpBusinessSuggestion,
} from "@budget/lib/yelpClient";
import { resolveMerchant } from "@budget/lib/merchantService";

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

type MerchantCacheEntry = {
  canonicalName: string;
  merchantId: string | null;
  yelpId: string | null;
};

type TransactionWithSplits = Prisma.TransactionGetPayload<{
  include: { splits: true };
}>;

const tokenize = (value: string): Set<string> => {
  const sanitized = sanitizeMerchantName(value);
  return new Set(
    sanitized
      .toLowerCase()
      .split(/\s+/)
      .map((token) => token.replace(/[^a-z0-9]/g, ""))
      .filter((token) => token.length > 1)
  );
};

const tokenSimilarity = (a: Set<string>, b: Set<string>): number => {
  if (!a.size || !b.size) return 0;
  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) {
      intersection += 1;
    }
  }
  const union = new Set([...a, ...b]);
  return intersection / union.size;
};

const MANUAL_MATCH_SIMILARITY_THRESHOLD = 0.6;

const getUtcDayBounds = (date: Date) => {
  const isoDate = date.toISOString().slice(0, 10);
  const start = new Date(`${isoDate}T00:00:00.000Z`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
};

const pickYelpCandidate = (
  normalizedKey: string,
  info: { canonicalCandidate: string; rawNames: Set<string> },
  response: YelpAutocompleteResult | null
): {
  canonicalName: string;
  normalizedKey: string;
  rawName: string;
  yelpId?: string;
} | null => {
  if (!response?.businesses?.length) {
    return null;
  }

  const targetTokens = tokenize(info.canonicalCandidate || normalizedKey);
  const rawName =
    info.rawNames.values().next().value ??
    info.canonicalCandidate ??
    normalizedKey;

  let best: {
    suggestion: YelpBusinessSuggestion;
    canonicalName: string;
    normalizedCandidateKey: string;
    similarity: number;
    directMatch: boolean;
  } | null = null;

  for (const business of response.businesses) {
    if (!business?.name) continue;
    const canonicalName = sanitizeMerchantName(business.name);
    if (!canonicalName) continue;
    const normalizedCandidateKey = normalizeMerchantKey(business.name);
    const candidateTokens = tokenize(canonicalName);
    const similarity = tokenSimilarity(targetTokens, candidateTokens);
    const directMatch = normalizedCandidateKey === normalizedKey;

    if (!best || directMatch || similarity > best.similarity) {
      best = {
        suggestion: business,
        canonicalName,
        normalizedCandidateKey,
        similarity,
        directMatch,
      };
    }
  }

  if (!best) return null;

  if (best.directMatch || best.similarity >= 0.5) {
    return {
      canonicalName: best.canonicalName,
      normalizedKey,
      rawName,
      yelpId: best.suggestion.id,
    };
  }

  return null;
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
  const aliasComponents = merchantAliasComponents(rawMerchant);
  const canonicalMerchant = aliasComponents.canonicalName || sanitizedMerchant;
  const normalizedMerchant = aliasComponents.normalizedKey;

  const type = amount < 0 ? TransactionType.EXPENSE : TransactionType.INCOME;
  const absoluteAmount = Math.abs(amount);

  return {
    occurredOn,

    amount: absoluteAmount,
    type,
    description: description ?? "",
    merchant: rawMerchant,
    sanitizedMerchant,
    canonicalMerchant,
    normalizedMerchant,
    raw: JSON.stringify(record),
  };
};

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");
  const sourceParam = formData.get("source");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
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
    return NextResponse.json({ error: "CSV file is empty" }, { status: 400 });
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
  const createdTransactionMeta = new Map<
    string,
    {
      rawMerchant: string;
      normalizedMerchant: string;
      canonicalMerchant: string;
      merchantId?: string | null;
      needsReview: boolean;
    }
  >();
  const affectedMonths = new Set<string>();
  let imported = 0;
  let duplicates = 0;
  let skipped = 0;
  const errors: Array<{ row: number; message: string }> = [];

  type ParsedItem = ReturnType<typeof extractFromRecord> & { index: number };

  const parsedItems: ParsedItem[] = [];
  const normalizedMerchants = new Map<
    string,
    { rawNames: Set<string>; canonicalCandidate: string }
  >();

  for (const [index, record] of records.entries()) {
    const parsed = extractFromRecord(record);
    if (!parsed) {
      skipped += 1;
      continue;
    }

    parsedItems.push({ ...parsed, index });

    if (parsed.normalizedMerchant) {
      const existing = normalizedMerchants.get(parsed.normalizedMerchant);
      if (existing) {
        existing.rawNames.add(parsed.merchant);
      } else {
        normalizedMerchants.set(parsed.normalizedMerchant, {
          rawNames: new Set([parsed.merchant]),
          canonicalCandidate:
            parsed.canonicalMerchant || parsed.sanitizedMerchant,
        });
      }
    }
  }

  const merchantCache = new Map<string, MerchantCacheEntry>();
  const normalizedKeys = Array.from(normalizedMerchants.keys()).filter(Boolean);

  if (normalizedKeys.length) {
    const aliases = await prisma.merchantAlias.findMany({
      where: { normalized: { in: normalizedKeys } },
      include: { merchant: true },
    });

    for (const alias of aliases) {
      merchantCache.set(alias.normalized, {
        canonicalName: alias.merchant.canonicalName,
        merchantId: alias.merchantId,
        yelpId: alias.yelpId ?? alias.merchant.yelpId ?? null,
      });
      normalizedMerchants.delete(alias.normalized);
    }
  }

  const unresolvedMerchants: Array<{
    normalizedKey: string;
    suggestedName: string;
    rawNames: string[];
  }> = [];

  for (const [normalizedKey, entry] of normalizedMerchants.entries()) {
    if (!normalizedKey) {
      unresolvedMerchants.push({
        normalizedKey,
        suggestedName: entry.canonicalCandidate,
        rawNames: Array.from(entry.rawNames),
      });
      continue;
    }

    const yelpResult = await fetchYelpAutocomplete(
      entry.canonicalCandidate || normalizedKey
    );

    const candidate = pickYelpCandidate(normalizedKey, entry, yelpResult);

    if (candidate) {
      const merchantResult = await resolveMerchant(candidate.rawName, {
        canonicalName: candidate.canonicalName,
        yelpId: candidate.yelpId ?? null,
      });

      if (merchantResult) {
        const entryValue: MerchantCacheEntry = {
          canonicalName: merchantResult.canonicalName,
          merchantId: merchantResult.merchantId,
          yelpId: candidate.yelpId ?? null,
        };
        merchantCache.set(merchantResult.normalizedKey, entryValue);
        if (merchantResult.normalizedKey !== normalizedKey) {
          merchantCache.set(normalizedKey, entryValue);
        }
        continue;
      }
    }

    unresolvedMerchants.push({
      normalizedKey,
      suggestedName: entry.canonicalCandidate,
      rawNames: Array.from(entry.rawNames),
    });
  }

  for (const parsed of parsedItems) {
    const fingerprintMerchant = sanitizeMerchantName(parsed.merchant);

    const fingerprint = computeTransactionFingerprint({
      occurredOn: parsed.occurredOn,

      amount: parsed.amount,
      merchant: fingerprintMerchant || parsed.merchant,
      description: parsed.description,
    });

    const existing = await prisma.transaction.findFirst({
      where: { fingerprint },
      select: { id: true, origin: true },
    });

    let manualFingerprintId: string | null = null;
    if (existing) {
      if (existing.origin !== TransactionOrigin.MANUAL) {
        duplicates += 1;
        continue;
      }
      manualFingerprintId = existing.id;
    }

    const categoryFromRule = resolveRuleCategory(rules, {
      description: parsed.description,
      merchant: parsed.merchant,
      raw: parsed.raw,
    });

    const defaultCategoryId = categoryFromRule ?? defaultCategory.id;

    const normalizedKey = parsed.normalizedMerchant;
    const resolvedMerchant = normalizedKey
      ? merchantCache.get(normalizedKey)
      : undefined;

    const canonicalMerchant =
      resolvedMerchant?.canonicalName ||
      parsed.canonicalMerchant ||
      parsed.sanitizedMerchant;

    try {
      const createdId = await prisma.$transaction(async (tx) => {
        const merchantResolution =
          resolvedMerchant && resolvedMerchant.merchantId
            ? resolvedMerchant
            : null;

        const amountDecimal = new Prisma.Decimal(parsed.amount.toFixed(2));

        const importNormalizedKey =
          normalizedKey ||
          normalizeMerchantKey(
            parsed.canonicalMerchant ||
              parsed.sanitizedMerchant ||
              parsed.merchant
          );
        const importTokens = tokenize(
          parsed.canonicalMerchant ||
            parsed.sanitizedMerchant ||
            parsed.merchant
        );

        let manualMatch: TransactionWithSplits | null = null;

        if (manualFingerprintId) {
          manualMatch = await tx.transaction.findUnique({
            where: { id: manualFingerprintId },
            include: {
              splits: {
                orderBy: { createdAt: "asc" },
              },
            },
          });
        }

        if (!manualMatch) {
          const { start: dayStart, end: dayEnd } = getUtcDayBounds(
            parsed.occurredOn
          );

          const manualCandidates = (await tx.transaction.findMany({
            where: {
              origin: TransactionOrigin.MANUAL,
              type: parsed.type,
              amount: amountDecimal,
              occurredOn: {
                gte: dayStart,
                lt: dayEnd,
              },
            },
            include: {
              splits: {
                orderBy: { createdAt: "asc" },
              },
            },
          })) as TransactionWithSplits[];

          let bestMatch: TransactionWithSplits | null = null;
          let bestScore = 0;

          for (const candidate of manualCandidates) {
            const candidateSource =
              candidate.merchant && candidate.merchant.trim().length > 0
                ? candidate.merchant
                : candidate.description ?? "";

            const candidateNormalized = normalizeMerchantKey(candidateSource);

            let similarityScore = 0;
            if (importNormalizedKey && candidateNormalized) {
              if (importNormalizedKey === candidateNormalized) {
                similarityScore = 1;
              } else if (
                importNormalizedKey.includes(candidateNormalized) ||
                candidateNormalized.includes(importNormalizedKey)
              ) {
                similarityScore = 0.9;
              }
            }

            if (similarityScore < 1) {
              const candidateTokens = tokenize(candidateSource);
              similarityScore = Math.max(
                similarityScore,
                tokenSimilarity(importTokens, candidateTokens)
              );
            }

            if (
              similarityScore >= MANUAL_MATCH_SIMILARITY_THRESHOLD &&
              (bestMatch === null || similarityScore > bestScore)
            ) {
              bestMatch = candidate;
              bestScore = similarityScore;
            }
          }

          manualMatch = bestMatch;
        }

        let splitPayloads: Array<{
          categoryId: string | null;
          amount: Prisma.Decimal;
          memo: string | null;
        }>;

        if (manualMatch) {
          splitPayloads = manualMatch.splits.map((split) => ({
            categoryId: split.categoryId ?? null,
            amount: new Prisma.Decimal(split.amount.toFixed(2)),
            memo: split.memo ?? null,
          }));

          await tx.transaction.delete({ where: { id: manualMatch.id } });
        } else {
          splitPayloads = [
            {
              categoryId: defaultCategoryId,
              amount: amountDecimal,
              memo: null,
            },
          ];
        }

        const created = await tx.transaction.create({
          data: {
            id: randomUUID(),
            importBatchId: importBatch.id,
            occurredOn: parsed.occurredOn,

            amount: amountDecimal,
            type: parsed.type,
            origin: TransactionOrigin.IMPORT,
            description: parsed.description ? parsed.description.trim() : null,
            merchant: canonicalMerchant ? canonicalMerchant : null,
            merchantId: merchantResolution?.merchantId ?? null,
            memo: manualMatch?.memo ?? null,
            isPending: false,
            externalId: `import:${importBatch.id}:${parsed.index}`,
            fingerprint,
            categoryId:
              manualMatch?.categoryId ??
              (splitPayloads.length === 1
                ? splitPayloads[0].categoryId
                : null),
          },
        });

        for (const split of splitPayloads) {
          await tx.transactionSplit.create({
            data: {
              transactionId: created.id,
              categoryId: split.categoryId,
              amount: split.amount,
              memo: split.memo,
            },
          });
        }

        await linkTransactionToBudget(parsed.occurredOn, created.id, tx);

        return created.id;
      });

      imported += 1;
      createdTransactionIds.push(createdId);
      createdTransactionMeta.set(createdId, {
        rawMerchant: parsed.merchant,
        normalizedMerchant: normalizedKey ?? "",
        canonicalMerchant: canonicalMerchant ?? "",
        merchantId: resolvedMerchant?.merchantId ?? null,
        needsReview: Boolean(normalizedKey) && !resolvedMerchant,
      });
      affectedMonths.add(
        `${parsed.occurredOn.getFullYear()}-${String(
          parsed.occurredOn.getMonth() + 1
        ).padStart(2, "0")}`
      );
    } catch (error) {
      errors.push({
        row: parsed.index + 1,
        message: error instanceof Error ? error.message : String(error),
      });
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
          merchantRef: true,
        },
        orderBy: [{ occurredOn: "desc" }, { createdAt: "desc" }],
      })
    : [];

  return NextResponse.json({
    importBatchId: importBatch.id,
    summary: {
      imported,
      duplicates,
      skipped,
      errors,
      pendingMerchants: unresolvedMerchants.length,
    },
    merchantResolutions: unresolvedMerchants.map((entry) => ({
      normalizedKey: entry.normalizedKey,
      suggestedName: entry.suggestedName,
      rawNames: entry.rawNames,
    })),
    transactions: transactions.map((transaction) => {
      const meta = createdTransactionMeta.get(transaction.id);
      const canonical =
        transaction.merchantRef?.canonicalName ??
        meta?.canonicalMerchant ??
        transaction.merchant ??
        "";
      return {
        id: transaction.id,
        occurredOn: transaction.occurredOn.toISOString().slice(0, 10),

        amount: Number(transaction.amount.toFixed(2)),
        type: transaction.type,
        origin: transaction.origin,
        description: transaction.description ?? "",
        merchantName: canonical,
        merchantId: transaction.merchantRef?.id ?? meta?.merchantId ?? null,
        merchant: transaction.merchantRef
          ? {
              id: transaction.merchantRef.id,
              canonicalName: transaction.merchantRef.canonicalName,
              yelpId: transaction.merchantRef.yelpId,
            }
          : null,
        merchantRaw: meta?.rawMerchant ?? "",
        merchantNormalizedKey: meta?.normalizedMerchant ?? "",
        merchantNeedsReview: meta?.needsReview ?? false,
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
      };
    }),
  });
}
