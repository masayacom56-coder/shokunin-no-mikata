"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileText, Save, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { deleteCustomer, loadState, updateCustomer } from "@/lib/app-store";
import { normalizeCustomer, safeArray } from "@/lib/safety";
import type { Customer } from "@/lib/types";

export function CustomerDetailClient({ customerId }: { customerId: string }) {
  const router = useRouter();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [draft, setDraft] = useState<Customer | null>(null);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!customerId) {
      setCustomer(null);
      setDraft(null);
      return;
    }
    const found = safeArray(loadState().customers).find((item) => item?.id === customerId) ?? null;
    const safeCustomer = found ? normalizeCustomer(found) : null;
    setCustomer(safeCustomer);
    setDraft(safeCustomer);
  }, [customerId]);

  function setField(key: keyof Customer, value: string) {
    setDraft((current) => (current ? { ...current, [key]: value } : current));
  }

  function saveEdit() {
    if (!draft) return;
    const saved = updateCustomer(normalizeCustomer(draft));
    setCustomer(saved);
    setDraft(saved);
    setEditing(false);
  }

  function removeCustomer() {
    if (!customer) return;
    deleteCustomer(customer.id);
    router.push("/customers");
  }

  return (
    <main className="min-h-dvh bg-paper pb-8">
      <section className="mx-auto max-w-md px-4 py-5">
        <header className="flex items-center gap-3">
          <h1 className="text-2xl font-black">顧客詳細</h1>
        </header>

        {!customer ? (
          <div className="mt-5 rounded bg-white p-5 text-center text-sm text-slate-500 shadow-sm">
            顧客が見つかりません
            <Link href="/customers" className="mt-4 flex h-12 items-center justify-center rounded border border-slate-300 bg-white font-bold text-sumi">
              顧客管理へ戻る
            </Link>
          </div>
        ) : (
          <article className="mt-5 rounded bg-white p-4 shadow-sm">
            {editing && draft ? (
              <div className="space-y-3">
                <label className="block">
                  <span className="text-xs font-bold text-slate-500">顧客種別</span>
                  <select className="mt-1 h-12 w-full rounded border border-slate-300 px-3" value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value as Customer["type"] })}>
                    <option value="individual">個人</option>
                    <option value="corporate">法人</option>
                  </select>
                </label>
                <EditField label="顧客名" value={draft.name} onChange={(value) => setField("name", value)} />
                <EditField label="法人名" value={draft.companyName ?? ""} onChange={(value) => setField("companyName", value)} />
                <EditField label="電話番号" value={draft.phone ?? ""} onChange={(value) => setField("phone", value)} />
                <EditField label="メールアドレス" value={draft.email ?? ""} onChange={(value) => setField("email", value)} />
                <EditField label="郵便番号" value={draft.postalCode ?? ""} onChange={(value) => setField("postalCode", value)} />
                <EditField label="住所" value={draft.address ?? ""} onChange={(value) => setField("address", value)} />
                <label className="block">
                  <span className="text-xs font-bold text-slate-500">メモ</span>
                  <textarea className="mt-1 min-h-24 w-full rounded border border-slate-300 p-3" value={draft.memo ?? ""} onChange={(event) => setField("memo", event.target.value)} />
                </label>
                <button type="button" onClick={saveEdit} className="flex h-14 w-full items-center justify-center gap-2 rounded bg-moss font-black text-white">
                  <Save size={20} />
                  保存
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-2xl font-black">{customer.companyName || customer.name}</p>
                <DetailRow label="顧客名" value={customer.name} />
                <DetailRow label="顧客種別" value={customer.type === "corporate" ? "法人" : "個人"} />
                <DetailRow label="電話番号" value={customer.phone} />
                <DetailRow label="メールアドレス" value={customer.email} />
                <DetailRow label="郵便番号" value={customer.postalCode} />
                <DetailRow label="住所" value={customer.address} />
                <DetailRow label="メモ" value={customer.memo} />
              </div>
            )}

            <Link href={`/estimates/new?customerId=${customer.id}`} className="mt-5 flex h-16 items-center justify-center gap-2 rounded bg-moss text-xl font-black text-white">
              <FileText size={24} />
              見積作成
            </Link>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <button type="button" onClick={() => setEditing(true)} className="flex h-12 items-center justify-center rounded border border-slate-300 font-bold text-sumi">
                編集
              </button>
              <button type="button" onClick={removeCustomer} className="flex h-12 items-center justify-center gap-1 rounded border border-red-200 font-bold text-red-600">
                <Trash2 size={16} />
                削除
              </button>
              <Link href="/customers" className="flex h-12 items-center justify-center rounded border border-slate-300 font-bold text-sumi">
                戻る
              </Link>
            </div>
          </article>
        )}
      </section>
    </main>
  );
}

function DetailRow({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <p className="text-xs font-bold text-slate-500">{label}</p>
      <p className="whitespace-pre-wrap font-bold text-slate-700">{value?.trim() || "-"}</p>
    </div>
  );
}

function EditField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="text-xs font-bold text-slate-500">{label}</span>
      <input className="mt-1 h-12 w-full rounded border border-slate-300 px-3" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}
