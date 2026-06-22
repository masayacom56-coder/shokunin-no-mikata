"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { BackButton } from "@/components/back-button";
import { PdfIssueModal } from "@/components/pdf-issue-modal";
import { deleteEstimate, duplicateEstimate, loadState } from "@/lib/app-store";
import { recordAppError, recordPdfFailure, recordPdfOutput } from "@/lib/admin-metrics";
import { yen } from "@/lib/calc";
import { generateEstimatePdf } from "@/lib/pdf";
import { normalizeCustomer, normalizeEstimate, safeArray } from "@/lib/safety";
import type { AppState, Customer, DocumentType, Estimate, PdfIssueFields } from "@/lib/types";

function formatDate(value: string) {
  return (value || "").slice(0, 10).replaceAll("-", "/");
}

function addDaysText(value: string, days: number) {
  const date = new Date(value || new Date().toISOString());
  if (Number.isNaN(date.getTime())) return formatDate(new Date().toISOString());
  date.setDate(date.getDate() + days);
  return formatDate(date.toISOString());
}

function belongsToCustomer(estimate: Estimate, customer: Customer) {
  const safeEstimate = normalizeEstimate(estimate);
  const safeCustomer = normalizeCustomer(customer);
  const estimateName = safeEstimate.customer.companyName || safeEstimate.customer.name;
  const customerName = safeCustomer.companyName || safeCustomer.name;
  return safeEstimate.customer.id === safeCustomer.id || estimateName === customerName;
}

function documentLabel(type: DocumentType) {
  if (type === "invoice") return "請求書";
  if (type === "receipt") return "領収書";
  return "見積書";
}

function dateLabel(type: DocumentType) {
  if (type === "invoice") return "請求日";
  if (type === "receipt") return "領収日";
  return "見積日";
}

function badgeClass(type: DocumentType) {
  if (type === "invoice") return "bg-blue-600 text-white";
  if (type === "receipt") return "bg-orange-500 text-white";
  return "bg-moss text-white";
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return "Unknown error";
  }
}

