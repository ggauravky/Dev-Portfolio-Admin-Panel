import ReadOnlyRecords from "../../components/ReadOnlyRecords";
import { getContacts } from "../../services/api";

const filter = { key: "status", label: "Status", values: {"unread":"Unread","read":"Read","replied":"Replied"} };
const fields = [
  ["email","Email"],
  ["subject","Subject"],
  ["message","Message"],
  ["status","Status"],
  ["createdAt","Received"],
];

export default function Contacts() {
  return <ReadOnlyRecords title="Contacts" description="Read contact messages submitted through the portfolio."
    load={getContacts} heading={(record) => record.name || record.email} fields={fields} filter={filter} />;
}
