"use client";

import { calcTotals, yen } from "./calc";
import { formalBranchName, formalFinancialInstitutionName } from "./financial-institutions";
import { unitLabels } from "./master-data";
import { normalizeEstimateDraft, safeArray, validateEstimate } from "./safety";
import type { DocumentType, EstimateDraft, PdfIssueFields } from "./types";

const PAGE_WIDTH_PT = 595;
const PAGE_HEIGHT_PT = 842;
const CANVAS_WIDTH = 1240;
const CANVAS_HEIGHT = 1754;

function textBytes(text: string) {
  return new TextEncoder().encode(text);
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

function concatBytes(parts: Uint8Array[] | null | undefined) {
  const safeParts = Array.isArray(parts) ? parts : [];
  const totalLength = safeParts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(totalLength);
  let offset = 0;
  for (const part of safeParts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

function base64ToBytes(base64: string) {
  if (typeof window === "undefined" || typeof window.atob !== "function") {
    throw new Error("base64ToBytes: window.atob is not available");
  }
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export function buildPdfFromJpeg(jpegBytes: Uint8Array, imageWidth: number, imageHeight: number) {
  const content = `q\n${PAGE_WIDTH_PT} 0 0 ${PAGE_HEIGHT_PT} 0 0 cm\n/Im0 Do\nQ\n`;
  const objects = [
    textBytes("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n"),
    textBytes("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n"),
    textBytes(
      `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH_PT} ${PAGE_HEIGHT_PT}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>\nendobj\n`
    ),
    concatBytes([
      textBytes(
        `4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${imageWidth} /Height ${imageHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`
      ),
      jpegBytes,
      textBytes("\nendstream\nendobj\n")
    ]),
    textBytes(`5 0 obj\n<< /Length ${content.length} >>\nstream\n${content}endstream\nendobj\n`)
  ];

  const header = textBytes("%PDF-1.4\n%\xFF\xFF\xFF\xFF\n");
  const offsets: number[] = [];
  let offset = header.length;
  for (const object of objects) {
    offsets.push(offset);
    offset += object.length;
  }

  const xrefStart = offset;
  const safeOffsets = Array.isArray(offsets) ? offsets : [];
  const xrefRows = safeOffsets.map((value) => `${String(value).padStart(10, "0")} 00000 n \n`).join("");
  const xref = textBytes(
    `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${xrefRows}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`
  );

  return concatBytes([header, ...objects, xref]);
}

function formatDate(value: string) {
  if (!value) return "";
  const dateOnly = value.slice(0, 10);
  return dateOnly.replaceAll("-", "/");
}

function drawText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth?: number) {
  ctx.fillText(text || "-", x, y, maxWidth);
}

function drawRight(ctx: CanvasRenderingContext2D, text: string, right: number, y: number) {
  ctx.fillText(text, right - ctx.measureText(text).width, y);
}

function drawCenter(ctx: CanvasRenderingContext2D, text: string, center: number, y: number) {
  ctx.fillText(text, center - ctx.measureText(text).width / 2, y);
}

function drawWrappedText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number, maxLines = 2) {
  const safeText = typeof text === "string" && text ? text : "-";
  const chars = Array.from(safeText);
  const lines: string[] = [];
  let current = "";

  for (const char of chars) {
    const next = current + char;
    if (ctx.measureText(next).width > maxWidth && current) {
      lines.push(current);
      current = char;
      if (lines.length === maxLines - 1) break;
    } else {
      current = next;
    }
  }
  lines.push(current);

  const visibleLines = Array.isArray(lines) ? lines.slice(0, maxLines) : [];
  visibleLines.forEach((line, index) => {
    const suffix = index === maxLines - 1 && chars.join("").length > visibleLines.join("").length ? "..." : "";
    drawText(ctx, `${line}${suffix}`, x, y + index * lineHeight, maxWidth);
  });
}

function drawSeal(ctx: CanvasRenderingContext2D, text: string, x: number, y: number) {
  const sealText = text.trim();
  if (!sealText) return;

  const size = 110;
  const padding = 14;
  const corporateTypes = [
    "一般社団法人",
    "一般財団法人",
    "社会福祉法人",
    "株式会社",
    "合同会社",
    "有限会社",
    "医療法人",
    "学校法人"
  ];
  const safeCorporateTypes = Array.isArray(corporateTypes) ? corporateTypes : [];
  const legalType =
    safeCorporateTypes.find((type) => sealText.startsWith(type)) ?? safeCorporateTypes.find((type) => sealText.endsWith(type)) ?? "";
  const companyText = legalType
    ? sealText.startsWith(legalType)
      ? sealText.slice(legalType.length).trim()
      : sealText.slice(0, -legalType.length).trim()
    : sealText;
  const companyChars = Array.from(companyText);
  const legalChars = Array.from(legalType);
  const usableWidth = size - padding * 2;
  const usableHeight = size - padding * 2;
  const rowGapRatio = 1.12;
  const columnGapRatio = 1.15;
  const maxCompanyColumns = Math.min(legalChars.length > 0 ? 3 : 4, Math.max(1, companyChars.length));
  const candidates = Array.from({ length: maxCompanyColumns }, (_, index) => index + 1).map((companyColumnCount) => {
    const companyRows = Math.ceil(companyChars.length / companyColumnCount);
    const totalColumns = companyColumnCount + (legalChars.length > 0 ? 1 : 0);
    const maxRows = Math.max(companyRows, legalChars.length);
    const fontSizeByHeight = Math.floor(usableHeight / (1 + rowGapRatio * Math.max(maxRows - 1, 0)));
    const fontSizeByWidth = Math.floor(usableWidth / (totalColumns + columnGapRatio * Math.max(totalColumns - 1, 0)));
    return {
      companyColumnCount,
      fontSize: Math.max(7, Math.min(20, fontSizeByHeight, fontSizeByWidth))
    };
  });
  const safeCandidates = Array.isArray(candidates) && candidates.length > 0 ? candidates : [{ companyColumnCount: 1, fontSize: 12 }];
  const best = safeCandidates.reduce((current, candidate) => {
    if (candidate.fontSize > current.fontSize) return candidate;
    if (candidate.fontSize === current.fontSize && candidate.companyColumnCount < current.companyColumnCount) return candidate;
    return current;
  }, candidates[0]);
  const companyRows = Math.ceil(companyChars.length / best.companyColumnCount);
  const companyColumns = Array.from({ length: best.companyColumnCount }, (_, columnIndex) => ({
    chars: companyChars.slice(columnIndex * companyRows, (columnIndex + 1) * companyRows)
  })).filter((column) => column.chars.length > 0);
  const columns = legalChars.length > 0 ? [...companyColumns, { chars: legalChars }] : companyColumns;
  const safeColumns = Array.isArray(columns) && columns.length > 0 ? columns : [{ chars: [sealText] }];
  const maxRows = Math.max(...safeColumns.map((column) => column.chars.length));
  const fontSize = best.fontSize;
  const rowGap = maxRows <= 1 ? 0 : fontSize * rowGapRatio;
  const columnGap = columns.length <= 1 ? 0 : fontSize * columnGapRatio;
  const groupWidth = fontSize * safeColumns.length + columnGap * Math.max(safeColumns.length - 1, 0);
  const groupHeight = fontSize + rowGap * Math.max(maxRows - 1, 0);
  const groupLeft = x + size / 2 - groupWidth / 2;
  const groupTop = y + size / 2 - groupHeight / 2;

  ctx.save();
  ctx.strokeStyle = "#b91c1c";
  ctx.fillStyle = "#b91c1c";
  ctx.lineWidth = 5;
  ctx.strokeRect(x, y, size, size);
  ctx.font = `900 ${fontSize}px serif`;
  safeColumns.forEach((column, columnIndex) => {
    const columnX = groupLeft + (safeColumns.length - 1 - columnIndex) * (fontSize + columnGap) + fontSize / 2;
    const columnHeight = fontSize + rowGap * Math.max(column.chars.length - 1, 0);
    const columnTop = groupTop + (groupHeight - columnHeight) / 2;
    column.chars.forEach((char, rowIndex) => {
      drawCenter(ctx, char, columnX, columnTop + rowIndex * rowGap);
    });
  });
  ctx.restore();
}

function documentLabel(type: DocumentType) {
  if (type === "invoice") return "請求書";
  if (type === "receipt") return "領収書";
  return "見積書";
}

function documentPrefix(type: DocumentType) {
  if (type === "invoice") return "請求番号";
  if (type === "receipt") return "領収番号";
  return "見積番号";
}

function documentFilename(type: DocumentType) {
  if (type === "invoice") return "invoice";
  if (type === "receipt") return "receipt";
  return "estimate";
}

function amountLabel(type: DocumentType) {
  if (type === "invoice") return "ご請求金額";
  if (type === "receipt") return "領収金額";
  return "お見積金額";
}

function dateLabel(type: DocumentType) {
  if (type === "invoice") return "請求日";
  if (type === "receipt") return "領収日";
  return "見積日";
}

function bankAccountLines(company: EstimateDraft["company"]) {
  const bankName = formalFinancialInstitutionName(company.bankName?.trim() ?? "");
  const branchName = formalBranchName(company.bankBranchName?.trim() ?? "");
  const accountType = company.bankAccountType ?? "普通";
  const accountNumber = company.bankAccountNumber?.trim() ?? "";
  const accountHolder = company.bankAccountHolder?.trim() ?? "";
  const legacy = company.bankAccount?.trim() ?? "";

  if (bankName || branchName || accountNumber || accountHolder) {
    return [
      "振込先",
      bankName || "-",
      branchName || "-",
      `${accountType} ${accountNumber || "-"}`,
      accountHolder || "-"
    ];
  }

  if (legacy) {
    return ["振込先", legacy];
  }

  return [];
}

function validatePdfInputDraft(draft: EstimateDraft | null | undefined) {
  if (!draft) return { ok: false, message: "Estimate missing" };
  if (!draft.id) return { ok: false, message: "Estimate id missing" };
  const source = draft as EstimateDraft & { lines?: unknown; customer?: unknown; company?: unknown };
  if (!Array.isArray(source.lines)) return { ok: false, message: "Estimate items missing" };
  if (source.lines.length === 0) return { ok: false, message: "Estimate items empty" };
  if (!source.customer) return { ok: false, message: "Customer missing" };
  if (!source.company) return { ok: false, message: "Company missing" };
  const safeDraft = normalizeEstimateDraft(draft);
  const customerName = (safeDraft.customer.companyName || safeDraft.customer.name).trim();
  const companyName = safeDraft.company.name.trim();
  if (!customerName) return { ok: false, message: "Customer missing" };
  if (!companyName) return { ok: false, message: "Company missing" };
  return { ok: true, message: "" };
}

function defaultIssueFields(draft: EstimateDraft, documentType: DocumentType): PdfIssueFields {
  const recipientName = draft.customer.companyName || draft.customer.name || "御見積先";
  const issueDate = formatDate(draft.createdAt) || formatDate(new Date().toISOString());
  return {
    recipientName,
    issueDate,
    documentNumber: draft.estimateNo || "MKT-DRAFT",
    validUntil: "発行日より14日",
    paymentDue: formatDate(addDays(draft.createdAt, 30)),
    receiptNote: draft.receiptNote?.trim() || "工事代金として"
  };
}

function addDays(dateText: string, days: number) {
  const date = new Date(dateText);
  if (Number.isNaN(date.getTime())) return "";
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    try {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.crossOrigin = "anonymous";
      image.src = src;
    } catch (error) {
      reject(error);
    }
  });
}

