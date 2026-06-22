"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export function BackButton() {
  const router = useRouter();

  function goBack() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    router.push("/customers");
  }

  return (
    <button
      aria-label="戻る"
      className="fixed left-4 top-4 z-50 grid size-12 place-items-center rounded border border-slate-300 bg-white shadow-sm"
      onClick={goBack}
      type="button"
    >
      <ArrowLeft size={22} />
    </button>
  );
}
