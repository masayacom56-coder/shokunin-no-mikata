import { CustomerEstimateHistoryClient } from "./customer-estimate-history-client";
import { safeRouteCustomerId } from "@/lib/customer-route-guards";

type CustomerEstimateHistoryPageProps = {
  params: {
    id: string;
  };
};

export default function CustomerEstimateHistoryPage({ params }: CustomerEstimateHistoryPageProps) {
  return <CustomerEstimateHistoryClient customerId={safeRouteCustomerId(params)} />;
}
