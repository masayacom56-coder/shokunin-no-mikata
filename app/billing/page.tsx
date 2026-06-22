"use client";

import { Check, CreditCard } from "lucide-react";
import { useEffect, useState } from "react";
import { BackButton } from "@/components/back-button";
import { loadState } from "@/lib/app-store";
import type { AppState } from "@/lib/types";

const plans = [
  {
    code: "personal",
    name: "個人プラン",
    price: "月額980円",
    items: ["見積無制限", "顧客無制限", "PDF無制限"]
  },
  {
    code: "business",
    name: "法人プラン",
    price: "月額2980円〜",
    items: ["複数ユーザー", "案件共有", "権限管理"]
  }
] as const;

function safeCheckoutBody(plan: "personal" | "business", companyId: string) {
  try {
    return JSON.stringify({
      plan,
      userId: "00000000-0000-0000-0000-000000000000",
      companyId
    });
  } catch (error) {
    console.error("[Billing] stringify_failed", error);
    return "{}";
  }
}

export default function BillingPage() {
  const [state, setState] = useState<AppState | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setState(loadState());
  }, []);

  async function checkout(plan: "personal" | "business") {
    if (!state) return;
    const response = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: safeCheckoutBody(plan, state.company.id)
    });
    const data = (await response.json()) as { url?: string; error?: string };
    if (data.url) {
      window.location.href = data.url;
      return;
    }
    setMessage(data.error ?? "Stripeの設定を確認してください");
  }

  return (
    <main className="min-h-dvh bg-paper pb-8">
      <BackButton />
      <section className="mx-auto max-w-md px-4 py-5">
        <header className="flex items-center gap-3">
          <h1 className="text-2xl font-black">プラン</h1>
        </header>

        <div className="mt-5 rounded bg-white p-4 shadow-sm">
          <p className="text-sm font-bold text-moss">現在のプラン</p>
          <p className="mt-1 text-2xl font-black">{state?.plan === "free" ? "無料プラン" : "有料プラン"}</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">無料プランは月3件まで見積を保存できます。</p>
        </div>

        <div className="mt-4 space-y-3">
          {plans.map((plan) => (
            <article key={plan.code} className="rounded bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-black">{plan.name}</p>
                  <p className="mt-1 text-2xl font-black text-moss">{plan.price}</p>
                </div>
                <CreditCard className="text-moss" size={26} />
              </div>
              <div className="mt-3 space-y-2">
                {plan.items.map((item) => (
                  <p key={item} className="flex items-center gap-2 text-sm font-bold text-slate-700">
                    <Check size={16} className="text-moss" />
                    {item}
                  </p>
                ))}
              </div>
              <button className="mt-4 h-14 w-full rounded bg-moss font-black text-white" onClick={() => checkout(plan.code)}>
                申し込む
              </button>
            </article>
          ))}
        </div>
        {message ? <p className="mt-4 rounded bg-amber-50 p-3 text-sm font-bold text-amber-900">{message}</p> : null}
      </section>
    </main>
  );
}
