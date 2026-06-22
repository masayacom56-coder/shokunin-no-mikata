"use client";

import { BackButton } from "@/components/back-button";
import { loadState, updateWorkItemPrice } from "@/lib/app-store";
import { safeArray, safeNumber } from "@/lib/safety";
import type { AppState } from "@/lib/types";
import { useEffect, useMemo, useState } from "react";

export default function PriceMasterPage() {
  const [state, setState] = useState<AppState | null>(null);

  useEffect(() => {
    setState(loadState());
  }, []);

  const groupedWorkItems = useMemo(() => {
    if (!state) return [];
    const safeTrades = safeArray(state.trades);
    const safeWorkItems = safeArray(state.workItems);
    return safeTrades.map((trade) => ({
      trade,
      items: safeWorkItems.filter((item) => item.tradeId === trade.id)
    }));
  }, [state]);

  function changePrice(workItemId: string, value: string) {
    const nextPrice = Number(value || 0);
    setState(updateWorkItemPrice(workItemId, nextPrice));
  }

  return (
    <main className="min-h-dvh bg-paper pb-10 text-[20px]">
      <BackButton />
      <section className="mx-auto max-w-md px-4 py-5">
        <h1 className="text-[28px] font-black">単価マスタ</h1>

        <div className="mt-5 space-y-5">
          {safeArray(groupedWorkItems).map(({ trade, items }) => (
            <section key={trade.id} className="rounded bg-white p-4 shadow-sm">
              <h2 className="text-[24px] font-black">{trade.name}</h2>
              <div className="mt-4 space-y-3">
                {safeArray(items).map((item) => (
                  <label key={item.id} className="block rounded border border-slate-200 p-3">
                    <span className="block text-[20px] font-black">{item.name}</span>
                    <input
                      className="mt-2 h-[64px] w-full rounded border border-slate-300 px-4 text-right text-[24px] font-black"
                      inputMode="numeric"
                      value={safeNumber(item.standardPrice)}
                      onChange={(event) => changePrice(item.id, event.target.value)}
                    />
                  </label>
                ))}
              </div>
            </section>
          ))}
        </div>
      </section>
    </main>
  );
}
