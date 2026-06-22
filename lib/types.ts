export type PlanCode = "free" | "personal" | "business";
export type ProjectStatus = "estimating" | "submitted" | "won" | "lost";
export type UnitCode = "sqm" | "m" | "piece" | "machine" | "place" | "set" | "labor";
export type DiscountType = "amount" | "percent";
export type DocumentType = "estimate" | "invoice" | "receipt";

export type Company = {
  id: string;
  name: string;
  postalCode: string;
  address: string;
  phone: string;
  email: string;
  bankAccount: string;
  bankName?: string;
  bankBranchName?: string;
  bankAccountType?: "普通" | "当座";
  bankAccountNumber?: string;
  bankAccountHolder?: string;
  invoiceNumber: string;
  logoUrl?: string;
  sealName?: string;
};

export type Customer = {
  id: string;
  type: "individual" | "corporate";
  name: string;
  companyName?: string;
  contactName?: string;
  phone?: string;
  email?: string;
  postalCode?: string;
  address?: string;
  memo?: string;
};

export type Project = {
  id: string;
  customerId: string;
  title: string;
  status: ProjectStatus;
  memo?: string;
  photoComments: ProjectPhoto[];
};

export type ProjectPhoto = {
  id: string;
  projectId: string;
  dataUrl: string;
  comment: string;
  createdAt: string;
};

export type Trade = {
  id: string;
  name: string;
};

export type WorkItem = {
  id: string;
  tradeId: string;
  name: string;
  unit: UnitCode;
  standardPrice: number;
  materialCost: number;
  laborCost: number;
};

export type EstimateLine = {
  id: string;
  tradeId: string;
  workItemId: string;
  name: string;
  unit: UnitCode;
  quantity: number;
  unitPrice: number;
  materialCost: number;
  laborCost: number;
  lineTotal: number;
};

export type EstimateDraft = {
  id: string;
  estimateNo: string;
  createdAt: string;
  customer: Customer;
  project: Project;
  company: Company;
  lines: EstimateLine[];
  discountType: DiscountType;
  discountValue: number;
  note: string;
  plan: PlanCode;
  documentType?: DocumentType;
  receiptNote?: string;
};

export type Estimate = EstimateDraft & {
  totals: EstimateTotals;
};

export type AppState = {
  company: Company;
  customers: Customer[];
  projects: Project[];
  estimates: Estimate[];
  trades: Trade[];
  workItems: WorkItem[];
  lastUnitPrices: Record<string, number>;
  plan: PlanCode;
};

export type EstimateTotals = {
  subtotal: number;
  discount: number;
  taxable: number;
  tax: number;
  taxIncluded: number;
  total: number;
};

export type PdfIssueFields = {
  recipientName: string;
  issueDate: string;
  documentNumber: string;
  validUntil: string;
  paymentDue: string;
  receiptNote: string;
};
