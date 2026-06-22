import { NextResponse } from "next/server";

type CheckoutInput = {
  plan: "personal" | "business";
  userId: string;
  companyId: string;
};

export async function POST(request: Request) {
  const body = (await request.json()) as Partial<CheckoutInput>;
  if ((body.plan !== "personal" && body.plan !== "business") || !body.userId || !body.companyId) {
    return NextResponse.json({ error: "Invalid checkout request." }, { status: 400 });
  }
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "STRIPE_SECRET_KEY is not configured." }, { status: 400 });
  }
  const price = body.plan === "personal" ? process.env.STRIPE_PRICE_PERSONAL : process.env.STRIPE_PRICE_BUSINESS;

  if (!price) {
    return NextResponse.json({ error: "Stripe price is not configured." }, { status: 400 });
  }

  const params = new URLSearchParams({
    mode: "subscription",
    "line_items[0][price]": price,
    "line_items[0][quantity]": "1",
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?checkout=success`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?checkout=cancel`,
    "metadata[plan]": body.plan,
    "metadata[user_id]": body.userId,
    "metadata[company_id]": body.companyId
  });

  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: params
  });

  const session = (await response.json()) as { url?: string; error?: { message?: string } };
  if (!response.ok || !session.url) {
    return NextResponse.json({ error: session.error?.message ?? "Stripe checkout failed." }, { status: 400 });
  }

  return NextResponse.json({ url: session.url });
}
