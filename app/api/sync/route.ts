import { NextResponse } from "next/server";
import { safeArray } from "@/lib/safety";
import { createServerSupabase } from "@/lib/supabase";

type SyncEventInput = {
  id: string;
  type: "estimate" | "customer" | "project" | "photo";
  companyId: string;
  entityId?: string;
  payload: unknown;
  createdAt: string;
};

export async function POST(request: Request) {
  const body = (await request.json()) as { events?: SyncEventInput[] };
  if (!Array.isArray(body.events) || body.events.length > 50) {
    return NextResponse.json({ error: "Invalid sync request." }, { status: 400 });
  }
  const supabase = createServerSupabase();

  const safeEvents = safeArray(body.events);
  const rows = safeEvents.map((event) => ({
    company_id: event.companyId,
    user_id: null,
    client_event_id: event.id,
    entity_type: event.type,
    entity_id: event.entityId ?? null,
    payload: event.payload
  }));

  const { error } = await supabase.from("sync_events").upsert(rows, { onConflict: "company_id,client_event_id" });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ synced: safeEvents.map((event) => event.id) });
}
