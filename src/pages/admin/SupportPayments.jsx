import ReadOnlyRecords from "../../components/ReadOnlyRecords";
import { getSupportPayments } from "../../services/api";

const filter = { key: "status", label: "Status", values: {"created":"Created","pending":"Pending","authorized":"Authorized","paid":"Paid","failed":"Failed","refunded":"Refunded"} };
const fields = [
  ["email","Email"],
  ["amount","Amount"],
  ["status","Status"],
  ["razorpayOrderId","Order ID"],
  ["razorpayPaymentId","Payment ID"],
  ["receiptNumber","Receipt number"],
  ["receiptEmailStatus","Receipt delivery"],
  ["message","Message"],
  ["createdAt","Created"],
];

export default function SupportPayments() {
  return <ReadOnlyRecords title="Support Payments" description="View Razorpay support transactions. Historical Cashfree payments are excluded."
    load={getSupportPayments} heading={(record) => record.contributorName || record.customerName || 'Support payment'} fields={fields} filter={filter} />;
}
