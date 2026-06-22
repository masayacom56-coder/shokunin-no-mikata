"use client";

import Link from "next/link";
import { ArrowLeft, Check, FileDown, Minus, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createEstimate, findOrCreateCustomerByName, getUsage, loadState, rememberWorkItemPrice } from "@/lib/app-store";
import { PdfIssueModal } from "@/components/pdf-issue-modal";
import { recordAppError, recordOperation, recordPdfFailure, recordPdfOutput } from "@/lib/admin-metrics";
import { calcLine, calcTotals, yen } from "@/lib/calc";
import { unitLabels } from "@/lib/master-data";
import { generateEstimatePdf } from "@/lib/pdf";
import { saveOffline } from "@/lib/offline-store";
import { createId, normalizeEstimate, normalizeLine, safeArray, validateEstimate } from "@/lib/safety";
import type { AppState, Customer, DiscountType, DocumentType, Estimate, EstimateLine, PdfIssueFields, Project, UnitCode } from "@/lib/types";

const DRAFT_KEY = "shokunin-no-mikata-direct-estimate-draft";

type LineDraft = {
  name: string;
  tradeId: string;
  quantity: string;
  unit: UnitCode;
  unitPrice: string;
  templateId: string;
};

type StoredDraft = {
  customerName: string;
  estimateDate: string;
  constructionMemo: string;
  selectedTradeId: string;
  lineDraft: LineDraft;
  lines: EstimateLine[];
  discountType: DiscountType;
  discountValue: string;
  documentType: DocumentType;
  receiptNote: string;
};

const emptyLineDraft: LineDraft = {
  name: "",
  tradeId: "",
  quantity: "1",
  unit: "sqm",
  unitPrice: "",
  templateId: ""
};

function todayText() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function slashDate(value: string) {
  return (value || todayText()).slice(0, 10).replaceAll("-", "/");
}

function addDaysText(value: string, days: number) {
  const date = new Date(value || todayText());
  if (Number.isNaN(date.getTime())) return slashDate(todayText());
  date.setDate(date.getDate() + days);
  return slashDate(date.toISOString());
}

function numberText(value: number) {
  return Number.isInteger(value) ? String(value) : String(value);
}

function makeProject(constructionMemo: string, customerId: string): Project {
  return {
    id: "direct-construction-memo",
    customerId,
    title: constructionMemo.trim() || "現場見積",
    status: "estimating",
    memo: constructionMemo,
    photoComments: []
  };
}

function lineFromDraft(draft: LineDraft, fallbackTradeId = "direct"): EstimateLine | null {
  const name = draft.name.trim();
  const quantity = Number(draft.quantity || 0);
  const unitPrice = Number(draft.unitPrice || 0);
  if (!name || quantity <= 0) return null;
  return {
    id: createId(),
    tradeId: draft.tradeId || fallbackTradeId,
    workItemId: draft.templateId || "manual",
    name,
    unit: draft.unit,
    quantity,
    unitPrice,
    materialCost: 0,
    laborCost: unitPrice,
    lineTotal: calcLine(quantity, unitPrice)
  };
}

function draftFromLine(line: EstimateLine): LineDraft {
  return {
    name: line.name,
    tradeId: line.tradeId,
    quantity: numberText(line.quantity),
    unit: line.unit,
    unitPrice: line.unitPrice > 0 ? numberText(line.unitPrice) : "",
    templateId: line.workItemId
  };
}

