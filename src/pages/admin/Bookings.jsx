import ReadOnlyRecords from "../../components/ReadOnlyRecords";
import { getBookings } from "../../services/api";

const filter = { key: "paymentStatus", label: "Payment status", values: {"created":"Created","pending":"Pending","paid":"Paid","failed":"Failed"} };
const fields = [
  ["name","Name"],
  ["email","Email"],
  ["phone","Phone"],
  ["preferredDate","Preferred date"],
  ["preferredTime","Preferred time"],
  ["projectBrief","Project brief"],
  ["amount","Amount"],
  ["paymentStatus","Payment status"],
  ["paymentProvider","Provider"],
  ["orderId","Order ID"],
  ["paymentId","Payment ID"],
  ["paidAt","Paid at"],
  ["receiptEmailSentAt","Receipt email sent"],
  ["adminEmailSentAt","Admin email sent"],
  ["reconciliationStatus","Reconciliation"],
];

export default function Bookings() {
  return <ReadOnlyRecords title="Bookings" description="Read bookings recorded by the portfolio. Payment attempts are tracked separately."
    load={getBookings} heading={(record) => record.service || record.serviceSlug || 'Booking'} fields={fields} filter={filter} />;
}
