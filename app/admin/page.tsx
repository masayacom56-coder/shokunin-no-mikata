"use client";

import { Download } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  buildAdminMetrics,
  downloadAdminMetricsCsv,
  enableAdminMode,
  getRecentErrorLogs,
  getRecentOperationLogs,
  isAdminModeEnabled
} from "@/lib/admin-metrics";
import type { AdminErrorLog, AdminMetrics, AdminOperationLog } from "@/lib/admin-metrics";

const emptyMetrics: AdminMetrics = {
  companyCount: 0,
  activeCompanyCount: 0,
  estimateCount: 0,
  invoiceCount: 0,
  receiptCount: 0,
  pdfOutputCount: 0,
  pdfSuccessCount: 0,
  pdfFailureCount: 0,
  errorCount: 0
};

const cards: Array<{ key: keyof AdminMetrics; label: string }> = [
  { key: "companyCount", label: "利用会社数" },
  { key: "activeCompanyCount", label: "アクティブ会社数" },
  { key: "estimateCount", label: "見積作成数" },
  { key: "invoiceCount", label: "請求書作成数" },
  { key: "receiptCount", label: "領収書作成数" },
  { key: "pdfOutputCount", label: "PDF出力数" },
  { key: "pdfSuccessCount", label: "PDF成功数" },
  { key: "pdfFailureCount", label: "PDF失敗数" },
  { key: "errorCount", label: "エラー件数" }
];

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export default function AdminPage() {
  const [allowed, setAllowed] = useState(false);
  const [metrics, setMetrics] = useState<AdminMetrics>(emptyMetrics);
  const [errorLogs, setErrorLogs] = useState<AdminErrorLog[]>([]);
  const [operationLogs, setOperationLogs] = useState<AdminOperationLog[]>([]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("admin") === "1") enableAdminMode();
    const canView = isAdminModeEnabled();
    setAllowed(canView);
    if (canView) {
      setMetrics(buildAdminMetrics());
      setErrorLogs(getRecentErrorLogs(20));
      setOperationLogs(getRecentOperationLogs(50));
    }
  }, []);

  const rows = useMemo(() => cards.map((card) => ({ ...card, value: Number(metrics[card.key]) || 0 })), [metrics]);

  if (!allowed) {
    return (
      <main className="min-h-dvh bg-paper px-4 py-10 text-sumi">
        <section className="mx-auto max-w-md rounded bg-white p-5 shadow-sm">
          <h1 className="text-2xl font-black">管理者専用</h1>
          <p className="mt-3 text-lg font-bold text-slate-600">この画面は管理者のみ閲覧できます。</p>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-paper px-4 py-6 text-sumi">
      <section className="mx-auto max-w-md">
        <header className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-moss">モニターテスト</p>
            <h1 className="text-2xl font-black">管理者ダッシュボード</h1>
          </div>
          <button
            className="flex h-14 items-center gap-2 rounded bg-moss px-4 text-base font-black text-white"
            onClick={() => downloadAdminMetricsCsv(metrics, errorLogs, operationLogs)}
            type="button"
          >
            <Download size={22} />
            CSV
          </button>
        </header>

        <div className="mt-5 grid grid-cols-2 gap-3">
          {rows.map((row) => (
            <article key={row.key} className="rounded bg-white p-4 shadow-sm">
              <p className="text-sm font-bold text-slate-500">{row.label}</p>
              <p className="mt-2 text-3xl font-black">{row.value}</p>
            </article>
          ))}
        </div>

        <section className="mt-5 rounded bg-white p-4 shadow-sm">
          <h2 className="text-lg font-black">CSV出力内容</h2>
          <p className="mt-2 text-sm font-bold leading-6 text-slate-600">
            会社数、見積件数、請求書件数、領収書件数、PDF出力件数、PDF成功数、PDF失敗数、エラー件数、直近エラー、直近操作のみを出力します。
            顧客名、住所、電話番号、メールアドレスは含めません。
          </p>
        </section>

        <section className="mt-5 rounded bg-white p-4 shadow-sm">
          <h2 className="text-lg font-black">直近エラー20件</h2>
          <div className="mt-3 space-y-3">
            {errorLogs.length === 0 ? (
              <p className="text-sm font-bold text-slate-500">エラーはありません</p>
            ) : (
              errorLogs.map((log) => (
                <article key={`${log.createdAt}-${log.errorType}-${log.page}`} className="rounded border border-red-100 bg-red-50 p-3">
                  <p className="text-xs font-bold text-slate-500">{formatDateTime(log.createdAt)}</p>
                  <p className="mt-1 font-black text-red-700">{log.errorType}</p>
                  <p className="mt-1 text-sm font-bold text-slate-700">画面: {log.page}</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm font-bold text-slate-700">{log.message || "詳細なし"}</p>
                </article>
              ))
            )}
          </div>
        </section>

        <section className="mt-5 rounded bg-white p-4 shadow-sm">
          <h2 className="text-lg font-black">直近操作50件</h2>
          <div className="mt-3 space-y-3">
            {operationLogs.length === 0 ? (
              <p className="text-sm font-bold text-slate-500">操作ログはありません</p>
            ) : (
              operationLogs.map((log) => (
                <article key={`${log.createdAt}-${log.companyId}-${log.action}`} className="rounded border border-slate-200 p-3">
                  <p className="text-xs font-bold text-slate-500">{formatDateTime(log.createdAt)}</p>
                  <p className="mt-1 font-black">{log.action}</p>
                  <p className="mt-1 text-sm font-bold text-slate-600">会社ID: {log.companyId}</p>
                </article>
              ))
            )}
          </div>
        </section>
      </section>
    </main>
  );
}
