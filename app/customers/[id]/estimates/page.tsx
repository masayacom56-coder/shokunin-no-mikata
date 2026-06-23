import { CustomerEstimateHistoryClient } from "./customer-estimate-history-client";
import { safeRouteCustomerId, type CustomerRouteParams } from "@/lib/customer-route-guards";

export default function CustomerEstimateHistoryPage({ params }: { params: CustomerRouteParams }) {
  return <CustomerEstimateHistoryClient customerId={safeRouteCustomerId(params)} />;
}
