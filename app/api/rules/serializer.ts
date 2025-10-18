import { Prisma } from "@prisma/client";

export const serializeRule = (
  rule: Prisma.RuleGetPayload<{ include: { category: true } }>
) => ({
  id: rule.id,
  name: rule.name,
  isActive: rule.isActive,
  matchField: rule.matchField,
  matchType: rule.matchType,
  matchValue: rule.matchValue,
  categoryId: rule.categoryId,
  lastRunAt: rule.lastRunAt ? rule.lastRunAt.toISOString() : null,
  createdAt: rule.createdAt.toISOString(),
  updatedAt: rule.updatedAt.toISOString(),
  category: rule.category
    ? {
        id: rule.category.id,
        name: rule.category.name,
        emoji: rule.category.emoji ?? "✨",
        section: rule.category.section,
      }
    : null,
});
