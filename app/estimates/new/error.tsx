"use client";

import { useEffect } from "react";
import { ErrorBoundaryView } from "@/components/error-boundary-view";

export default function EstimateError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[RuntimeError] estimates/new", error);
  }, [error]);

  return <ErrorBoundaryView reset={reset} />;
}
