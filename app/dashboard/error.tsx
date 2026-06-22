"use client";

import { useEffect } from "react";
import { ErrorBoundaryView } from "@/components/error-boundary-view";

export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[RuntimeError] dashboard", error);
  }, [error]);

  return <ErrorBoundaryView reset={reset} />;
}
