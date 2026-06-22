import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHmac, timingSafeEqual } from "crypto";

type StripeWebhookEvent = {
  type: string;
  data: {
    object: {
      id?: string;
      customer?: string | null;
      subscription?: string | null;
      status?: string;
      current_period_end?: number;
      metadata?: {
        company_id?: string;
        plan?: string;
      };
    };
  };
};

function verifyStripeSignature(rawBody: string, signature: string, secret: string) {
  const timestamp = signature
    .split(",")
    .find((part) => part.startsWith("t="))
    ?.slice(2);
  const expected = signature
    .split(",")
    .find((part) => part.startsWith("v1="))
    ?.slice(3);

  if (!timestamp || !expected) return false;

  const digest = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  const digestBuffer = Buffer.from(digest, "hex");

  return expectedBuffer.length === digestBuffer.length && timingSafeEqual(expectedBuffer, digestBuffer);
}

export async function POST(request: Request) {
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Stripe webhook is not configured." }, { status: 400 });
  }
  const signature = request.headers.get("stripe-signature");
  const rawBody = await request.text();

  if (!signature) {
    return NextResponse.json({ error: "Missing webhook signature." }, { status: 400 });
  }

  if (!verifyStripeSignature(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET)) {
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 400 });
  }

  let event: StripeWebhookEvent;
  try {
    event = JSON.parse(rawBody) as StripeWebhookEvent;
  } catch (error) {
    console.error("[StripeWebhook] json_parse_failed", error);
    return NextResponse.json({ error: "Invalid webhook body." }, { status: 400 });
  }
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", process.env.SUPABASE_SERVICE_ROLE_KEY ?? "");

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    await supabase.from("subscriptions").upsert({
      company_id: session.metadata?.company_id,
      plan_code: session.metadata?.plan,
      stripe_customer_id: String(session.customer ?? ""),
      stripe_subscription_id: String(session.subscription ?? ""),
      status: "active",
      current_period_end: null
    });
  }

  if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
    const subscription = event.data.object;
    await supabase
      .from("subscriptions")
      .update({
        status: subscription.status,
        current_period_end: subscription.current_period_end ? new Date(subscription.current_period_end * 1000).toISOString() : null
      })
      .eq("stripe_subscription_id", subscription.id);
  }

  return NextResponse.json({ received: true });
}
