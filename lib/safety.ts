import { calcLine, calcTotals } from "./calc";
import { formalBranchName, formalFinancialInstitutionName } from "./financial-institutions";
import { trades, workItems } from "./master-data";
import type { AppState, Company, Customer, DiscountType, Estimate, EstimateDraft, EstimateLine, PlanCode, Project, ProjectStatus, UnitCode } from "./types";

export function createId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random()}`;
}

export function safeArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

export function safeNumber(value: unknown, fallback = 0) {
  const numberValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

export function safeText(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

export const emptyCompany: Company = {
  id: "00000000-0000-0000-0000-000000000001",
  name: "",
  postalCode: "",
  address: "",
  phone: "",
  email: "",
  bankAccount: "",
  bankName: "",
  bankBranchName: "",
  bankAccountType: "普通",
  bankAccountNumber: "",
  bankAccountHolder: "",
  invoiceNumber: "",
  sealName: ""
};

export const emptyCustomer: Customer = {
  id: "direct-customer",
  type: "individual",
  name: "",
  companyName: "",
  contactName: "",
  phone: "",
  email: "",
  postalCode: "",
  address: "",
  memo: ""
};

export const emptyProject: Project = {
  id: "direct-project",
  customerId: "",
  title: "",
  status: "estimating",
  memo: "",
  photoComments: []
};

export function normalizeCompany(company?: Partial<Company> | null): Company {
  return {
    ...emptyCompany,
    ...company,
    id: safeText(company?.id, emptyCompany.id),
    name: safeText(company?.name),
    postalCode: safeText(company?.postalCode),
    address: safeText(company?.address),
    phone: safeText(company?.phone),
    email: safeText(company?.email),
    bankAccount: safeText(company?.bankAccount),
    bankName: formalFinancialInstitutionName(safeText(company?.bankName)),
    bankBranchName: formalBranchName(safeText(company?.bankBranchName)),
    bankAccountType: company?.bankAccountType === "当座" ? "当座" : "普通",
    bankAccountNumber: safeText(company?.bankAccountNumber),
    bankAccountHolder: safeText(company?.bankAccountHolder),
    invoiceNumber: safeText(company?.invoiceNumber),
    logoUrl: safeText(company?.logoUrl, undefined as unknown as string) || undefined,
    sealName: safeText(company?.sealName)
  };
}

export function normalizeCustomer(customer?: Partial<Customer> | null): Customer {
  const type = customer?.type === "corporate" ? "corporate" : "individual";
  return {
    ...emptyCustomer,
    ...customer,
    id: safeText(customer?.id, emptyCustomer.id),
    type,
    name: safeText(customer?.name),
    companyName: safeText(customer?.companyName),
    contactName: safeText(customer?.contactName),
    phone: safeText(customer?.phone),
    email: safeText(customer?.email),
    postalCode: safeText(customer?.postalCode),
    address: safeText(customer?.address),
    memo: safeText(customer?.memo)
  };
}

export function normalizeProject(project?: Partial<Project> | null): Project {
  const status: ProjectStatus = ["estimating", "submitted", "won", "lost"].includes(project?.status ?? "")
    ? (project?.status as ProjectStatus)
    : "estimating";
  return {
    ...emptyProject,
    ...project,
    id: safeText(project?.id, emptyProject.id),
    customerId: safeText(project?.customerId),
    title: safeText(project?.title),
    status,
    memo: safeText(project?.memo),
    photoComments: safeArray(project?.photoComments)
  };
}

export function normalizeLine(line?: Partial<EstimateLine> | null): EstimateLine {
  const quantity = Math.max(0, safeNumber(line?.quantity));
  const unitPrice = Math.max(0, safeNumber(line?.unitPrice));
  const unit: UnitCode = ["sqm", "m", "piece", "machine", "place", "set", "labor"].includes(line?.unit ?? "")
    ? (line?.unit as UnitCode)
    : "sqm";
  return {
    id: safeText(line?.id, createId()),
    tradeId: safeText(line?.tradeId, "direct"),
    workItemId: safeText(line?.workItemId, "manual"),
    name: safeText(line?.name),
    unit,
    quantity,
    unitPrice,
    materialCost: Math.max(0, safeNumber(line?.materialCost)),
    laborCost: Math.max(0, safeNumber(line?.laborCost, unitPrice)),
    lineTotal: calcLine(quantity, unitPrice)
  };
}

export function normalizeLines(lines?: EstimateLine[] | null) {
  return safeArray(lines).map((line) => normalizeLine(line)).filter((line) => line.name.trim());
}

export function normalizeDiscountType(value?: DiscountType | null): DiscountType {
  return value === "percent" ? "percent" : "amount";
}

export function normalizePlan(value?: PlanCode | null): PlanCode {
  if (value === "personal" || value === "business") return value;
  return "free";
}

export function normalizeEstimateDraft(draft?: Partial<EstimateDraft> | null): EstimateDraft {
  const lines = normalizeLines(draft?.lines);
  return {
    id: safeText(draft?.id, createId()),
    estimateNo: safeText(draft?.estimateNo, "MKT-DRAFT"),
    createdAt: safeText(draft?.createdAt, new Date().toISOString()),
    customer: normalizeCustomer(draft?.customer),
    project: normalizeProject(draft?.project),
    company: normalizeCompany(draft?.company),
    lines,
    discountType: normalizeDiscountType(draft?.discountType),
    discountValue: Math.max(0, safeNumber(draft?.discountValue)),
    note: safeText(draft?.note),
    plan: normalizePlan(draft?.plan),
    documentType: draft?.documentType,
    receiptNote: safeText(draft?.receiptNote)
  };
}

export function normalizeEstimate(estimate?: Partial<Estimate> | null): Estimate {
  const draft = normalizeEstimateDraft(estimate);
  return {
    ...draft,
    totals: calcTotals(draft.lines, draft.discountType, draft.discountValue)
  };
}

export function normalizeState(state?: Partial<AppState> | null): AppState {
  return {
    company: normalizeCompany(state?.company),
    customers: safeArray(state?.customers).map((customer) => normalizeCustomer(customer)),
    projects: safeArray(state?.projects).map((project) => normalizeProject(project)),
    estimates: safeArray(state?.estimates).map((estimate) => normalizeEstimate(estimate)),
    trades: safeArray(state?.trades).length > 0 ? safeArray(state?.trades) : trades,
    workItems: safeArray(state?.workItems).length > 0 ? safeArray(state?.workItems) : workItems,
    lastUnitPrices: state?.lastUnitPrices && typeof state.lastUnitPrices === "object" ? state.lastUnitPrices : {},
    plan: normalizePlan(state?.plan)
  };
}

export function validateEstimate(draft: EstimateDraft) {
  const safeDraft = normalizeEstimateDraft(draft);
  const customerName = (safeDraft.customer.companyName || safeDraft.customer.name).trim();
  const companyName = safeDraft.company.name.trim();
  const validLines = safeArray(safeDraft.lines).filter((line) => line.name.trim() && safeNumber(line.quantity) > 0 && safeNumber(line.unitPrice) > 0);
  if (!customerName) {
    return { ok: false, message: "顧客名を入力してください", estimate: safeDraft };
  }
  if (!companyName) {
    return { ok: false, message: "会社情報を入力してください", estimate: safeDraft };
  }
  if (validLines.length === 0) {
    return { ok: false, message: "工事項目・数量・単価を入力してください", estimate: safeDraft };
  }
  return { ok: true, message: "", estimate: { ...safeDraft, lines: validLines } };
}
