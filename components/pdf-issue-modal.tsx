"use client";

import { useEffect, useState } from "react";
import type { DocumentType, PdfIssueFields } from "@/lib/types";

type PdfIssueModalProps = {
  documentType: DocumentType;
  initialFields: PdfIssueFields;
  onClose: () => void;
  onIssue: (fields: PdfIssueFields) => void;
};

function documentTitle(type: DocumentType) {
  if (type === "invoice") return "請求書";
  if (type === "receipt") return "領収書";
  return "見積書";
}

function fieldLabels(type: DocumentType) {
  if (type === "invoice") {
    return {
      date: "請求日",
      due: "支払期限",
      number: "請求番号"
    };
  }
  if (type === "receipt") {
    return {
      date: "入金日",
      due: "但し書き",
      number: "領収書番号"
    };
  }
  return {
    date: "見積日",
    due: "有効期限",
    number: "見積番号"
  };
}

function normalizeFields(fields: PdfIssueFields): PdfIssueFields {
  return {
    recipientName: fields.recipientName ?? "",
    issueDate: fields.issueDate ?? "",
    documentNumber: fields.documentNumber ?? "",
    validUntil: fields.validUntil ?? "",
    paymentDue: fields.paymentDue ?? "",
    receiptNote: fields.receiptNote ?? ""
  };
}

function todaySlash() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}/${month}/${day}`;
}

function toDateInputValue(value: string) {
  const normalized = (value || todaySlash()).replaceAll("/", "-").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : todaySlash().replaceAll("/", "-");
}

function fromDateInputValue(value: string) {
  return value ? value.replaceAll("-", "/") : todaySlash();
}

export function PdfIssueModal({ documentType, initialFields, onClose, onIssue }: PdfIssueModalProps) {
  const [fields, setFields] = useState<PdfIssueFields>(() => normalizeFields(initialFields));
  const labels = fieldLabels(documentType);

  useEffect(() => {
    setFields(normalizeFields(initialFields));
  }, [initialFields]);

  const dueValue = documentType === "invoice" ? fields.paymentDue : documentType === "receipt" ? fields.receiptNote : fields.validUntil;

  function updateDue(value: string) {
    if (documentType === "invoice") {
      setFields((current) => ({ ...current, paymentDue: value }));
      return;
    }
    if (documentType === "receipt") {
      setFields((current) => ({ ...current, receiptNote: value }));
      return;
    }
    setFields((current) => ({ ...current, validUntil: value }));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 px-4 py-5">
      <section className="w-full max-w-md rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[18px] font-bold text-moss">発行前確認</p>
            <h2 className="text-[28px] font-black">{documentTitle(documentType)}</h2>
          </div>
          <button className="h-14 rounded border border-slate-300 px-4 text-[18px] font-black" onClick={onClose} type="button">
            閉じる
          </button>
        </div>

        <div className="mt-5 space-y-4">
          <label className="block">
            <span className="text-[20px] font-black">宛名</span>
            <input
              className="mt-2 h-[64px] w-full rounded border border-slate-300 px-4 text-[22px] font-black"
              value={fields.recipientName}
              onChange={(event) => setFields((current) => ({ ...current, recipientName: event.target.value }))}
            />
          </label>

          <label className="block">
            <span className="text-[20px] font-black">{labels.date}</span>
            <input
              className="mt-2 h-[64px] w-full rounded border border-slate-300 px-4 text-[22px] font-black"
              type="date"
              value={toDateInputValue(fields.issueDate)}
              onChange={(event) => setFields((current) => ({ ...current, issueDate: fromDateInputValue(event.target.value) }))}
              placeholder="2026/06/18"
            />
          </label>

          <label className="block">
            <span className="text-[20px] font-black">{labels.due}</span>
            {documentType === "receipt" ? (
              <textarea
                className="mt-2 min-h-[88px] w-full rounded border border-slate-300 px-4 py-3 text-[22px] font-black"
                value={dueValue}
                onChange={(event) => updateDue(event.target.value)}
                placeholder="工事代金として"
              />
            ) : (
              <input
                className="mt-2 h-[64px] w-full rounded border border-slate-300 px-4 text-[22px] font-black"
                type={documentType === "invoice" ? "date" : "text"}
                value={documentType === "invoice" ? toDateInputValue(dueValue) : dueValue}
                onChange={(event) => updateDue(documentType === "invoice" ? fromDateInputValue(event.target.value) : event.target.value)}
              />
            )}
          </label>

          <label className="block">
            <span className="text-[20px] font-black">{labels.number}</span>
            <input
              className="mt-2 h-[64px] w-full rounded border border-slate-300 px-4 text-[22px] font-black"
              value={fields.documentNumber}
              onChange={(event) => setFields((current) => ({ ...current, documentNumber: event.target.value }))}
            />
          </label>
        </div>

        <button className="mt-5 h-[76px] w-full rounded bg-moss text-[26px] font-black text-white" onClick={() => onIssue(normalizeFields(fields))} type="button">
          発行
        </button>
      </section>
    </div>
  );
}
