import { CustomerDetailClient } from "./customer-detail-client";
import { safeRouteCustomerId } from "@/lib/customer-route-guards";

type CustomerDetailPageProps = {
  params: {
    id: string;
  };
};

export default function CustomerDetailPage({ params }: CustomerDetailPageProps) {
  return <CustomerDetailClient customerId={safeRouteCustomerId(params)} />;
}
