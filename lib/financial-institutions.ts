export function formalFinancialInstitutionName(name: string) {
  const value = name.trim().replace(/ＵＦＪ/g, "UFJ").replace(/ＳＢＩ/g, "SBI");
  if (!value || value === "信金中央金庫") return value;
  const exactNames: Record<string, string> = {
    三菱UFJ: "三菱東京UFJ銀行",
    みずほ: "みずほ銀行",
    三井住友: "三井住友銀行",
    りそな: "りそな銀行",
    PayPay: "PayPay銀行",
    楽天: "楽天銀行",
    住信SBIネット: "住信SBIネット銀行",
    ゆうちょ: "ゆうちょ銀行",
    静岡: "静岡銀行",
    豊橋: "豊橋銀行"
  };
  if (exactNames[value]) return exactNames[value];
  const formalCreditBank = value.replace(/信金/g, "信用金庫");
  if (formalCreditBank.endsWith("信託")) return `${formalCreditBank}銀行`;
  if (/(銀行|信用金庫|金庫|農協|漁協|信組|信連|労金|信託銀行|信用組合|中央金庫)$/u.test(formalCreditBank)) {
    return formalCreditBank;
  }
  return `${formalCreditBank}銀行`;
}

export function financialInstitutionSearchTexts(name: string) {
  const formal = formalFinancialInstitutionName(name);
  const abbreviated = formal.replace(/信用金庫/g, "信金");
  const aliases: string[] = [];
  if (formal === "三菱東京UFJ銀行") aliases.push("三菱UFJ銀行", "三菱UFJ");
  return Array.from(new Set([formal, abbreviated, name, ...aliases].filter(Boolean)));
}

export function formalBranchName(name: string) {
  const value = name.trim();
  if (!value) return value;
  if (/(支店|出張所|営業部|本店)$/u.test(value)) return value;
  return `${value}支店`;
}
