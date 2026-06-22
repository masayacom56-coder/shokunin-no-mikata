"use client";

import { useEffect } from "react";
import { ErrorBoundaryView } from "@/components/error-boundary-view";

export default function CustomerEstimateHistoryError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[RuntimeError] customers/id/estimates", error);
  }, [error]);

  return <ErrorBoundaryView reset={reset} />;
}