export default function CustomerEstimateHistoryPage() {
  const params = useParams<{ id: string }>();
  const [state, setState] = useState<AppState | null>(null);
  const [message, setMessage] = useState("");
  const [pendingIssue, setPendingIssue] = useState<{ estimate: Estimate; documentType: DocumentType; fields: PdfIssueFields } | null>(null);

  useEffect(() => {
    setState(loadState());
  }, []);

  const customer = useMemo(() => {
    const found = safeArray(state?.customers).find((item) => item.id === params.id) ?? null;
    return found ? normalizeCustomer(found) : null;
  }, [params.id, state]);
  const estimates = useMemo(() => {
    if (!state || !customer) return [];
    return safeArray(state.estimates).map((estimate) => normalizeEstimate(estimate)).filter((estimate) => belongsToCustomer(estimate, customer));
  }, [customer, state]);

  function initialIssueFields(estimate: Estimate, documentType: DocumentType): PdfIssueFields {
    const today = new Date().toISOString();
    return {
      recipientName: estimate.customer.companyName || estimate.customer.name || "御見積先",
      issueDate: formatDate(today),
      documentNumber: estimate.estimateNo,
      validUntil: "発行日より14日",
      paymentDue: addDaysText(today, 30),
      receiptNote: estimate.receiptNote || "工事代金として"
    };
  }

  function outputPdf(estimate: Estimate, documentType: DocumentType = estimate.documentType ?? "estimate") {
    const safeEstimate = normalizeEstimate({ ...estimate, company: state?.company ?? estimate.company, documentType });
    setPendingIssue({
      estimate: safeEstimate,
      documentType,
      fields: initialIssueFields(safeEstimate, documentType)
    });
  }

  async function issuePdf(fields: PdfIssueFields) {
    if (!pendingIssue) return;
    try {
      await generateEstimatePdf(pendingIssue.estimate, pendingIssue.documentType, fields);
      recordPdfOutput(pendingIssue.documentType, "/customers/[id]/estimates");
      setMessage("PDFを出力しました");
      setPendingIssue(null);
    } catch (error) {
      const reason = errorMessage(error);
      console.error("PDF Generation Error", reason);
      console.error("[CustomerEstimateHistory] pdf_failed", reason);
      recordPdfFailure(pendingIssue.documentType, "/customers/[id]/estimates", error);
      recordAppError("PDF生成失敗", "/customers/[id]/estimates", error);
      setMessage(`PDF生成失敗\nreason: ${reason}`);
    }
  }

  function copyEstimate(estimateId: string) {
    duplicateEstimate(estimateId);
    setState(loadState());
    setMessage("複製しました");
  }

  function removeEstimate(estimateId: string) {
    setState(deleteEstimate(estimateId));
    setMessage("削除しました");
  }

  return (
    <main className="min-h-dvh bg-paper pb-8">
      <BackButton />
      <section className="mx-auto max-w-md px-4 py-5">
        <h1 className="text-2xl font-black">過去の見積</h1>
        <p className="mt-2 font-bold text-slate-600">{customer ? customer.companyName || customer.name : ""}</p>

        <div className="mt-5 space-y-3">
          {safeArray(estimates).length === 0 ? (
            <div className="rounded bg-white p-5 text-center text-sm text-slate-500 shadow-sm">過去の見積はありません</div>
          ) : (
            safeArray(estimates).map((estimate) => {
              const safeEstimate = normalizeEstimate(estimate);
              return (
              <article key={safeEstimate.id} className="rounded bg-white p-4 shadow-sm">
                <div className="space-y-1">
                  <span className={`inline-flex rounded px-3 py-1 text-xs font-black ${badgeClass(safeEstimate.documentType ?? "estimate")}`}>
                    {documentLabel(safeEstimate.documentType ?? "estimate")}
                  </span>
                  <p className="font-black">
                    {dateLabel(safeEstimate.documentType ?? "estimate")}: {formatDate(safeEstimate.createdAt)}
                  </p>
                  <p className="font-bold text-slate-600">見積番号: {safeEstimate.estimateNo}</p>
                  <p className="text-xl font-black text-moss">合計金額: {yen(safeEstimate.totals.total)}</p>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <button className="h-12 rounded bg-moss text-sm font-black text-white" onClick={() => void outputPdf(safeEstimate, "estimate")} type="button">
                    見積書
                  </button>
                  <button className="h-12 rounded bg-blue-600 text-sm font-black text-white" onClick={() => void outputPdf(safeEstimate, "invoice")} type="button">
                    請求書
                  </button>
                  <button className="h-12 rounded bg-orange-500 text-sm font-black text-white" onClick={() => void outputPdf(safeEstimate, "receipt")} type="button">
                    領収書
                  </button>
                  <button className="h-12 rounded border border-slate-300 text-sm font-black text-sumi" onClick={() => void outputPdf(safeEstimate)} type="button">
                    PDF再出力
                  </button>
                  <button className="h-12 rounded border border-slate-300 text-sm font-black text-sumi" onClick={() => copyEstimate(safeEstimate.id)} type="button">
                    複製
                  </button>
                  <button className="h-12 rounded border border-red-200 bg-red-50 text-sm font-black text-red-600" onClick={() => removeEstimate(safeEstimate.id)} type="button">
                    削除
                  </button>
                </div>
              </article>
            );
            })
          )}
        </div>

        {message ? <p className="mt-4 rounded bg-white p-3 text-center text-sm font-black text-moss shadow-sm">{message}</p> : null}
        <Link href="/customers" className="mt-4 flex h-12 items-center justify-center rounded border border-slate-300 bg-white font-bold text-sumi">
          顧客管理へ戻る
        </Link>
      </section>
      {pendingIssue ? (
        <PdfIssueModal
          documentType={pendingIssue.documentType}
          initialFields={pendingIssue.fields}
          onClose={() => setPendingIssue(null)}
          onIssue={(fields) => void issuePdf(fields)}
        />
      ) : null}
    </main>
  );
}
