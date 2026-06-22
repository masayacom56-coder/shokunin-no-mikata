export type CustomerRouteParams = {
  id?: string | string[] | null;
};

export function safeRouteCustomerId(params: CustomerRouteParams | null | undefined) {
  const rawId = params?.id;
  const value = Array.isArray(rawId) ? rawId[0] : rawId;
  return typeof value === "string" ? value.trim() : "";
}

export function hasCustomerId(value: string | null | undefined) {
  return typeof value === "string" && value.trim().length > 0;
}
