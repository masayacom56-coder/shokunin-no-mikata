"use client";

import { useEffect } from "react";
import { recordAppError } from "@/lib/admin-metrics";

export function AdminTelemetryListener() {
  useEffect(() => {
    function onError(event: ErrorEvent) {
      recordAppError("予期しない例外", window.location.pathname, event.error ?? event.message);
    }

    function onUnhandledRejection(event: PromiseRejectionEvent) {
      recordAppError("予期しない例外", window.location.pathname, event.reason);
    }

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, []);

  return null;
}
