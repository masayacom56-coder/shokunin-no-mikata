"use client";

import { useEffect } from "react";
import { recordAppError } from "@/lib/admin-metrics";

export function AdminTelemetryListener() {
  useEffect(() => {
    async function clearStaleRuntimeCache() {
      try {
        if ("caches" in window) {
          const keys = await window.caches.keys();
          await Promise.all(keys.map((key) => window.caches.delete(key)));
        }
        if ("serviceWorker" in navigator) {
          const registrations = await navigator.serviceWorker.getRegistrations();
          await Promise.all(registrations.map((registration) => registration.unregister()));
        }
      } catch (error) {
        console.error("[RuntimeCache] cleanup_failed", error);
      }
    }

    void clearStaleRuntimeCache();

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
