import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type BranchRecord = {
  code?: string;
  name?: string;
  kana?: string;
  hira?: string;
};

async function fetchJson(url: string) {
  const response = await fetch(url, { next: { revalidate: 60 * 60 * 24 } });
  if (!response.ok) throw new Error(`branch data fetch failed: ${response.status}`);
  return response.json() as Promise<unknown>;
}

function normalizeRecords(data: unknown) {
  const records = Array.isArray(data) ? data : data && typeof data === "object" ? Object.values(data) : [];
  return records
    .map((record) => {
      const item = record as BranchRecord;
      return {
        code: String(item.code ?? ""),
        name: String(item.name ?? ""),
        kana: String(item.kana ?? ""),
        hira: String(item.hira ?? "")
      };
    })
    .filter((item) => item.code && item.name);
}

export async function GET(_request: Request, { params }: { params: { code: string } }) {
  const bankCode = params.code;
  const urls = [
    `https://zengin-code.github.io/api/branches/${bankCode}.json`,
    `https://bank.teraren.com/banks/${bankCode}/branches.json`
  ];

  for (const url of urls) {
    try {
      const branches = normalizeRecords(await fetchJson(url));
      if (branches.length > 0) return NextResponse.json({ branches });
    } catch (error) {
      console.error("[BankApi] branches_fetch_failed", url, error);
    }
  }

  return NextResponse.json({ branches: [], error: "branches_fetch_failed" }, { status: 200 });
}
