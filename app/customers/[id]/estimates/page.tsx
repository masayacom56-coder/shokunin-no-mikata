"use client";

import { CustomerEstimateHistoryClient } from "./customer-estimate-history-client";
import { useParams } from "next/navigation";

function routeId(value: string | string[] | undefined) {
  const id = Array.isArray(value) ? value[0] : value;
  return typeof id === "string" ? id.trim() : "";
}

export default function CustomerEstimateHistoryPage() {
  const params = useParams<{ id?: string | string[] }>();
  return <CustomerEstimateHistoryClient customerId={routeId(params?.id)} />;
}
