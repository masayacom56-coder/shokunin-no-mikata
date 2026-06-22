"use client";

import { useEffect, useState } from "react";

function isTailwindApplied() {
  if (typeof document === "undefined") return true;
  const probe = document.createElement("div");
  probe.className = "bg-moss";
  probe.style.position = "absolute";
  probe.style.left = "-9999px";
  probe.style.top = "-9999px";
  probe.style.width = "1px";
  probe.style.height = "1px";
  document.body.appendChild(probe);
  const background = window.getComputedStyle(probe).backgroundColor;
  probe.remove();
  return background === "rgb(47, 107, 87)";
}

export function StyleLoadWatchdog() {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const reportFailure = (reason: string, detail?: unknown) => {
      console.error("[StyleLoad] failed", reason, detail);
      setFailed(true);
    };

    const timer = window.setTimeout(() => {
      try {
        if (!isTailwindApplied()) {
          reportFailure("tailwind_probe_failed");
        }
      } catch (error) {
        reportFailure("tailwind_probe_exception", error);
      }
    }, 1200);

    const handleResourceError = (event: Event) => {
      const target = event.target;
      if (!(target instanceof HTMLLinkElement)) return;
      if (target.rel === "stylesheet" && target.href.includes("/_next/static/")) {
        reportFailure("next_static_css_failed", target.href);
      }
    };

    window.addEventListener("error", handleResourceError, true);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("error", handleResourceError, true);
    };
  }, []);

  if (!failed) return null;

  return (
    <div className="fixed inset-x-3 top-3 z-[2147483647] rounded border border-red-300 bg-red-50 px-4 py-3 text-center text-base font-black text-red-700 shadow-lg">
      スタイル読込エラー
    </div>
  );
}
