"use client";

import { calcTotals, estimateNumber } from "./calc";
import { trades, workItems } from "./master-data";
import { createId, emptyCompany, normalizeCustomer, normalizeEstimate, normalizeLine, normalizeProject, normalizeState, safeArray } from "./safety";
import type { AppState, Company, Customer, Estimate, EstimateDraft, Project, ProjectStatus, Trade, WorkItem } from "./types";

const STORAGE_KEY = "shokunin-no-mikata-state-v2";
const COMPANY_LOGO_KEY = "companyLogo";
const MAX_LOCAL_STORAGE_BYTES = 5 * 1024 * 1024;

export { emptyCompany } from "./safety";

export function createInitialState(): AppState {
  return {
    company: emptyCompany,
    customers: [],
    projects: [],
    estimates: [],
    trades,
    workItems,
    lastUnitPrices: {},
    plan: "free"
  };
}

export function loadState(): AppState {
  if (typeof window === "undefined") return createInitialState();
  let raw: string | null = null;
  let storedLogo: string | undefined;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
    storedLogo = window.localStorage.getItem(COMPANY_LOGO_KEY) ?? undefined;
  } catch (error) {
    console.error("[AppState] loadState:storage_access_failed", error);
    return normalizeState(createInitialState());
  }
  if (!raw) {
    const initial = createInitialState();
    return { ...initial, company: { ...initial.company, logoUrl: storedLogo } };
  }
  try {
    const parsed = JSON.parse(raw) as Partial<AppState>;
    const normalized = normalizeState(parsed);
    const customTrades = safeArray(normalized.trades).filter((trade) => trade.id.startsWith("custom-"));
    return normalizeState({
      ...normalized,
      company: { ...normalized.company, logoUrl: storedLogo ?? normalized.company.logoUrl },
      trades: mergeById(customTrades, trades),
      workItems: mergeWorkItems(normalized.workItems, workItems)
    });
  } catch (error) {
    console.error("[AppState] loadState:failed", error);
    return normalizeState(createInitialState());
  }
}

function mergeById<T extends Trade | WorkItem>(saved: T[], defaults: T[]) {
  const safeSaved = safeArray(saved);
  const safeDefaults = safeArray(defaults);
  const ids = new Set(safeSaved.map((item) => item.id));
  return [...safeSaved, ...safeDefaults.filter((item) => !ids.has(item.id))];
}

function mergeWorkItems(saved: WorkItem[], defaults: WorkItem[]) {
  const safeSaved = safeArray(saved);
  const safeDefaults = safeArray(defaults);
  const savedById = new Map(safeSaved.map((item) => [item.id, item]));
  const mergedDefaults = safeDefaults.map((item) => ({ ...item, ...savedById.get(item.id) }));
  const customItems = safeSaved.filter((item) => item.id.startsWith("custom-") && !safeDefaults.some((defaultItem) => defaultItem.id === item.id));
  return [...customItems, ...mergedDefaults];
}

function safeStringify(value: unknown) {
  try {
    return JSON.stringify(value);
  } catch (error) {
    console.error("[AppState] stringify_failed", error);
    return "{}";
  }
}

function byteSize(value: string) {
  try {
    return new Blob([value]).size;
  } catch {
    return value.length;
  }
}

function compactStateForStorage(state: AppState) {
  let next = normalizeState(state);
  const estimateLimits = [100, 50, 25, 10, 0];
  for (const limit of estimateLimits) {
    const candidate = normalizeState({ ...next, estimates: safeArray(next.estimates).slice(0, limit) });
    const serialized = safeStringify(candidate);
    if (byteSize(serialized) <= MAX_LOCAL_STORAGE_BYTES) return candidate;
    next = candidate;
  }
  return normalizeState({ ...next, estimates: [], projects: [] });
}

export function saveState(state: AppState) {
  if (typeof window === "undefined") return false;
  const compacted = compactStateForStorage(state);
  try {
    window.localStorage.setItem(STORAGE_KEY, safeStringify(compacted));
    return true;
  } catch (error) {
    console.error("[AppState] saveState:failed", error);
    try {
      const smaller = compactStateForStorage({ ...compacted, estimates: safeArray(compacted.estimates).slice(0, 10) });
      window.localStorage.setItem(STORAGE_KEY, safeStringify(smaller));
      return true;
    } catch (retryError) {
      console.error("[AppState] saveState:retry_failed", retryError);
      return false;
    }
  }
}

export function upsertCompany(company: Company) {
  const state = loadState();
  const next = { ...state, company };
  try {
    if (company.logoUrl) {
      window.localStorage.setItem(COMPANY_LOGO_KEY, company.logoUrl);
    } else {
      window.localStorage.removeItem(COMPANY_LOGO_KEY);
    }
  } catch (error) {
    console.error("[AppState] upsertCompany:logo_storage_failed", error);
  }
  saveState(next);
  return next;
}

export function createCustomer(input: Omit<Customer, "id">) {
  const state = loadState();
  const customer: Customer = normalizeCustomer({ ...input, id: createId() });
  const next = { ...state, customers: [customer, ...safeArray(state.customers)] };
  const saved = saveState(next);
  if (!saved) {
    throw new Error("localStorage保存に失敗しました");
  }
  return customer;
}

