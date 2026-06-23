"use client";

import Link from "next/link";
import { Building2, Save, User } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { BackButton } from "@/components/back-button";
import { createCustomer, loadState } from "@/lib/app-store";
import { recordAppError } from "@/lib/admin-metrics";
import { encodeRouteCustomerId } from "@/lib/customer-route-guards";
import { normalizeCustomer, safeArray } from "@/lib/safety";
import type { Customer } from "@/lib/types";

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [message, setMessage] = useState("");
  const [type, setType] = useState<"individual" | "corporate">("individual");
  const [name, setName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [address, setAddress] = useState("");
  const [memo, setMemo] = useState("");

  useEffect(() => {
    setCustomers(safeArray(loadState().customers).map((customer) => normalizeCustomer(customer)));
  }, []);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    console.info("Customer save started");
    setMessage("");
    if (!name.trim() && !companyName.trim()) {
      console.error("Customer save failed", "顧客名を入力してください");
      setMessage("顧客保存に失敗しました: 顧客名を入力してください");
      return;
    }
    try {
      createCustomer({
        type,
        name: name.trim() || companyName.trim(),
        companyName: companyName.trim(),
        contactName: contactName.trim(),
        phone: phone.trim(),
        email: email.trim(),
        postalCode: postalCode.trim(),
        address: address.trim(),
        memo: memo.trim()
      });
      const nextCustomers = safeArray(loadState().customers).map((customer) => normalizeCustomer(customer));
      setCustomers(nextCustomers);
      setName("");
      setCompanyName("");
      setContactName("");
      setPhone("");
      setEmail("");
      setPostalCode("");
      setAddress("");
      setMemo("");
      setMessage("顧客を保存しました");
      console.info("Customer save success", { customerCount: nextCustomers.length });
    } catch (error) {
      const reason = error instanceof Error ? error.message : "保存先データが存在しません";
      console.error("Customer save failed", error);
      recordAppError("顧客保存失敗", "/customers", error);
      setMessage(`顧客保存に失敗しました: ${reason}`);
    }
  }

  return (
    <main className="min-h-dvh bg-paper pb-8">
      <BackButton />
      <section className="mx-auto max-w-md px-4 py-5">
        <header className="flex items-center gap-3">
          <h1 className="text-2xl font-black">顧客管理</h1>
        </header>

        <form className="mt-5 rounded bg-white p-4 shadow-sm" onSubmit={submit}>
          <p className="font-black">顧客を追加</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              className={`flex h-12 items-center justify-center gap-2 rounded font-bold ${type === "individual" ? "bg-moss text-white" : "border border-slate-300"}`}
              onClick={() => setType("individual")}
            >
              <User size={18} />
              個人
            </button>
            <button
              type="button"
              className={`flex h-12 items-center justify-center gap-2 rounded font-bold ${type === "corporate" ? "bg-moss text-white" : "border border-slate-300"}`}
              onClick={() => setType("corporate")}
            >
              <Building2 size={18} />
              法人
            </button>
          </div>
          <div className="mt-3 space-y-3">
            {type === "corporate" ? (
            <input className="h-14 w-full rounded border border-slate-300 px-3" placeholder="法人名" value={companyName} onChange={(event) => setCompanyName(event.target.value)} />
          ) : null}
            <input className="h-14 w-full rounded border border-slate-300 px-3" placeholder="顧客名" value={name} onChange={(event) => setName(event.target.value)} />
            <input className="h-14 w-full rounded border border-slate-300 px-3" placeholder="担当者名" value={contactName} onChange={(event) => setContactName(event.target.value)} />
            <input className="h-14 w-full rounded border border-slate-300 px-3" placeholder="電話番号" value={phone} onChange={(event) => setPhone(event.target.value)} />
            <input className="h-14 w-full rounded border border-slate-300 px-3" placeholder="メール" value={email} onChange={(event) => setEmail(event.target.value)} />
            <input className="h-14 w-full rounded border border-slate-300 px-3" placeholder="郵便番号" value={postalCode} onChange={(event) => setPostalCode(event.target.value)} />
            <input className="h-14 w-full rounded border border-slate-300 px-3" placeholder="住所" value={address} onChange={(event) => setAddress(event.target.value)} />
            <textarea className="min-h-20 w-full rounded border border-slate-300 p-3" placeholder="メモ" value={memo} onChange={(event) => setMemo(event.target.value)} />
          </div>
          <button className="mt-3 flex h-14 w-full items-center justify-center gap-2 rounded bg-moss font-black text-white">
            <Save size={20} />
            保存
          </button>
          {message ? <p className="mt-3 text-sm font-bold text-moss">{message}</p> : null}
        </form>

        <div className="mt-5 space-y-3">
          {safeArray(customers).length === 0 ? (
            <div className="rounded border border-dashed border-slate-300 bg-white p-5 text-center text-sm text-slate-500">
              まだ顧客がありません
            </div>
          ) : (
            safeArray(customers).map((customer) => {
              const safeCustomer = normalizeCustomer(customer);
              const customerRouteId = encodeRouteCustomerId(safeCustomer.id);
              return (
              <article key={safeCustomer.id} className="rounded bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-black">{safeCustomer.companyName || safeCustomer.name}</p>
                    {safeCustomer.contactName ? <p className="mt-1 text-sm text-slate-500">担当: {safeCustomer.contactName}</p> : null}
                    {safeCustomer.phone ? <p className="mt-1 text-sm text-slate-500">{safeCustomer.phone}</p> : null}
                  </div>
                  <span className="rounded bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                    {safeCustomer.type === "corporate" ? "法人" : "個人"}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <a href={`/customers/${customerRouteId}`} className="flex h-12 items-center justify-center rounded border border-slate-300 font-bold text-sumi">
                    詳細
                  </a>
                  <Link href={`/estimates/new?customerId=${customerRouteId}`} className="flex h-12 items-center justify-center gap-2 rounded bg-moss font-bold text-white">
                    見積作成
                  </Link>
                  <a href={`/customers/${customerRouteId}/estimates`} className="flex h-12 items-center justify-center rounded border border-slate-300 text-center text-sm font-bold text-sumi">
                    過去の見積
                  </a>
                </div>
              </article>
            );
            })
          )}
        </div>
      </section>
    </main>
  );
}
