import { CustomerDetailClient } from "./customer-detail-client";

type CustomerDetailPageProps = {
  params?: {
    id?: string | string[];
  };
};

function routeId(params: CustomerDetailPageProps["params"]) {
  const value = params?.id;
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default function CustomerDetailPage({ params }: CustomerDetailPageProps) {
  return <CustomerDetailClient customerId={routeId(params)} />;
}
