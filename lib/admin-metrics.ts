"use client";

import { loadState } from "./app-store";
import { normalizeEstimate, safeArray } from "./safety";
import type { AppState, DocumentType } from "./types";

const ADMIN_EVENTS_KEY = "shokunin-no-mikata-admin-events-v1";
const ADMIN_FLAG_KEY = "shokunin-no-mikata-admin";

type AdminEventType = "pdf_output" | "pdf_failure" | "app_error" | "operation";

type AdminEvent = {
  id: string;
  type: AdminEventType;
  detail: string;
  page: string;
  companyId?: string;
  documentType?: DocumentType;
  createdAt: string;
};

export type AdminMetrics = {
  companyCount: number;
  activeCompanyCount: number;
  estimateCount: number;
  invoiceCount: number;
  receiptCount: number;
  pdfOutputCount: number;
  pdfSuccessCount: number;
  pdfFailureCount: number;
  errorCount: number;
};

export type AdminErrorLog = {
  createdAt: string;
  errorType: string;
  page: string;
  message: string;
};

export type AdminOperationLog = {
  createdAt: string;
  companyId: string;
  action: string;
};

function createEventId() {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch {
    // フォールバックで記録を継続します。
  }
  return `${Date.now()}-${Math.random()}`;
}

function readEvents(): AdminEvent[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(ADMIN_EVENTS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return safeArray(parsed).filter((event): event is AdminEvent => {
      const item = event as Partial<AdminEvent>;
      return item.type === "pdf_output" || item.type === "pdf_failure" || item.type === "app_error" || item.type === "operation";
    });
  } catch (error) {
    console.error("[AdminMetrics] read_events_failed", error);
    return [];
  }
}

function writeEvents(events: AdminEvent[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ADMIN_EVENTS_KEY, JSON.stringify(safeArray(events).slice(-1000)));
  } catch (error) {
    console.error("[AdminMetrics] write_events_failed", error);
  }
}

function recordEvent(event: Omit<AdminEvent, "id" | "createdAt">) {
  const next: AdminEvent = {
    ...event,
    id: createEventId(),
    createdAt: new Date().toISOString()
  };
  writeEvents([...readEvents(), next]);
}

export function recordPdfOutput(documentType: DocumentType, page: string) {
  const companyId = currentCompanyId();
  recordEvent({
    type: "pdf_output",
    detail: `${documentType} pdf output`,
    page,
    companyId,
    documentType
  });
  recordOperation("PDF出力", page, companyId);
}

export function recordPdfFailure(documentType: DocumentType, page: string, error?: unknown) {
  const reason = error instanceof Error ? error.message : typeof error === "string" ? error : "PDF generation failed";
  recordEvent({
    type: "pdf_failure",
    detail: reason,
    page,
    companyId: currentCompanyId(),
    documentType
  });
}

export function recordAppError(errorType: string, page: string, error?: unknown) {
  const reason = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  recordEvent({
    type: "app_error",
    detail: reason ? `${errorType}: ${reason}` : errorType,
    page,
    companyId: currentCompanyId()
  });
}

export function recordOperation(action: string, page: string, companyId = currentCompanyId()) {
  recordEvent({
    type: "operation",
    detail: action,
    page,
    companyId
  });
}

export function enableAdminMode() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ADMIN_FLAG_KEY, "1");
  } catch (error) {
    console.error("[AdminMetrics] enable_admin_failed", error);
  }
}

export function isAdminModeEnabled() {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(ADMIN_FLAG_KEY) === "1";
  } catch {
    return false;
  }
}

function hasRegisteredCompany(state: AppState) {
  const company = state.company;
  return Boolean(
    company.name.trim() ||
      company.postalCode.trim() ||
      company.address.trim() ||
      company.phone.trim() ||
      company.email.trim() ||
      company.invoiceNumber.trim()
  );
}

function isWithinLast30Days(value: string) {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return false;
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  return timestamp >= thirtyDaysAgo;
}

function currentCompanyId() {
  try {
    return loadState().company.id || "local-company";
  } catch {
    return "local-company";
  }
}

