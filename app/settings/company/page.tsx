"use client";

import { Save, Upload } from "lucide-react";
import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { BackButton } from "@/components/back-button";
import { emptyCompany, loadState, upsertCompany } from "@/lib/app-store";
import { recordAppError } from "@/lib/admin-metrics";
import { financialInstitutionSearchTexts, formalBranchName, formalFinancialInstitutionName } from "@/lib/financial-institutions";
import { normalizeCompany } from "@/lib/safety";
import type { Company } from "@/lib/types";

type BankOption = {
  code: string;
  name: string;
  kana?: string;
  hira?: string;
};

type BankApiRecord = {
  code?: string;
  name?: string;
  kana?: string;
  hira?: string;
};

const majorBankCodeOrder = ["0005", "0001", "0009", "0010", "0033", "0036", "0038", "9900"];

function normalizeBankRecords(data: unknown, type: "bank" | "branch" = "bank"): BankOption[] {
  const records = Array.isArray(data) ? data : data && typeof data === "object" ? Object.values(data) : [];
  return records
    .map((record) => {
      const item = record as BankApiRecord;
      const code = String(item.code ?? "");
      const rawName = String(item.name ?? "");
      const name = type === "branch" ? formalBranchName(rawName) : formalFinancialInstitutionName(rawName);
      const kana = String(item.kana ?? "");
      const hira = String(item.hira ?? "");
      return { code, name, kana, hira };
    })
    .filter((item) => item.code && item.name);
}

function searchText(value: string) {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/銀行$/u, "")
    .replace(/\s+/g, "");
}

function majorBankRank(option: BankOption) {
  const rank = majorBankCodeOrder.indexOf(option.code);
  return rank === -1 ? Number.MAX_SAFE_INTEGER : rank;
}

function isCreditBank(option: BankOption) {
  const name = option.name.normalize("NFKC");
  const code = Number(option.code);
  return name.includes("信金") || name.includes("信用金庫") || (code >= 1000 && code < 2000);
}

function sortBanks(options: BankOption[]) {
  return [...options].sort((left, right) => {
    const leftMajor = majorBankRank(left);
    const rightMajor = majorBankRank(right);
    if (leftMajor !== rightMajor) return leftMajor - rightMajor;
    const leftCredit = isCreditBank(left) ? 1 : 0;
    const rightCredit = isCreditBank(right) ? 1 : 0;
    if (leftCredit !== rightCredit) return leftCredit - rightCredit;
    return (left.kana || left.hira || left.name).localeCompare(right.kana || right.hira || right.name, "ja");
  });
}

async function fetchJson(url: string) {
  const response = await fetch(url, { cache: "force-cache" });
  if (!response.ok) throw new Error(`bank data fetch failed: ${response.status}`);
  return response.json() as Promise<unknown>;
}

async function fetchBanks() {
  try {
    const data = (await fetchJson("/api/banks")) as { banks?: unknown };
    return sortBanks(normalizeBankRecords(data.banks ?? []));
  } catch (error) {
    console.error("[CompanySettings] bank_fetch_failed", error);
    return [];
  }
}

async function fetchBranches(bankCode: string) {
  try {
    const data = (await fetchJson(`/api/banks/${bankCode}/branches`)) as { branches?: unknown };
    return normalizeBankRecords(data.branches ?? [], "branch");
  } catch (error) {
    console.error("[CompanySettings] branch_fetch_failed", error);
    return [];
  }
}

function matchesKeyword(option: BankOption, keyword: string) {
  const query = keyword.trim();
  if (!query) return true;
  const normalizedQuery = searchText(query);
  return (
    financialInstitutionSearchTexts(option.name).some((value) => searchText(value).includes(normalizedQuery)) ||
    searchText(option.kana ?? "").includes(normalizedQuery) ||
    searchText(option.hira ?? "").includes(normalizedQuery) ||
    option.code.includes(normalizedQuery)
  );
}

function sameBankName(option: BankOption, bankName: string) {
  const query = searchText(bankName);
  if (!query) return false;
  return searchText(option.name) === query || `${searchText(option.name)}銀行` === query || searchText(option.name).includes(query) || query.includes(searchText(option.name));
}

