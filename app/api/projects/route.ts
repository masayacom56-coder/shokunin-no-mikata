import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase";

type ProjectInput = {
  companyId: string;
  customerId: string;
  title: string;
  status: "estimating" | "submitted" | "won" | "lost";
  memo?: string;
};

export async function GET(request: Request) {
  const companyId = new URL(request.url).searchParams.get("companyId");
  if (!companyId) return NextResponse.json({ error: "companyId is required" }, { status: 400 });
  const supabase = createServerSupabase();
  const { data, error } = await supabase.from("projects").select("*").eq("company_id", companyId).order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ projects: data });
}

export async function POST(request: Request) {
  const input = (await request.json()) as Partial<ProjectInput>;
  if (!input.companyId || !input.customerId || !input.title || !input.status) {
    return NextResponse.json({ error: "Invalid project request." }, { status: 400 });
  }
  const supabase = createServerSupabase();

  const { data, error } = await supabase
    .from("projects")
    .insert({
      company_id: input.companyId,
      customer_id: input.customerId,
      title: input.title,
      status: input.status,
      memo: input.memo ?? null,
      created_by: null
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ project: data });
}