function shouldBypassFreePlanLimit() {
  if (process.env.NODE_ENV === "development") return true;
  if (typeof window === "undefined") return false;
  return ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
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

function documentOperationLabel(type: DocumentType) {
  if (type === "invoice") return "請求書作成";
  if (type === "receipt") return "領収書作成";
  return "見積作成";
}

function clearStoredDraft() {
  try {
    window.localStorage.removeItem(DRAFT_KEY);
  } catch (error) {
    console.error("[EstimateDraft] clear_failed", error);
  }
}

function saveStoredDraft(draft: StoredDraft) {
  try {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch (error) {
    console.error("[EstimateDraft] save_failed", error);
  }
}

export default function NewEstimatePage() {
  const [state, setState] = useState<AppState | null>(null);
  const [documentType, setDocumentType] = useState<DocumentType>("estimate");
  const [customerName, setCustomerName] = useState("");
  const [estimateDate, setEstimateDate] = useState(todayText());
  const [constructionMemo, setConstructionMemo] = useState("");
  const [receiptNote, setReceiptNote] = useState("");
  const [selectedTradeId, setSelectedTradeId] = useState("");
  const [lineDraft, setLineDraft] = useState<LineDraft>(emptyLineDraft);
  const [lines, setLines] = useState<EstimateLine[]>([]);
  const [discountType, setDiscountType] = useState<DiscountType>("amount");
  const [discountValue, setDiscountValue] = useState("");
  const [draftMessage, setDraftMessage] = useState("自動保存中");
  const [message, setMessage] = useState("");
  const [lastEstimate, setLastEstimate] = useState<Estimate | null>(null);
  const [pendingIssue, setPendingIssue] = useState<{ estimate: Estimate; documentType: DocumentType; fields: PdfIssueFields } | null>(null);

  useEffect(() => {
    const loaded = loadState();
    setState(loaded);
    setSelectedTradeId(safeArray(loaded.trades)[0]?.id ?? "");
    const params = new URLSearchParams(window.location.search);
    const linkedCustomerId = params.get("customerId");
    const linkedCustomer = linkedCustomerId ? safeArray(loaded.customers).find((customer) => customer.id === linkedCustomerId) : null;

    clearStoredDraft();
    setCustomerName(linkedCustomer ? linkedCustomer.companyName || linkedCustomer.name : "");
    setEstimateDate(todayText());
    setConstructionMemo("");
    setLineDraft(emptyLineDraft);
    setLines([]);
    setDiscountType("amount");
    setDiscountValue("");
    setDocumentType("estimate");
    setReceiptNote("");
  }, []);

  useEffect(() => {
    if (!state) return;
    const draft: StoredDraft = { customerName, estimateDate, constructionMemo, selectedTradeId, lineDraft, lines, discountType, discountValue, documentType, receiptNote };
    saveStoredDraft(draft);
    setDraftMessage(navigator.onLine ? "自動保存済み" : "オフライン保存済み");
    setLastEstimate(null);
  }, [constructionMemo, customerName, discountType, discountValue, documentType, estimateDate, lineDraft, lines, receiptNote, selectedTradeId, state]);

  const workItemsForTrade = useMemo(() => {
    const safeWorkItems = safeArray(state?.workItems);
    const items = safeWorkItems.filter((item) => item.tradeId === selectedTradeId);
    const seen = new Set<string>();
    return items
      .filter((item) => {
        const key = item.name.trim();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((item) => {
        const rememberedPrice = state?.lastUnitPrices?.[item.id];
        const preferredPrice = rememberedPrice ?? (item.standardPrice > 0 ? item.standardPrice : 0);
        return {
          id: item.id,
          tradeId: item.tradeId,
          workItemId: item.id,
          name: item.name,
          unit: item.unit,
          quantity: 1,
          unitPrice: preferredPrice,
          materialCost: item.materialCost,
          laborCost: preferredPrice,
          lineTotal: preferredPrice
        };
      });
  }, [selectedTradeId, state]);

  const totals = useMemo(
    () => calcTotals(lines, discountType, Number(discountValue || 0)),
    [lines, discountType, discountValue]
  );
  const draftTotal = calcLine(Number(lineDraft.quantity || 0), Number(lineDraft.unitPrice || 0));

  function selectWorkItem(line: EstimateLine) {
    setLineDraft({ ...draftFromLine(line), name: line.name });
    setMessage("名称は自由に変更できます");
  }

  function addLine() {
    const line = lineFromDraft(lineDraft, selectedTradeId);
    if (!line) {
      setMessage("工事項目を入力してください");
      return;
    }
    if (line.workItemId !== "manual") {
      setState(rememberWorkItemPrice(line.workItemId, line.unitPrice));
    }
    setLines((current) => [...current, line]);
    setLineDraft({ ...lineDraft, name: "", quantity: "1", unitPrice: "", templateId: "" });
    setMessage("決定しました");
  }

  function changeDraftQuantity(delta: number) {
    const current = Number(lineDraft.quantity || 0);
    const next = Math.max(0, Math.round((current + delta) * 10) / 10);
    setLineDraft((currentDraft) => ({ ...currentDraft, quantity: numberText(next) }));
  }

  function makeEstimateForCurrentInput() {
    if (!state) {
      setMessage("PDF生成失敗\nreason: app state is not loaded");
      return null;
    }
    if (state.plan === "free" && getUsage(state).monthlyEstimates >= 3 && !lastEstimate && !shouldBypassFreePlanLimit()) {
      setMessage("無料プランの月3件上限に達しました");
      return null;
    }
    const safeLines = safeArray(lines);
    safeLines.forEach((line) => {
      if (line.workItemId !== "manual") {
        rememberWorkItemPrice(line.workItemId, line.unitPrice);
      }
    });
    const estimateCustomer = findOrCreateCustomerByName(customerName);
    const estimate =
      lastEstimate ??
      createEstimate({
        customer: estimateCustomer,
        project: makeProject(constructionMemo, estimateCustomer.id),
        company: state.company,
        lines: safeLines.map((line) => normalizeLine(line)),
        discountType,
        discountValue: Number(discountValue || 0),
        note: constructionMemo || "有効期限は発行日より14日です。",
        plan: state.plan,
        documentType,
        receiptNote,
        createdAt: estimateDate
      });
    if (!lastEstimate) recordOperation(documentOperationLabel(documentType), "/estimates/new", estimate.company.id);
    const validation = validateEstimate(estimate);
    if (!validation.ok) {
      console.error("[Estimate] makeEstimateForCurrentInput:invalid", validation.message, validation.estimate);
      setMessage(validation.message);
      return null;
    }
    setLastEstimate(estimate);
    setState(loadState());
    setLines(safeLines);
    setLineDraft({ ...lineDraft, name: "", quantity: "1", unitPrice: "", templateId: "" });
    return estimate;
  }

  async function saveEstimate() {
    const estimate = makeEstimateForCurrentInput();
    if (!estimate) return null;
    if (!lastEstimate) {
      await saveOffline({
        id: Date.now().toString(),
        type: "estimate",
        payload: estimate,
        createdAt: new Date().toISOString(),
        synced: false
      });
    }
    setMessage(navigator.onLine ? "見積を保存しました" : "オフライン保存しました");
    return estimate;
  }

  function currentInputPdfBlockReason() {
    if (!state) return "App state missing";
    if (!Array.isArray(lines)) return "Estimate items missing";
    if (safeArray(lines).length === 0) return "Estimate items empty";
    if (!customerName.trim()) return "Customer missing";
    if (!state.company?.name?.trim()) return "Company missing";
    return "";
  }

  function validatePdfEstimateData(estimate: Estimate | null | undefined) {
    if (!estimate) return { ok: false, reason: "Estimate missing" };
    if (!estimate.id) return { ok: false, reason: "Estimate id missing" };
    const source = estimate as Estimate & { lines?: unknown; customer?: unknown; company?: unknown };
    if (!Array.isArray(source.lines)) return { ok: false, reason: "Estimate items missing" };
    if (source.lines.length === 0) return { ok: false, reason: "Estimate items empty" };
    if (!source.customer) return { ok: false, reason: "Customer missing" };
    if (!source.company) return { ok: false, reason: "Company missing" };
    const safeEstimate = normalizeEstimate(estimate);
    const customerLabel = (safeEstimate.customer.companyName || safeEstimate.customer.name).trim();
    const companyLabel = safeEstimate.company.name.trim();
    if (!customerLabel) return { ok: false, reason: "Customer missing" };
    if (!companyLabel) return { ok: false, reason: "Company missing" };
    const validation = validateEstimate(safeEstimate);
    if (!validation.ok) return { ok: false, reason: validation.message || "Estimate invalid" };
    return { ok: true, reason: "" };
  }

  function logPdfTarget(stage: string, estimate: Estimate | null | undefined, targetDocumentType: DocumentType) {
    const safeEstimate = estimate ? normalizeEstimate(estimate) : null;
    console.info("[PDF] target_data", {
      stage,
      documentType: targetDocumentType,
      estimateExists: Boolean(estimate),
      estimateId: safeEstimate?.id ?? "",
      estimateNo: safeEstimate?.estimateNo ?? "",
      itemCount: safeArray(safeEstimate?.lines).length,
      customerName: safeEstimate ? safeEstimate.customer.companyName || safeEstimate.customer.name : "",
      companyName: safeEstimate?.company.name ?? "",
      totals: safeEstimate?.totals ?? null
    });
  }

  function showPdfFailure(reason: string, stage: string, estimate?: Estimate | null) {
    console.error("PDF Generation Error", new Error(reason));
    console.error("[PDF] validation_failed", { stage, reason, estimate });
    recordPdfFailure(documentType, "/estimates/new", reason);
    setMessage(`PDF生成失敗\nreason: ${reason}`);
  }

  function initialIssueFields(estimate: Estimate, type: DocumentType): PdfIssueFields {
    const recipientName = estimate.customer.companyName || estimate.customer.name || customerName || "御見積先";
    const issueDate = slashDate(todayText());
    return {
      recipientName,
      issueDate,
      documentNumber: estimate.estimateNo,
      validUntil: "発行日より14日",
      paymentDue: addDaysText(todayText(), 30),
      receiptNote: receiptNote || "工事代金として"
    };
  }

  async function openPdfIssueModal() {
    console.info("[PDF] openIssueModal:start", { documentType, lineCount: safeArray(lines).length });
    const inputBlockReason = currentInputPdfBlockReason();
    if (inputBlockReason) {
      showPdfFailure(inputBlockReason, "open_issue_modal:input");
      return;
    }
    const estimate = await saveEstimate();
    logPdfTarget("open_issue_modal:after_save", estimate, documentType);
    const pdfValidation = validatePdfEstimateData(estimate);
    if (!pdfValidation.ok) {
      showPdfFailure(pdfValidation.reason, "open_issue_modal:validate", estimate);
      return;
    }
    const readyEstimate = normalizeEstimate(estimate);
    const validation = validateEstimate({ ...readyEstimate, documentType, receiptNote });
    if (!validation.ok) {
      const reason = validation.message || "validateEstimate failed";
      showPdfFailure(reason, "open_issue_modal:validate_estimate", estimate);
      return;
    }
    const safeEstimate = normalizeEstimate(validation.estimate);
    setPendingIssue({
      estimate: safeEstimate,
      documentType,
      fields: initialIssueFields(safeEstimate, documentType)
    });
  }

  async function createPdf(issueFields: PdfIssueFields) {
    try {
      console.info("[PDF] createPdf:start", { documentType: pendingIssue?.documentType ?? documentType, lineCount: safeArray(lines).length });
      const estimate = pendingIssue?.estimate ?? (await saveEstimate());
      const issueDocumentType = pendingIssue?.documentType ?? documentType;
      logPdfTarget("create_pdf:before_generate", estimate, issueDocumentType);
      const pdfValidation = validatePdfEstimateData(estimate);
    if (!pdfValidation.ok) {
      showPdfFailure(pdfValidation.reason, "create_pdf:validate", estimate);
      return;
    }
      const readyEstimate = normalizeEstimate(estimate);
      console.info("[PDF] generateEstimatePdf:start", { estimateNo: readyEstimate.estimateNo, documentType: issueDocumentType });
      const validation = validateEstimate({ ...readyEstimate, documentType: issueDocumentType, receiptNote });
      if (!validation.ok) {
        const reason = validation.message || "validateEstimate failed";
        showPdfFailure(reason, "create_pdf:validate_estimate", estimate);
        return;
      }
      await generateEstimatePdf({ ...validation.estimate, documentType: issueDocumentType, receiptNote: issueFields.receiptNote }, issueDocumentType, issueFields);
      recordPdfOutput(issueDocumentType, "/estimates/new");
      console.info("[PDF] generateEstimatePdf:success", { estimateNo: readyEstimate.estimateNo, documentType: issueDocumentType });
      if (!lastEstimate) {
        void saveOffline({
          id: Date.now().toString(),
          type: "estimate",
          payload: estimate,
          createdAt: new Date().toISOString(),
          synced: false
        });
      }
      setMessage("PDFをダウンロードしました");
      setPendingIssue(null);
    } catch (error) {
      const reason = errorMessage(error);
      console.error("PDF Generation Error", reason);
      console.error("[PDF] createPdf:failed", reason);
      recordPdfFailure(pendingIssue?.documentType ?? documentType, "/estimates/new", error);
      recordAppError("PDF生成失敗", "/estimates/new", error);
      setMessage(`PDF生成失敗\nreason: ${reason}`);
    }
  }

  return (
    <main className="min-h-dvh bg-paper pb-40 text-[20px]">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto grid max-w-md grid-cols-[72px_1fr_72px] items-center gap-3">
          <Link href="/" className="grid h-[72px] place-items-center rounded border border-slate-200" aria-label="戻る">
            <ArrowLeft size={32} />
          </Link>
          <div className="text-center">
            <p className="text-[20px] font-bold text-moss">{draftMessage}</p>
            <h1 className="text-[28px] font-black">新規見積</h1>
          </div>
          <button className="grid h-[72px] place-items-center rounded bg-moss text-white" onClick={() => void openPdfIssueModal()} type="button" aria-label="PDF作成">
            <FileDown size={32} />
          </button>
        </div>
      </header>

      <section className="mx-auto max-w-md space-y-5 px-4 pt-5">
        <section className="grid grid-cols-3 gap-2 rounded bg-white p-2 shadow-sm">
          {[
            ["estimate", "見積書"],
            ["invoice", "請求書"],
            ["receipt", "領収書"]
          ].map(([value, label]) => (
            <button
              key={value}
              className={`h-14 rounded text-[18px] font-black ${documentType === value ? "bg-moss text-white" : "border border-slate-300 bg-white text-moss"}`}
              onClick={() => setDocumentType(value as DocumentType)}
              type="button"
            >
              {label}
            </button>
          ))}
        </section>

        <section className="rounded bg-white p-4 shadow-sm">
          <label className="block">
            <span className="text-[26px] font-black">顧客</span>
            <input
              className="mt-3 h-[70px] w-full rounded border border-slate-300 px-4 text-[24px] font-black"
              value={customerName}
              onChange={(event) => setCustomerName(event.target.value)}
              placeholder="山田様"
            />
          </label>
        </section>

        <section className="rounded bg-white p-4 shadow-sm">
          <label className="block">
            <span className="text-[26px] font-black">施工メモ</span>
            <textarea
              className="mt-3 min-h-[90px] w-full rounded border border-slate-300 px-4 py-3 text-[22px] font-bold leading-8"
              value={constructionMemo}
              onChange={(event) => setConstructionMemo(event.target.value)}
              placeholder="クロス張替"
            />
          </label>
        </section>

        {documentType === "receipt" ? (
          <section className="rounded bg-white p-4 shadow-sm">
            <label className="block">
              <span className="text-[26px] font-black">但し書き</span>
              <textarea
                className="mt-3 min-h-[90px] w-full rounded border border-slate-300 px-4 py-3 text-[22px] font-bold leading-8"
                value={receiptNote}
                onChange={(event) => setReceiptNote(event.target.value)}
                placeholder="例：工事代金として"
              />
            </label>
          </section>
        ) : null}

        <section className="rounded bg-white p-4 shadow-sm">
          <label className="block">
            <span className="text-[26px] font-black">日付</span>
            <input
              className="mt-3 h-[70px] w-full rounded border border-slate-300 px-4 text-[24px] font-black"
              type="date"
              value={estimateDate}
              onChange={(event) => setEstimateDate(event.target.value)}
              aria-label="日付"
            />
          </label>
        </section>

        <section className="rounded bg-white p-4 shadow-sm">
          <h2 className="text-[26px] font-black">職種</h2>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {safeArray(state?.trades).map((trade) => (
              <button
                key={trade.id}
                className={`min-h-[70px] rounded border px-4 text-left text-[22px] font-black ${
                  selectedTradeId === trade.id ? "border-moss bg-moss text-white" : "border-slate-300 bg-white text-sumi"
                }`}
                onClick={() => {
                  setSelectedTradeId(trade.id);
                  setLineDraft(emptyLineDraft);
                }}
                type="button"
              >
                {trade.name}
              </button>
            ))}
          </div>
        </section>

        <section className="rounded bg-white p-4 shadow-sm">
          <h2 className="text-[26px] font-black">工事項目</h2>
          <div className="mt-4 grid gap-3">
            {safeArray(workItemsForTrade).map((line, index) => (
              <button
                key={`${line.workItemId}-${line.name}-${line.unitPrice}-${index}`}
                className={`flex min-h-[70px] items-center justify-between rounded border border-moss px-4 text-left text-[22px] font-black ${
                  lineDraft.templateId === line.workItemId ? "bg-moss text-white" : "bg-white text-moss"
                }`}
                onClick={() => selectWorkItem(line)}
                type="button"
              >
                <span>{line.name}</span>
                {lineDraft.templateId === line.workItemId ? <Check size={30} /> : null}
              </button>
            ))}
          </div>
        </section>

        <section className="rounded bg-white p-4 shadow-sm">
          <h2 className="text-[26px] font-black">明細</h2>
          <label className="mt-4 block">
            <span className="text-[20px] font-black text-slate-700">名称</span>
            <input
              className="mt-2 h-[70px] w-full rounded border border-slate-300 px-4 text-[24px] font-black"
              value={lineDraft.name}
              onChange={(event) => setLineDraft((current) => ({ ...current, name: event.target.value }))}
              placeholder="クロス張替 2階"
            />
          </label>

          <div className="mt-4 grid grid-cols-[1fr_112px] gap-3">
            <label className="block">
              <span className="text-[20px] font-black text-slate-700">数量</span>
              <input
                className="mt-2 h-[70px] w-full rounded border border-slate-300 px-4 text-center text-[30px] font-black"
                inputMode="decimal"
                value={lineDraft.quantity}
                onChange={(event) => setLineDraft((current) => ({ ...current, quantity: event.target.value }))}
              />
            </label>
            <label className="block">
              <span className="text-[20px] font-black text-slate-700">単位</span>
              <select
                className="mt-2 h-[70px] w-full rounded border border-slate-300 bg-white px-2 text-[22px] font-black"
                value={lineDraft.unit}
                onChange={(event) => setLineDraft((current) => ({ ...current, unit: event.target.value as UnitCode }))}
              >
                {Object.entries(unitLabels).map(([code, label]) => (
                  <option key={code} value={code}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3">
            <button className="flex h-[76px] items-center justify-center gap-2 rounded border border-slate-300 bg-white text-[26px] font-black" onClick={() => changeDraftQuantity(-1)} type="button">
              <Minus size={34} /> 1
            </button>
            <button className="flex h-[76px] items-center justify-center gap-2 rounded bg-moss text-[26px] font-black text-white" onClick={() => changeDraftQuantity(1)} type="button">
              <Plus size={34} /> 1
            </button>
          </div>

          <label className="mt-4 block">
            <span className="text-[20px] font-black text-slate-700">単価</span>
            <input
              className="mt-2 h-[70px] w-full rounded border border-slate-300 px-4 text-[26px] font-black"
              inputMode="numeric"
              value={lineDraft.unitPrice}
              onChange={(event) => setLineDraft((current) => ({ ...current, unitPrice: event.target.value }))}
              placeholder="単価を入力"
            />
          </label>

          <div className="mt-4 rounded bg-slate-50 p-4">
            <p className="text-[20px] font-bold text-slate-500">金額</p>
            <p className="text-right text-[36px] font-black text-moss">{yen(draftTotal)}</p>
          </div>

          <button className="mt-4 flex h-[76px] w-full items-center justify-center rounded bg-amber-500 text-[28px] font-black text-white" onClick={addLine} type="button">
            決定
          </button>
        </section>

        {lines.length > 0 && (
          <section className="space-y-3">
            {safeArray(lines).map((line, index) => (
              <div key={line.id} className="rounded bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[28px] font-black">{index + 1}</p>
                  <button className="grid h-[70px] w-[70px] place-items-center rounded bg-red-50 text-red-600" onClick={() => setLines((current) => current.filter((item) => item.id !== line.id))} type="button" aria-label="削除">
                    <Trash2 size={32} />
                  </button>
                </div>
                <p className="mt-2 text-[22px] font-black">{line.name}</p>
                <p className="mt-1 text-[20px] font-bold text-slate-600">
                  {line.quantity}
                  {unitLabels[line.unit]} x {yen(line.unitPrice)}
                </p>
                <p className="mt-2 text-right text-[28px] font-black text-moss">{yen(line.lineTotal)}</p>
              </div>
            ))}
          </section>
        )}

        <section className="rounded bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <span className="text-[24px] font-black">小計</span>
            <span className="text-[30px] font-black text-sumi">{yen(totals.subtotal)}</span>
          </div>

          <div className="mt-4 flex items-center justify-between gap-4 border-t border-slate-200 pt-4">
            <span className="text-[24px] font-black">消費税</span>
            <span className="text-[30px] font-black text-sumi">{yen(totals.tax)}</span>
          </div>

          <div className="mt-4 flex items-center justify-between gap-4 border-t border-slate-200 pt-4">
            <span className="text-[24px] font-black">税込合計</span>
            <span className="text-[30px] font-black text-sumi">{yen(totals.taxIncluded)}</span>
          </div>

          <div className="mt-4 border-t border-slate-200 pt-4">
            <p className="text-[24px] font-black">値引き</p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <button
                className={`h-[70px] rounded border text-[24px] font-black ${
                  discountType === "amount" ? "border-moss bg-moss text-white" : "border-slate-300 bg-white text-sumi"
                }`}
                onClick={() => setDiscountType("amount")}
                type="button"
              >
                円
              </button>
              <button
                className={`h-[70px] rounded border text-[24px] font-black ${
                  discountType === "percent" ? "border-moss bg-moss text-white" : "border-slate-300 bg-white text-sumi"
                }`}
                onClick={() => setDiscountType("percent")}
                type="button"
              >
                %
              </button>
            </div>
            <input
              className="mt-3 h-[70px] w-full rounded border border-slate-300 px-4 text-right text-[28px] font-black"
              inputMode="decimal"
              value={discountValue}
              onChange={(event) => setDiscountValue(event.target.value)}
              placeholder="値引額を入力"
            />
            <p className="mt-2 text-right text-[24px] font-black text-red-600">-{yen(totals.discount)}</p>
          </div>

          <div className="mt-4 flex items-center justify-between gap-4 border-t border-slate-200 pt-4">
            <span className="text-[24px] font-black">最終合計</span>
            <span className="text-[34px] font-black text-moss">{yen(totals.total)}</span>
          </div>
        </section>

        {message && <p className="text-center text-[20px] font-black text-moss">{message}</p>}
      </section>

      <footer className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white px-4 py-3">
        <div className="mx-auto grid max-w-md grid-cols-[1fr_160px] items-center gap-3">
          <div>
            <p className="text-[20px] font-bold text-slate-500">合計</p>
            <p className="text-[34px] font-black text-moss">{yen(totals.total)}</p>
          </div>
          <button className="flex h-[76px] items-center justify-center gap-2 rounded bg-moss text-[22px] font-black text-white" onClick={() => void openPdfIssueModal()} type="button">
            <FileDown size={30} /> PDF
          </button>
        </div>
      </footer>

      {pendingIssue ? (
        <PdfIssueModal
          documentType={pendingIssue.documentType}
          initialFields={pendingIssue.fields}
          onClose={() => setPendingIssue(null)}
          onIssue={(fields) => void createPdf(fields)}
        />
      ) : null}
    </main>
  );
}
