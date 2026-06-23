export type CustomerRouteParams = {
  id?: string | string[] | null;
};

export function safeRouteCustomerId(params: CustomerRouteParams | null | undefined) {
  const rawId = params?.id;
  const value = Array.isArray(rawId) ? rawId[0] : rawId;
  return decodeRouteCustomerId(value);
}

export function hasCustomerId(value: string | null | undefined) {
  return typeof value === "string" && value.trim().length > 0;
}

export function encodeRouteCustomerId(value: string | null | undefined) {
  const rawValue = typeof value === "string" ? value.trim() : "";
  return encodeURIComponent(rawValue);
}

export function decodeRouteCustomerId(value: string | string[] | null | undefined) {
  const rawValue = Array.isArray(value) ? value[0] : value;
  if (typeof rawValue !== "string") return "";
  try {
    return decodeURIComponent(rawValue).trim();
  } catch {
    return rawValue.trim();
  }
}
