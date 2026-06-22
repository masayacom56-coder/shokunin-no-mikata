import { CustomerEstimateHistoryClient } from "./customer-estimate-history-client";

type CustomerEstimateHistoryPageProps = {
  params?: {
    id?: string | string[];
  };
};

function routeId(params: CustomerEstimateHistoryPageProps["params"]) {
  const value = params?.id;
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default function CustomerEstimateHistoryPage({ params }: CustomerEstimateHistoryPageProps) {
  return <CustomerEstimateHistoryClient customerId={routeId(params)} />;
}
