"use client";

import { CustomerDetailClient } from "./customer-detail-client";
import { useParams } from "next/navigation";

function routeId(value: string | string[] | undefined) {
  const id = Array.isArray(value) ? value[0] : value;
  return typeof id === "string" ? id.trim() : "";
}

export default function CustomerDetailPage() {
  const params = useParams<{ id?: string | string[] }>();
  return <CustomerDetailClient customerId={routeId(params?.id)} />;
}
