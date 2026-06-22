import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase";

type CustomerInput = {
  companyId: string;
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

export async function GET(request: Request) {
  const companyId = new URL(request.url).searchParams.get("companyId");
  if (!companyId) return NextResponse.json({ error: "companyId is required" }, { status: 400 });
  const supabase = createServerSupabase();
  const { data, error } = await supabase.from("customers").select("*").eq("company_id", companyId).order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ customers: data });
}

export async function POST(request: Request) {
  const input = (await request.json()) as Partial<CustomerInput>;
  if (!input.companyId || !input.name || (input.type !== "individual" && input.type !== "corporate")) {
    return NextResponse.json({ error: "Invalid customer request." }, { status: 400 });
  }
  const supabase = createServerSupabase();

  const { data, error } = await supabase
    .from("customers")
    .insert({
      company_id: input.companyId,
      type: input.type,
      name: input.name,
      company_name: input.companyName ?? null,
      contact_name: input.contactName ?? null,
      phone: input.phone ?? null,
      email: input.email ?? null,
      postal_code: input.postalCode ?? null,
      address: input.address ?? null,
      memo: input.memo ?? null,
      created_by: null
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ customer: data });
}
