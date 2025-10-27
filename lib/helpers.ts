export const joinClassNames = (
  ...classNames: Array<string | false | null | undefined>
): string => classNames.filter(Boolean).join(" ");

/**
 * Helpers
 */
export const round = (value: number, fractionDigits = 2) =>
  Number.isFinite(value) ? Number(value.toFixed(fractionDigits)) : 0;

export const toNumber = (value?: string | number | null | unknown): number => {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  return Number(value);
};

const now = new Date();
const year = now.getFullYear();
const month = now.getMonth() + 1;

export const monthKey = `${year}-${month}`;
