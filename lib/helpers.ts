export const joinClassNames = (
  ...classNames: Array<string | false | null | undefined>
): string => classNames.filter(Boolean).join(" ");
