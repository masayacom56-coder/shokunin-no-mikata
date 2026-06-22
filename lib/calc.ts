import type { DiscountType, EstimateLine, EstimateTotals } from "./types";

function safeArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

function safeNumber(value: unknown, fallback = 0) {
  const numberValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

export function yen(value: number) {
  return new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY" }).format(Math.round(value));
}

export function calcLine(quantity: number, unitPrice: number) {
  return Math.max(0, safeNumber(quantity)) * Math.max(0, safeNumber(unitPrice));
}

export function calcTotals(lines: EstimateLine[], discountType: DiscountType, discountValue: number): EstimateTotals {
  const safeLines = safeArray(lines);
  const subtotal = safeLines.reduce((sum, line) => sum + safeNumber(line?.lineTotal), 0);
  const tax = Math.floor(subtotal * 0.1);
  const taxIncluded = subtotal + tax;
  const discount =
    discountType === "percent" ? Math.floor(taxIncluded * (Math.max(0, safeNumber(discountValue)) / 100)) : Math.max(0, safeNumber(discountValue));
  const total = Math.max(0, taxIncluded - discount);
  return { subtotal, discount, taxable: subtotal, tax, taxIncluded, total };
}

export function estimateNumber() {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replaceAll("-", "");
  return `MKT-${date}-${String(now.getTime()).slice(-5)}`;
}
