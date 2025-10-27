"use client";

import { useMemo } from "react";
import { useAuthPrefetch } from "@budget/app/hooks/useAuthPrefetch";

type CachePrefetchGateProps = {
  months?: Array<string | Date>;
};

export default function CachePrefetchGate({ months }: CachePrefetchGateProps) {
  const normalizedMonths = useMemo(
    () => (months?.length ? months : undefined),
    [months]
  );

  useAuthPrefetch({ months: normalizedMonths });

  return null;
}