function eventMessage(event: AdminEvent) {
  if (event.type !== "app_error") return event.detail;
  const parts = event.detail.split(":");
  return parts.length > 1 ? parts.slice(1).join(":").trim() : event.detail;
}

function eventErrorType(event: AdminEvent) {
  if (event.type === "pdf_failure") return "PDF生成失敗";
  if (event.type !== "app_error") return event.type;
  return event.detail.split(":")[0] || "アプリエラー";
}

function recentEvents(events: AdminEvent[], type: AdminEventType, limit: number) {
  return safeArray(events)
    .filter((event) => event.type === type)
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .slice(0, limit);
}

export function buildAdminMetrics(state: AppState = loadState()): AdminMetrics {
  const estimates = safeArray(state.estimates).map((estimate) => normalizeEstimate(estimate));
  const events = readEvents();
  const companyCount = hasRegisteredCompany(state) ? 1 : 0;
  const hasRecentEstimate = estimates.some((estimate) => isWithinLast30Days(estimate.createdAt));
  const hasRecentEvent = events.some((event) => isWithinLast30Days(event.createdAt));

  return {
    companyCount,
    activeCompanyCount: companyCount && (hasRecentEstimate || hasRecentEvent) ? 1 : 0,
    estimateCount: estimates.filter((estimate) => (estimate.documentType ?? "estimate") === "estimate").length,
    invoiceCount: estimates.filter((estimate) => estimate.documentType === "invoice").length,
    receiptCount: estimates.filter((estimate) => estimate.documentType === "receipt").length,
    pdfOutputCount: events.filter((event) => event.type === "pdf_output").length,
    pdfSuccessCount: events.filter((event) => event.type === "pdf_output").length,
    pdfFailureCount: events.filter((event) => event.type === "pdf_failure").length,
    errorCount: events.filter((event) => event.type === "app_error" || event.type === "pdf_failure").length
  };
}

export function getRecentErrorLogs(limit = 20): AdminErrorLog[] {
  const events = readEvents().filter((event) => event.type === "app_error" || event.type === "pdf_failure");
  return events
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .slice(0, limit)
    .map((event) => ({
      createdAt: event.createdAt,
      errorType: eventErrorType(event),
      page: event.page,
      message: eventMessage(event)
    }));
}

export function getRecentOperationLogs(limit = 50): AdminOperationLog[] {
  return recentEvents(readEvents(), "operation", limit).map((event) => ({
    createdAt: event.createdAt,
    companyId: event.companyId || "local-company",
    action: event.detail
  }));
}

function csvEscape(value: string | number) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function adminMetricsCsv(metrics: AdminMetrics, errorLogs: AdminErrorLog[] = getRecentErrorLogs(), operationLogs: AdminOperationLog[] = getRecentOperationLogs()) {
  const headers = ["会社数", "見積件数", "請求書件数", "領収書件数", "PDF出力件数", "PDF成功数", "PDF失敗数", "エラー件数"];
  const values = [
    metrics.companyCount,
    metrics.estimateCount,
    metrics.invoiceCount,
    metrics.receiptCount,
    metrics.pdfOutputCount,
    metrics.pdfSuccessCount,
    metrics.pdfFailureCount,
    metrics.errorCount
  ];
  const errorRows = errorLogs.map((log) => [log.createdAt, log.errorType, log.page, log.message].map(csvEscape).join(","));
  const operationRows = operationLogs.map((log) => [log.createdAt, log.companyId, log.action].map(csvEscape).join(","));
  return [
    headers.join(","),
    values.join(","),
    "",
    "直近エラー20件",
    ["発生日時", "エラー種別", "発生画面", "エラーメッセージ"].join(","),
    ...errorRows,
    "",
    "直近操作50件",
    ["発生日時", "会社ID", "操作内容"].join(","),
    ...operationRows,
    ""
  ].join("\n");
}

export function downloadAdminMetricsCsv(metrics: AdminMetrics, errorLogs?: AdminErrorLog[], operationLogs?: AdminOperationLog[]) {
  if (typeof window === "undefined") return;
  const blob = new Blob([adminMetricsCsv(metrics, errorLogs, operationLogs)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `admin-metrics-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