export function findOrCreateCustomerByName(name: string) {
  const state = loadState();
  const normalizedName = name.trim();
  const fallbackName = normalizedName || "御見積先";
  const existing = safeArray(state.customers).find((customer) => {
    const safeCustomer = normalizeCustomer(customer);
    const customerName = safeCustomer.name.trim();
    const companyName = safeCustomer.companyName?.trim();
    return customerName === fallbackName || companyName === fallbackName;
  });

  if (existing) return existing;

  const customer: Customer = {
    id: createId(),
    type: "individual",
    name: fallbackName,
    phone: "",
    email: "",
    postalCode: "",
    address: "",
    memo: ""
  };
  const next = { ...state, customers: [normalizeCustomer(customer), ...safeArray(state.customers)] };
  saveState(next);
  return customer;
}

export function updateCustomer(customer: Customer) {
  const state = loadState();
  const safeCustomers = safeArray(state.customers);
  const normalizedCustomer = normalizeCustomer(customer);
  const next = { ...state, customers: safeCustomers.map((item) => (item.id === normalizedCustomer.id ? normalizedCustomer : normalizeCustomer(item))) };
  saveState(next);
  return customer;
}

export function deleteCustomer(customerId: string) {
  const state = loadState();
  const next = { ...state, customers: safeArray(state.customers).filter((customer) => customer.id !== customerId) };
  saveState(next);
  return next;
}

export function createProject(input: { customerId: string; title: string; status: ProjectStatus; memo?: string }) {
  const state = loadState();
  const project = normalizeProject({ ...input, id: createId(), photoComments: [] });
  const next = { ...state, projects: [project, ...safeArray(state.projects)] };
  saveState(next);
  return project;
}

export function updateProject(project: Project) {
  const state = loadState();
  const normalizedProject = normalizeProject(project);
  const next = { ...state, projects: safeArray(state.projects).map((item) => (item.id === normalizedProject.id ? normalizedProject : normalizeProject(item))) };
  saveState(next);
  return project;
}

export function updateWorkItemPrice(workItemId: string, standardPrice: number) {
  const state = loadState();
  const nextPrice = Math.max(0, Number.isFinite(standardPrice) ? standardPrice : 0);
  const next = {
    ...state,
    workItems: safeArray(state.workItems).map((item) =>
      item.id === workItemId ? { ...item, standardPrice: nextPrice, laborCost: nextPrice } : item
    )
  };
  saveState(next);
  return next;
}

export function rememberWorkItemPrice(workItemId: string, unitPrice: number) {
  const state = loadState();
  if (!Number.isFinite(unitPrice) || unitPrice <= 0) return state;
  const nextPrice = unitPrice;
  const next = {
    ...state,
    lastUnitPrices: {
      ...state.lastUnitPrices,
      [workItemId]: nextPrice
    }
  };
  saveState(next);
  return next;
}

type EstimateInput = Omit<EstimateDraft, "id" | "estimateNo" | "createdAt"> & { createdAt?: string };

export function createEstimate(draft: EstimateInput) {
  const state = loadState();
  const estimate: Estimate = {
    ...draft,
    id: createId(),
    estimateNo: estimateNumber(),
    createdAt: draft.createdAt ?? new Date().toISOString(),
    lines: safeArray(draft.lines).map((line) => normalizeLine(line)),
    customer: normalizeCustomer(draft.customer),
    project: normalizeProject(draft.project),
    company: { ...emptyCompany, ...draft.company },
    totals: calcTotals(draft.lines, draft.discountType, draft.discountValue)
  };
  const normalizedEstimate = normalizeEstimate(estimate);
  const next = { ...state, estimates: [normalizedEstimate, ...safeArray(state.estimates)] };
  saveState(next);
  return normalizedEstimate;
}

export function deleteEstimate(estimateId: string) {
  const state = loadState();
  const next = { ...state, estimates: safeArray(state.estimates).filter((estimate) => estimate.id !== estimateId) };
  saveState(next);
  return next;
}

export function duplicateEstimate(estimateId: string) {
  const state = loadState();
  const original = safeArray(state.estimates).find((estimate) => estimate.id === estimateId);
  if (!original) return null;
  const estimate: Estimate = {
    ...normalizeEstimate(original),
    id: createId(),
    estimateNo: estimateNumber(),
    createdAt: new Date().toISOString(),
    lines: safeArray(original.lines).map((line) => ({ ...normalizeLine(line), id: createId() })),
    totals: calcTotals(original.lines, original.discountType, original.discountValue)
  };
  const next = { ...state, estimates: [normalizeEstimate(estimate), ...safeArray(state.estimates)] };
  saveState(next);
  return estimate;
}

export function getUsage(state: AppState) {
  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  return {
    monthlyEstimates: safeArray(state.estimates).filter((estimate) => estimate.createdAt.startsWith(ym)).length,
    customers: safeArray(state.customers).length,
    projects: safeArray(state.projects).length
  };
}
