"use client";

import { useEffect } from "react";
import { recordAppError } from "@/lib/admin-metrics";

type ErrorBoundaryViewProps = {
  reset?: () => void;
};

export function ErrorBoundaryView({ reset }: ErrorBoundaryViewProps) {
  useEffect(() => {
    recordAppError("画面クラッシュ", typeof window === "undefined" ? "unknown" : window.location.pathname);
  }, []);

  return (
    <main className="min-h-dvh bg-paper px-4 py-8 text-sumi">
      <section className="mx-auto max-w-md rounded bg-white p-5 shadow-sm">
        <h1 className="text-2xl font-black">エラーが発生しました</h1>
        <p className="mt-3 text-lg font-bold text-slate-600">入力内容を確認してください。</p>
        {reset ? (
          <button className="mt-5 flex h-14 w-full items-center justify-center rounded bg-moss text-lg font-black text-white" onClick={reset} type="button">
            もう一度試す
          </button>
        ) : null}
      </section>
    </main>
  );
}
