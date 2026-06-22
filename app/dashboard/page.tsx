"use client";

import Link from "next/link";
import { Building2, FileText, Users } from "lucide-react";
import { BackButton } from "@/components/back-button";

const menu = [
  { href: "/estimates/new", icon: FileText, label: "見積作成", text: "現場で数量入力" },
  { href: "/customers", icon: Users, label: "顧客管理", text: "顧客追加から見積作成" },
  { href: "/settings/company", icon: Building2, label: "会社情報", text: "PDF記載情報" },
  { href: "/settings/prices", icon: FileText, label: "単価マスタ", text: "工事項目ごとの標準単価" }
];

export default function DashboardPage() {
  return (
    <main className="min-h-dvh bg-paper pb-8">
      <BackButton />
      <section className="mx-auto max-w-md px-4 py-5">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black">ダッシュボード</h1>
          </div>
        </header>

        <div className="mt-5 grid gap-3">
          {menu.map((item) => (
            <Link key={item.label} href={item.href} className="flex min-h-[72px] items-center gap-4 rounded bg-moss p-4 text-white shadow-sm">
              <item.icon size={28} />
              <span>
                <p className="text-xl font-black">{item.label}</p>
                <p className="mt-1 text-sm font-bold text-white/80">{item.text}</p>
              </span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
