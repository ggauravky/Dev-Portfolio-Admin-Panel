import ReadOnlyRecords from "../../components/ReadOnlyRecords";
import { getNewsletters } from "../../services/api";

const filter = { key: "subscribed", label: "Subscription", values: {"true":"Subscribed","false":"Unsubscribed"} };
const fields = [
  ["subscribed","Subscribed"],
  ["subscribedAt","Subscribed date"],
  ["unsubscribedAt","Unsubscribed date"],
];

export default function Newsletter() {
  return <ReadOnlyRecords title="Newsletter" description="View current and unsubscribed email subscriptions."
    load={getNewsletters} heading={(record) => record.email} fields={fields} filter={filter} defaultSort="subscribedAt" />;
}
