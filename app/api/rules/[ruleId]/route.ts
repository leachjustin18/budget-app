import { NextResponse } from "next/server";
import { prisma } from "@budget/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * DELETE /api/rules/[ruleId]
 * Hard-deletes a rule by id.
 * Adjust to soft-delete if your schema uses `archivedAt`.
 */
export async function DELETE(
  _request: Request,
  ctx: RouteContext<"/api/rules/[ruleId]">
) {
  const { ruleId } = await ctx.params;

  if (!ruleId) {
    return NextResponse.json({ error: "Rule id missing" }, { status: 400 });
  }

  try {
    // Ensure it exists (lets us return a clean 404)
    const existing = await prisma.rule.findUnique({
      where: { id: ruleId },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Rule not found" }, { status: 404 });
    }

    // Hard delete; change to update({ data: { archivedAt: new Date() } }) if you soft-delete
    await prisma.rule.delete({ where: { id: ruleId } });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Failed to delete rule", err);
    return NextResponse.json(
      { error: "Failed to delete rule" },
      { status: 500 }
    );
  }
}
