import { NextResponse } from "next/server";
import { safeArray, safeNumber } from "@/lib/safety";
import { createServerSupabase } from "@/lib/supabase";

type EstimateApiLine = {
  tradeId?: string;
  workItemId?: string;
  name: string;
  unit: "sqm" | "m" | "piece" | "machine" | "place" | "set" | "labor";
  quantity: number;
  unitPrice: number;
  materialCost: number;
  laborCost: number;
  lineTotal: number;
};

type EstimateInput = {
  companyId: string;
  projectId: string;
  customerId: string;
  estimateNo: string;
  discountType: "amount" | "percent";
  discountValue: number;
  note?: string;
  lines: EstimateApiLine[];
};

export async function POST(request: Request) {
  const input = (await request.json()) as Partial<EstimateInput>;
  if (
    !input.companyId ||
    !input.projectId ||
    !input.customerId ||
    !input.estimateNo ||
    (input.discountType !== "amount" && input.discountType !== "percent") ||
    typeof input.discountValue !== "number" ||
    !Array.isArray(input.lines) ||
    input.lines.length === 0
  ) {
    return NextResponse.json({ error: "Invalid estimate request." }, { status: 400 });
  }
  const supabase = createServerSupabase();

  const safeLines = safeArray(input.lines);
  const subtotal = safeLines.reduce((sum, line) => sum + safeNumber(line?.lineTotal), 0);
  const taxAmount = Math.floor(subtotal * 0.1);
  const taxIncluded = subtotal + taxAmount;
  const discountAmount =
    input.discountType === "percent" ? Math.floor(taxIncluded * (input.discountValue / 100)) : input.discountValue;

  const { data: estimate, error } = await supabase
    .from("estimates")
    .insert({
      company_id: input.companyId,
      project_id: input.projectId,
      customer_id: input.customerId,
      estimate_no: input.estimateNo,
      subtotal,
      discount_type: input.discountType,
      discount_value: input.discountValue,
      discount_amount: discountAmount,
      tax_amount: taxAmount,
      total_amount: Math.max(0, taxIncluded - discountAmount),
      note: input.note,
      created_by: null
    })
    .select("id")
    .single();

  if (error || !estimate) {
    return NextResponse.json({ error: error?.message ?? "Estimate creation failed." }, { status: 400 });
  }

  const { error: itemError } = await supabase.from("estimate_items").insert(
    safeLines.map((line, index) => ({
      estimate_id: estimate.id,
      trade_id: line.tradeId ?? null,
      work_item_id: line.workItemId ?? null,
      name: line.name,
      unit: line.unit,
      quantity: safeNumber(line.quantity),
      unit_price: safeNumber(line.unitPrice),
      material_cost: safeNumber(line.materialCost),
      labor_cost: safeNumber(line.laborCost),
      line_total: safeNumber(line.lineTotal),
      sort_order: index + 1
    }))
  );

  if (itemError) {
    return NextResponse.json({ error: itemError.message }, { status: 400 });
  }

  return NextResponse.json({ id: estimate.id });
}
