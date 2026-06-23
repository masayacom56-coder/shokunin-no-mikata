import { CustomerDetailClient } from "./customer-detail-client";
import { safeRouteCustomerId, type CustomerRouteParams } from "@/lib/customer-route-guards";

export default function CustomerDetailPage({ params }: { params: CustomerRouteParams }) {
  return <CustomerDetailClient customerId={safeRouteCustomerId(params)} />;
}
