import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type BankRecord = {
  code?: string;
  name?: string;
  kana?: string;
  hira?: string;
};

async function fetchJson(url: string) {
  const response = await fetch(url, { next: { revalidate: 60 * 60 * 24 } });
  if (!response.ok) throw new Error(`bank data fetch failed: ${response.status}`);
  return response.json() as Promise<unknown>;
}

function normalizeRecords(data: unknown) {
  const records = Array.isArray(data) ? data : data && typeof data === "object" ? Object.values(data) : [];
  return records
    .map((record) => {
      const item = record as BankRecord;
      return {
        code: String(item.code ?? ""),
        name: String(item.name ?? ""),
        kana: String(item.kana ?? ""),
        hira: String(item.hira ?? "")
      };
    })
    .filter((item) => item.code && item.name);
}

export async function GET() {
  try {
    const banks = normalizeRecords(await fetchJson("https://zengin-code.github.io/api/banks.json"));
    return NextResponse.json({ banks });
  } catch (error) {
    console.error("[BankApi] banks_fetch_failed", error);
    return NextResponse.json({ banks: [], error: "banks_fetch_failed" }, { status: 200 });
  }
}
