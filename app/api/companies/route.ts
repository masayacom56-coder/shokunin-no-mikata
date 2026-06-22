import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase";

type CompanyInput = {
  name: string;
  logoPath?: string;
  postalCode?: string;
  address?: string;
  phone?: string;
  email?: string;
  bankAccount?: string;
  invoiceNumber?: string;
};

export async function GET() {
  const supabase = createServerSupabase();

  const { data, error } = await supabase
    .from("company_users")
    .select("company_id, role, companies(*)")
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ companies: data });
}

export async function POST(request: Request) {
  const input = (await request.json()) as Partial<CompanyInput>;
  if (!input.name) {
    return NextResponse.json({ error: "Invalid company request." }, { status: 400 });
  }
  const supabase = createServerSupabase();

  const { data: company, error } = await supabase
    .from("companies")
    .insert({
      owner_user_id: null,
      name: input.name,
      logo_path: input.logoPath ?? null,
      postal_code: input.postalCode ?? null,
      address: input.address ?? null,
      phone: input.phone ?? null,
      email: input.email ?? null,
      bank_account: input.bankAccount ?? null,
      invoice_number: input.invoiceNumber ?? null
    })
    .select("*")
    .single();

  if (error || !company) return NextResponse.json({ error: error?.message ?? "Company creation failed" }, { status: 400 });

  const { error: memberError } = await supabase.from("company_users").insert({
    company_id: company.id,
    user_id: null,
    role: "admin"
  });

  if (memberError) return NextResponse.json({ error: memberError.message }, { status: 400 });
  return NextResponse.json({ company });
}