function isSafeCanvasImageSource(src: string) {
  if (!src) return false;
  if (src.startsWith("data:") || src.startsWith("blob:")) return true;
  if (typeof window === "undefined") return false;
  try {
    const url = new URL(src, window.location.href);
    return url.origin === window.location.origin;
  } catch {
    return false;
  }
}

function downloadPdf(bytes: Uint8Array, filename: string) {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  const blob = new Blob([buffer], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30000);
}

export async function generateEstimatePdf(draft: EstimateDraft, documentType: DocumentType = "estimate", issueFields?: Partial<PdfIssueFields>) {
  if (typeof document === "undefined") {
    console.error("PDF Generation Error", new Error("PDF generation is only available in the browser."));
    console.error("[PDF] generateEstimatePdf:no_document");
    throw new Error("PDF generation is only available in the browser.");
  }

  const inputValidation = validatePdfInputDraft(draft);
  console.info("[PDF] target_data", {
    documentType,
    estimateExists: Boolean(draft),
    estimateId: draft?.id ?? "",
    estimateNo: draft?.estimateNo ?? "",
    itemCount: Array.isArray(draft?.lines) ? draft.lines.length : 0,
    customerName: draft ? normalizeEstimateDraft(draft).customer.companyName || normalizeEstimateDraft(draft).customer.name : "",
    companyName: draft ? normalizeEstimateDraft(draft).company.name : ""
  });
  if (!inputValidation.ok) {
    console.error("PDF Generation Error", new Error(inputValidation.message));
    console.error("[PDF] generateEstimatePdf:input_invalid", inputValidation.message, draft);
    throw new Error(inputValidation.message);
  }

  console.info("[PDF] stage:validate_start");
  const validation = validateEstimate(draft);
  if (!validation.ok) {
    console.error("PDF Generation Error", new Error(validation.message));
    console.error("[PDF] generateEstimatePdf:invalid_estimate", validation.message, validation.estimate);
    throw new Error(validation.message);
  }
  const safeDraft = normalizeEstimateDraft(validation.estimate);
  const safeDocumentType = documentType ?? safeDraft.documentType ?? "estimate";
  const defaultIssue = defaultIssueFields(safeDraft, safeDocumentType);
  const issue: PdfIssueFields = {
    ...defaultIssue,
    ...issueFields,
    recipientName: typeof issueFields?.recipientName === "string" ? issueFields.recipientName : defaultIssue.recipientName,
    issueDate: typeof issueFields?.issueDate === "string" ? issueFields.issueDate : defaultIssue.issueDate,
    documentNumber: typeof issueFields?.documentNumber === "string" ? issueFields.documentNumber : defaultIssue.documentNumber,
    validUntil: typeof issueFields?.validUntil === "string" ? issueFields.validUntil : defaultIssue.validUntil,
    paymentDue: typeof issueFields?.paymentDue === "string" ? issueFields.paymentDue : defaultIssue.paymentDue,
    receiptNote: typeof issueFields?.receiptNote === "string" ? issueFields.receiptNote : defaultIssue.receiptNote
  };
  let localLogo = "";
  try {
    localLogo = typeof window !== "undefined" ? window.localStorage.getItem("companyLogo") ?? "" : "";
  } catch (error) {
    console.error("[PDF] local_logo_read_failed", errorMessage(error));
  }
  console.info("[PDF] generateEstimatePdf:prepare", {
    documentType: safeDocumentType,
    estimateNo: safeDraft.estimateNo,
    lineCount: safeDraft.lines.length,
    hasLogo: Boolean(safeDraft.company.logoUrl || localLogo),
    hasSeal: Boolean(safeDraft.company.sealName?.trim())
  });

  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    console.error("PDF Generation Error", new Error("Could not prepare PDF canvas."));
    console.error("[PDF] generateEstimatePdf:no_canvas_context");
    throw new Error("Could not prepare PDF canvas.");
  }

  console.info("[PDF] stage:calculate_totals");
  const totals = calcTotals(safeDraft.lines, safeDraft.discountType, safeDraft.discountValue);
  const customerName = issue.recipientName || "御見積先";
  const receiptNote = issue.receiptNote || "工事代金として";
  const constructionMemo = safeDraft.project.memo || safeDraft.note || "-";
  const title = documentLabel(safeDocumentType);
  const numberPrefix = documentPrefix(safeDocumentType);
  const documentDate = issue.issueDate || formatDate(safeDraft.createdAt);
  const paymentDue = issue.paymentDue || formatDate(addDays(safeDraft.createdAt, 30));

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  ctx.fillStyle = "#1f2933";
  ctx.textBaseline = "top";

  const logoUrl = safeDraft.company.logoUrl || localLogo || "";
  if (logoUrl) {
    if (!isSafeCanvasImageSource(logoUrl)) {
      console.error("[PDF] logo:skipped_unsafe_source", { reason: "logo URL may taint canvas", logoUrl });
    } else {
      try {
      console.info("[PDF] logo:load_start");
      const logo = await loadImage(logoUrl);
      const logoWidth = 180;
      const logoHeight = Math.min(120, (logo.height / logo.width) * logoWidth);
      ctx.drawImage(logo, 750, 92, logoWidth, logoHeight);
      console.info("[PDF] logo:draw_success");
      } catch (error) {
        console.error("[PDF] logo:draw_failed", errorMessage(error));
        // PDF生成自体を止めないため、ロゴ読み込み失敗時は非表示にします。
      }
    }
  }

  ctx.font = "700 28px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
  drawText(ctx, `${numberPrefix}: ${issue.documentNumber || safeDraft.estimateNo}`, 70, 58);
  drawRight(ctx, `${dateLabel(safeDocumentType)}: ${documentDate}`, 1170, 58);

  ctx.font = "800 24px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
  drawText(ctx, safeDraft.company.name || "-", 750, 220, 290);
  ctx.font = "600 22px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
  drawText(ctx, safeDraft.company.postalCode ? `〒${safeDraft.company.postalCode}` : "〒-", 750, 254, 290);
  drawWrappedText(ctx, safeDraft.company.address || "-", 750, 286, 290, 30, 2);
  drawText(ctx, `TEL: ${safeDraft.company.phone || "-"}`, 750, 352, 290);
  drawText(ctx, `MAIL: ${safeDraft.company.email || "-"}`, 750, 384, 290);
  drawText(ctx, `登録番号: ${safeDraft.company.invoiceNumber || "-"}`, 750, 416, 290);
  drawSeal(ctx, safeDraft.company.sealName ?? "", 1060, 220);

  ctx.font = "800 44px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
  drawText(ctx, `${customerName} 様`, 70, 150, 620);
  ctx.font = "600 26px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
  drawText(ctx, safeDraft.customer.postalCode ? `〒${safeDraft.customer.postalCode}` : "〒-", 70, 215, 620);
  drawWrappedText(ctx, safeDraft.customer.address || "-", 70, 253, 620, 34, 2);

  ctx.font = "700 64px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
  drawCenter(ctx, title, CANVAS_WIDTH / 2, 480);

  ctx.fillStyle = "#2f6b57";
  ctx.font = "900 36px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
  drawCenter(ctx, amountLabel(documentType), CANVAS_WIDTH / 2, 595);
  ctx.font = "900 78px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
  drawCenter(ctx, yen(totals.total), CANVAS_WIDTH / 2, 642);

  ctx.fillStyle = "#1f2933";
  ctx.font = "700 28px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
  if (safeDocumentType === "receipt") {
    drawCenter(ctx, "但し書き", CANVAS_WIDTH / 2, 735);
    ctx.font = "600 30px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
    drawCenter(ctx, receiptNote, CANVAS_WIDTH / 2, 775);
  } else if (safeDocumentType === "invoice") {
    drawCenter(ctx, `支払期限: ${paymentDue || "-"}`, CANVAS_WIDTH / 2, 735);
  } else {
    drawCenter(ctx, `有効期限: ${issue.validUntil || "発行日より14日"}`, CANVAS_WIDTH / 2, 735);
    if (constructionMemo !== "有効期限は発行日より14日です。") {
      ctx.font = "600 26px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
      drawWrappedText(ctx, constructionMemo, 345, 775, 550, 36, 2);
    }
  }

  ctx.fillStyle = "#2f6b57";
  ctx.fillRect(70, 850, 1100, 64);
  ctx.fillStyle = "#ffffff";
  ctx.font = "800 26px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
  drawText(ctx, "工事項目", 95, 868);
  drawText(ctx, "数量", 645, 868);
  drawText(ctx, "単価", 825, 868);
  drawText(ctx, "小計", 1030, 868);

  ctx.fillStyle = "#1f2933";
  ctx.font = "600 26px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
  let y = 945;
  for (const line of safeArray(safeDraft.lines).slice(0, 5)) {
    ctx.strokeStyle = "#d8dee5";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(70, y + 58);
    ctx.lineTo(1170, y + 58);
    ctx.stroke();

    drawWrappedText(ctx, line?.name ?? "-", 95, y, 500, 32, 2);
    drawRight(ctx, `${line?.quantity ?? 0}${unitLabels[line?.unit] ?? ""}`, 730, y + 8);
    drawRight(ctx, yen(line?.unitPrice ?? 0), 930, y + 8);
    drawRight(ctx, yen(line?.lineTotal ?? 0), 1145, y + 8);
    y += 76;
  }

  const totalsX = 650;
  const valueX = 1145;
  const totalsY = 1350;
  ctx.font = "800 30px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
  drawText(ctx, "小計", totalsX, totalsY);
  drawRight(ctx, yen(totals.subtotal), valueX, totalsY);
  drawText(ctx, "消費税", totalsX, totalsY + 56);
  drawRight(ctx, yen(totals.tax), valueX, totalsY + 56);
  drawText(ctx, "税込合計", totalsX, totalsY + 112);
  drawRight(ctx, yen(totals.taxIncluded), valueX, totalsY + 112);
  if (totals.discount > 0) {
    drawText(ctx, "値引き", totalsX, totalsY + 168);
    drawRight(ctx, `-${yen(totals.discount)}`, valueX, totalsY + 168);
  }

  ctx.strokeStyle = "#1f2933";
  ctx.lineWidth = 4;
  ctx.beginPath();
  const totalLineY = totals.discount > 0 ? totalsY + 220 : totalsY + 164;
  ctx.moveTo(totalsX, totalLineY);
  ctx.lineTo(valueX, totalLineY);
  ctx.stroke();

  ctx.font = "900 40px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
  drawText(ctx, "最終合計", totalsX, totalLineY + 23);
  drawRight(ctx, yen(totals.total), valueX, totalLineY + 23);

  if (safeDocumentType === "invoice" || safeDocumentType === "estimate") {
    const bankLines = bankAccountLines(safeDraft.company);
    ctx.font = "600 24px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.fillStyle = "#475569";
    bankLines.forEach((line, index) => {
      drawText(ctx, line, 70, 1565 + index * 26, 520);
    });
  }

  ctx.font = "600 22px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.fillStyle = "#64748b";
  drawCenter(ctx, "この書類は職人の味方で作成されました", CANVAS_WIDTH / 2, 1698);

  let jpegDataUrl = "";
  try {
    console.info("[PDF] canvas:toDataURL_start");
    jpegDataUrl = canvas.toDataURL("image/jpeg", 0.92);
    console.info("[PDF] canvas:toDataURL_success");
  } catch (error) {
    const reason = `canvas.toDataURL failed: ${errorMessage(error)}`;
    console.error("PDF Generation Error", reason);
    console.error("[PDF] canvas:toDataURL_failed", reason);
    throw new Error(reason);
  }
  const jpegBase64 = jpegDataUrl.split(",")[1];
  if (!jpegBase64) {
    console.error("PDF Generation Error", new Error("jpegBase64 is empty"));
    console.error("[PDF] canvas:missing_jpeg_base64");
    throw new Error("jpegBase64 is empty");
  }

  try {
    console.info("[PDF] bytes:build_start");
    const jpegBytes = base64ToBytes(jpegBase64);
    const pdfBytes = buildPdfFromJpeg(jpegBytes, CANVAS_WIDTH, CANVAS_HEIGHT);
    const safeEstimateNo = (issue.documentNumber || safeDraft.estimateNo).replace(/[^\w-]/g, "-");
    console.info("[PDF] download:start", { byteLength: pdfBytes.byteLength });
    downloadPdf(pdfBytes, `${documentFilename(safeDocumentType)}-${safeEstimateNo}.pdf`);
    console.info("[PDF] download:success");
  } catch (error) {
    const reason = `PDF bytes/download failed: ${errorMessage(error)}`;
    console.error("PDF Generation Error", reason);
    console.error("[PDF] bytes_or_download:failed", reason);
    throw new Error(reason);
  }
}
