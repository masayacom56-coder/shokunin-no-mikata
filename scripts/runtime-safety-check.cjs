const assert = require("node:assert/strict");

const unitLabels = {
  sqm: "㎡",
  m: "m",
  piece: "個",
  machine: "台",
  place: "箇所",
  set: "式",
  labor: "人工"
};

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function safeNumber(value, fallback = 0) {
  const numberValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

function calcLine(quantity, unitPrice) {
  return Math.max(0, safeNumber(quantity)) * Math.max(0, safeNumber(unitPrice));
}

function calcTotals(lines, discountType, discountValue) {
  const safeLines = safeArray(lines);
  const subtotal = safeLines.reduce((sum, line) => sum + safeNumber(line && line.lineTotal), 0);
  const tax = Math.floor(subtotal * 0.1);
  const taxIncluded = subtotal + tax;
  const discount = discountType === "percent" ? Math.floor(taxIncluded * (Math.max(0, safeNumber(discountValue)) / 100)) : Math.max(0, safeNumber(discountValue));
  const total = Math.max(0, taxIncluded - discount);
  return { subtotal, discount, taxable: subtotal, tax, taxIncluded, total };
}

function normalizeLine(line) {
  const quantity = Math.max(0, safeNumber(line && line.quantity));
  const unitPrice = Math.max(0, safeNumber(line && line.unitPrice));
  const unit = line && unitLabels[line.unit] ? line.unit : "sqm";
  return {
    id: (line && line.id) || "test-line",
    tradeId: (line && line.tradeId) || "direct",
    workItemId: (line && line.workItemId) || "manual",
    name: (line && line.name) || "",
    unit,
    quantity,
    unitPrice,
    materialCost: Math.max(0, safeNumber(line && line.materialCost)),
    laborCost: Math.max(0, safeNumber(line && line.laborCost, unitPrice)),
    lineTotal: calcLine(quantity, unitPrice)
  };
}

function normalizeEstimate(input) {
  const lines = safeArray(input && input.lines).map(normalizeLine).filter((line) => line.name.trim() && line.quantity > 0);
  return {
    company: { name: "", postalCode: "", address: "", phone: "", email: "", bankAccount: "", invoiceNumber: "", sealName: "", ...((input && input.company) || {}) },
    customer: { name: "", companyName: "", postalCode: "", address: "", ...((input && input.customer) || {}) },
    lines,
    discountType: input && input.discountType === "percent" ? "percent" : "amount",
    discountValue: Math.max(0, safeNumber(input && input.discountValue)),
    totals: calcTotals(lines, input && input.discountType, input && input.discountValue)
  };
}

const scenarios = [
  { name: "工事項目0件", lines: [] },
  { name: "工事項目1件", lines: [{ name: "クロス貼替", quantity: 1, unitPrice: 1200 }] },
  { name: "工事項目10件", lines: Array.from({ length: 10 }, (_, index) => ({ name: `項目${index + 1}`, quantity: index + 1, unitPrice: 1000 })) },
  { name: "値引きあり", discountValue: 1000, lines: [{ name: "クロス貼替", quantity: 10, unitPrice: 1200 }] },
  { name: "値引きなし", discountValue: 0, lines: [{ name: "クロス貼替", quantity: 10, unitPrice: 1200 }] },
  { name: "会社情報未入力", company: null, lines: [{ name: "クロス貼替", quantity: 10, unitPrice: 1200 }] },
  { name: "顧客情報未入力", customer: null, lines: [{ name: "クロス貼替", quantity: 10, unitPrice: 1200 }] },
  { name: "角印未入力", company: { sealName: "" }, lines: [{ name: "クロス貼替", quantity: 10, unitPrice: 1200 }] },
  { name: "振込先未入力", company: { bankAccount: "" }, lines: [{ name: "クロス貼替", quantity: 10, unitPrice: 1200 }] }
];

for (const scenario of scenarios) {
  const estimate = normalizeEstimate(scenario);
  assert.ok(Array.isArray(estimate.lines), scenario.name);
  assert.equal(typeof estimate.totals.subtotal, "number", scenario.name);
  assert.equal(typeof estimate.totals.tax, "number", scenario.name);
  assert.equal(typeof estimate.totals.discount, "number", scenario.name);
  assert.equal(typeof estimate.totals.total, "number", scenario.name);
}

console.log("runtime safety check passed");