export default function CompanySettingsPage() {
  const [company, setCompany] = useState<Company>(emptyCompany);
  const [message, setMessage] = useState("");
  const [banks, setBanks] = useState<BankOption[]>([]);
  const [branches, setBranches] = useState<BankOption[]>([]);
  const [bankOpen, setBankOpen] = useState(false);
  const [branchOpen, setBranchOpen] = useState(false);
  const [bankLoading, setBankLoading] = useState(false);
  const [branchLoading, setBranchLoading] = useState(false);

  useEffect(() => {
    setCompany(normalizeCompany(loadState().company));
  }, []);

  useEffect(() => {
    let ignore = false;
    setBankLoading(true);
    fetchBanks()
      .then((items) => {
        if (!ignore) setBanks(items);
      })
      .finally(() => {
        if (!ignore) setBankLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    const bank = banks.find((item) => sameBankName(item, company.bankName ?? ""));
    if (!bank) {
      setBranches([]);
      return;
    }
    let ignore = false;
    setBranchLoading(true);
    fetchBranches(bank.code)
      .then((items) => {
        if (!ignore) setBranches(items);
      })
      .finally(() => {
        if (!ignore) setBranchLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [banks, company.bankName]);

  function setField(key: keyof Company, value: string) {
    setCompany((current) => ({ ...current, [key]: value }));
  }

  function setBankName(value: string) {
    setCompany((current) => ({
      ...current,
      bankName: value,
      bankBranchName: current.bankName === value ? current.bankBranchName : ""
    }));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      upsertCompany(normalizeCompany(company));
      setMessage("保存しました");
    } catch (error) {
      console.error("[CompanySettings] save_failed", error);
      recordAppError("会社情報保存失敗", "/settings/company", error);
      setMessage("保存に失敗しました");
    }
  }

  function loadLogo(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setMessage("jpg、jpeg、png、webpを選択してください");
      return;
    }
    try {
      const reader = new FileReader();
      reader.onload = () => {
        const nextCompany = normalizeCompany({ ...company, logoUrl: String(reader.result) });
        setCompany(nextCompany);
        setMessage("ロゴを選択しました。保存してください");
      };
      reader.onerror = () => {
        console.error("[CompanySettings] logo_read_failed", reader.error);
        setMessage("ロゴの読み込みに失敗しました");
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error("[CompanySettings] logo_read_exception", error);
      setMessage("ロゴの読み込みに失敗しました");
    }
  }

  return (
    <main className="min-h-dvh bg-paper pb-8">
      <BackButton />
      <section className="mx-auto max-w-md px-4 py-5">
        <header className="flex items-center gap-3">
          <h1 className="text-2xl font-black">会社情報</h1>
        </header>
        <form className="mt-5 space-y-3" onSubmit={submit}>
          {company.logoUrl ? <img src={company.logoUrl} alt="会社ロゴ" className="max-h-24 rounded bg-white p-3 shadow-sm" /> : null}
          <label className="flex min-h-16 w-full cursor-pointer items-center justify-center gap-2 rounded border border-dashed border-slate-300 bg-white p-3 font-bold text-moss">
            <Upload size={20} />
            {company.logoUrl ? "ロゴ変更" : "ロゴを登録"}
            <input className="hidden" type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" onChange={loadLogo} />
          </label>
          <Field label="会社名" value={company.name} onChange={(value) => setField("name", value)} />
          <Field label="郵便番号" value={company.postalCode} onChange={(value) => setField("postalCode", value)} />
          <Field label="住所" value={company.address} onChange={(value) => setField("address", value)} />
          <Field label="電話番号" value={company.phone} onChange={(value) => setField("phone", value)} />
          <Field label="メール" value={company.email} onChange={(value) => setField("email", value)} />
          <section className="rounded bg-white p-3 shadow-sm">
            <p className="text-xs font-bold text-slate-500">振込先</p>
            <div className="mt-2 space-y-3">
              <SearchableBankField
                label="銀行名"
                loading={bankLoading}
                open={bankOpen}
                options={banks}
                value={company.bankName ?? ""}
                onBlur={() => window.setTimeout(() => setBankOpen(false), 120)}
                onChange={(value) => {
                  setBankName(value);
                  setBankOpen(value.trim().length > 0);
                }}
                onFocus={() => setBankOpen(true)}
                onSelect={(option) => {
                  setBankName(option.name);
                  setBankOpen(false);
                }}
              />
              <SearchableBankField
                label="支店名"
                loading={branchLoading}
                open={branchOpen}
                options={branches}
                value={company.bankBranchName ?? ""}
                onBlur={() => window.setTimeout(() => setBranchOpen(false), 120)}
                disabled={!company.bankName?.trim()}
                onChange={(value) => {
                  setField("bankBranchName", value);
                  setBranchOpen(value.trim().length > 0);
                }}
                onFocus={() => setBranchOpen(true)}
                onSelect={(option) => {
                  setField("bankBranchName", option.name);
                  setBranchOpen(false);
                }}
              />
              <label className="block">
                <span className="text-xs font-bold text-slate-500">口座種別</span>
                <select className="mt-1 h-11 w-full rounded border border-slate-300 bg-white px-3 outline-none" value={company.bankAccountType ?? "普通"} onChange={(event) => setField("bankAccountType", event.target.value)}>
                  <option value="普通">普通</option>
                  <option value="当座">当座</option>
                </select>
              </label>
              <AccountNumberField value={company.bankAccountNumber ?? ""} onChange={(value) => setField("bankAccountNumber", value)} />
              <Field label="口座名義" value={company.bankAccountHolder ?? ""} onChange={(value) => setField("bankAccountHolder", value)} />
            </div>
          </section>
          <Field label="インボイス番号" value={company.invoiceNumber} onChange={(value) => setField("invoiceNumber", value)} />
          <Field label="角印名" value={company.sealName ?? ""} onChange={(value) => setField("sealName", value)} />
          {message ? <p className="text-sm font-bold text-moss">{message}</p> : null}
          <button className="flex h-14 w-full items-center justify-center gap-2 rounded bg-moss font-black text-white">
            <Save size={20} />
            保存
          </button>
        </form>
      </section>
    </main>
  );
}

function AccountNumberField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <label className="block rounded bg-white p-3 shadow-sm">
      <span className="text-xs font-bold text-slate-500">口座番号</span>
      <input className="mt-1 h-11 w-full outline-none" inputMode="numeric" pattern="[0-9]*" value={value} onChange={(event) => onChange(event.target.value.replace(/\D/g, ""))} />
    </label>
  );
}

function SearchableBankField({
  label,
  loading,
  open,
  options,
  value,
  disabled = false,
  onBlur,
  onChange,
  onFocus,
  onSelect
}: {
  label: string;
  loading: boolean;
  open: boolean;
  options: BankOption[];
  value: string;
  disabled?: boolean;
  onBlur: () => void;
  onChange: (value: string) => void;
  onFocus: () => void;
  onSelect: (option: BankOption) => void;
}) {
  const [focused, setFocused] = useState(false);
  const hasKeyword = value.trim().length > 0;
  const filteredOptions = hasKeyword ? options.filter((option) => matchesKeyword(option, value)) : options;
  const showOptions = (open || focused) && !disabled;
  return (
    <label className="relative block">
      <span className="text-xs font-bold text-slate-500">{label}</span>
      <div className="relative mt-1">
        <input
          className="h-12 w-full rounded border border-slate-300 bg-white px-3 pr-12 font-bold outline-none disabled:bg-slate-100 disabled:text-slate-400"
          disabled={disabled}
          value={value}
          onBlur={() => {
            window.setTimeout(() => setFocused(false), 120);
            onBlur();
          }}
          onChange={(event) => onChange(event.target.value)}
          onClick={() => {
            setFocused(true);
            onFocus();
          }}
          onFocus={() => {
            setFocused(true);
            onFocus();
          }}
          placeholder={`${label}を選択または入力`}
        />
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xl font-black text-moss">⌄</span>
      </div>
      {showOptions ? (
        <div className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded border border-slate-300 bg-white shadow-lg">
          {loading ? <p className="p-3 text-sm font-bold text-slate-500">候補を読み込み中</p> : null}
          {!loading && filteredOptions.length === 0 ? <p className="p-3 text-sm font-bold text-slate-500">候補なし。直接入力できます。</p> : null}
          {!loading
            ? filteredOptions.map((option) => (
                <button
                  key={`${option.code}-${option.name}`}
                  className="block min-h-12 w-full border-b border-slate-100 px-3 py-2 text-left font-bold text-sumi"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    setFocused(false);
                    onSelect(option);
                  }}
                  type="button"
                >
                  {option.name}
                </button>
              ))
            : null}
        </div>
      ) : null}
    </label>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block rounded bg-white p-3 shadow-sm">
      <span className="text-xs font-bold text-slate-500">{label}</span>
      <input className="mt-1 h-11 w-full outline-none" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}
