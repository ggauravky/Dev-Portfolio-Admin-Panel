import ReadOnlyRecords from "../../components/ReadOnlyRecords";
import { getChats } from "../../services/api";

const filter = { key: "cached", label: "Cache", values: {"true":"Cached","false":"Uncached"} };
const fields = [
  ["answer","Answer"],
  ["sessionId","Conversation ID"],
  ["intent","Intent"],
  ["provider","Provider"],
  ["latencyMs","Latency (ms)"],
  ["cached","Cached"],
  ["aborted","Aborted"],
  ["createdAt","Recorded"],
];

export default function Chats() {
  return <ReadOnlyRecords title="Chats" description="Read conversation turns recorded by the portfolio assistant."
    load={getChats} heading={(record) => record.question} fields={fields} filter={filter} />;
}
