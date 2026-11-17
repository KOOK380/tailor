import { OrderWizard } from "@/components/orders/order-wizard";
import { getOrderEmployees } from "@/server/orders";
import { getCustomer } from "@/server/customers";
import { getBusinessCurrency } from "@/server/business";

export default async function NewOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ customerId?: string }>;
}) {
  const { customerId } = await searchParams;
  const employees = await getOrderEmployees();
  const preset = customerId ? await getCustomer(customerId) : null;
  const currency = await getBusinessCurrency();

  return (
    <OrderWizard
      employees={employees.map((e) => ({ id: e.id, fullName: e.fullName }))}
      presetCustomerId={preset?.id}
      presetCustomerName={preset?.fullName}
      currency={currency}
    />
  );
}
