import { useResource } from "../../../hooks/useResource";
import { queryString, dateParams } from "../../../components/data/query";
import { FilterBar, LoadState, Pager, Range, Select } from "../../../components/data/Controls";
import { dateTime } from "../../../components/data/format";
import { control, panel, heading } from "../../../components/ui/Primitives";
import { Table, Badge } from "../../../components/data/Records";
import { RecordLink, label, statusList, emailStates, hookStates, categories, financePath } from "./Shared";
import { formatPaise } from "../../../components/data/money";
import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { getFinancialRows } from "../../../services/api";

const choices = (values, none = "All") => [["", none], ...values];
const sortChoices = (columns) => columns.map(([value, name]) => [value,name]);
const sortTransactions = sortChoices([["createdAt","Created date"],["paidAt","Paid date"],["amountPaise","Recorded paise"],["status","Status"]]);
const life = [["status","Payment status",choices(statusList)],["receiptEmailStatus","Customer email state",choices(emailStates)],["adminEmailStatus","Admin email state",choices(emailStates)]];
const descriptions = {
  transactions: { title: "Transactions", caption: "Razorpay checkout records. Contact details and gateway identifiers are available in the inspector.",
    placeholder: "Name, email, service, or exact identifier", sort: sortTransactions,
    filters: [...life, ["flowType","Flow",choices(["service","support"])], ["failureCategory","Failure category",choices(categories)],
      ["dateField","Filter by date", [["createdAt","Created date"],["paidAt","Paid date"]]]],
  },
  "support-payments": { title: "Support payments", caption: "Recorded Razorpay monetary support payments.",
    placeholder: "Contributor, email, or exact identifier", sort: sortTransactions,
    filters: [...life, ["dateField","Filter by date", [["createdAt","Created date"],["paidAt","Paid date"]]]],
  },
  bookings: { title: "Bookings", caption: "Recorded bookings. Preferred dates are requested times.",
    placeholder: "Customer, service, or gateway identifier", sort: sortChoices([["createdAt","Created"],["preferredDate","Preferred date"],["paidAt","Paid date"],["paymentStatus","Status"]]),
    filters: [["view","Booking view",[["recorded","Recorded bookings"],["paid","Recorded paid bookings"],["upcoming","Upcoming preferred dates"],["historical","Past preferred dates"],["review","Links needing review"]]],
      ["paymentProvider","Provider",choices(["razorpay","cashfree"])],["paymentStatus","Payment status",choices(["created","pending","paid","failed"])]],
  },
  receipts: { title: "Receipt diagnostics", caption: "Recorded receipt and email states. Sent means the send was recorded.",
    sort: sortTransactions,
    filters: [...life,["issue","Diagnostic filter",choices([["missing-receipt","Paid, receipt missing"],["receipt-failed","Customer email failed"],
      ["admin-failed","Admin email failed"],["incomplete-email","Incomplete delivery metadata"],["stale-email","Stale processing claim"]])]],
  },
  "webhook-events": { title: "Webhook events", caption: "Recorded Razorpay events. Several events can reference the same transaction.",
    placeholder: "Exact event ID", sort: sortChoices([["createdAt","Created"],["processedAt","Processed"],["attempts","Attempts"],["status","Status"]]),
    filters: [["status","Event status",choices(hookStates)],["eventType","Event type",choices(["payment.captured","payment.failed","order.paid","other"])]],
  },
  "legacy-payments": { title: "Legacy payments", caption: "Historical supportpayments collection. Records are kept separate from current Razorpay analytics.",
    placeholder: "Contributor or recognized identifier", sort: sortChoices([["createdAt","Created"],["paidAt","Paid"],["amount","Recorded major amount"]]),
    filters: [["paymentStatus","Payment status",choices(["created","pending","paid","failed"])]],
  },
  reconciliation: { title: "Reconciliation", caption: "Checks recent records in the selected date window. Findings describe evidence for review.",
    sort: [["createdAt","Created"]],
    filters: [["source","Record type",[["transactions","Transactions"],["bookings","Bookings"],["webhooks","Webhooks"]]],
      ["severity","Severity",choices(["informational","needs_review","potential_inconsistency","confirmed_structural_mismatch"])]],
  },
};
const id = (row) => row._id || row.id;
const short = (value) => typeof value === "string" ? value.slice(0,8) + "…" : "Record";
const detail = (view, row, content) => <RecordLink view={view} id={id(row)}>{content}</RecordLink>;
const shown = (value) => value || "Not recorded";
const paid = (row) => dateTime(row.paidAt);
const recorded = (row) => dateTime(row.createdAt);
const amount = (row) => row.amountIssue ? "Check amount" : formatPaise(row.amountPaise);

function tableColumns(view) {
  if (view === "bookings") return [
    ["Booking", (row) => detail(view,row,row.service || short(id(row)))], ["Customer", (row) => shown(row.name)],
    ["Preferred date", (row) => row.preferredDate ? new Intl.DateTimeFormat("en-IN",{dateStyle:"medium", timeZone:"Asia/Kolkata"}).format(new Date(row.preferredDate)) + (row.preferredTime ? " · " + row.preferredTime : "") : "Not recorded"],
    ["Payment", (row) => <Badge value={row.paymentStatus} />], ["Recorded amount (major units)", (row) => row.amount ?? "Not recorded", "number"],
    ["Provider", (row) => shown(row.paymentProvider)],
    ["Transaction link", (row) => row.relationship ? <Badge value={row.relationship.status} /> : "Unavailable"],
  ];
  if (view === "receipts") return [
    ["Reference", (row) => detail(view,row,row.internalReference || short(id(row))), "technical"], ["Receipt", (row) => shown(row.receipt.number), "technical"],
    ["Payment", (row) => <Badge value={row.status} />], ["Customer email", (row) => <Badge value={row.receipt.customer.status} />],
    ["Customer attempts", (row) => row.receipt.customer.attempts ?? "—"], ["Admin email", (row) => <Badge value={row.receipt.admin.status} />],
    ["Admin attempts", (row) => row.receipt.admin.attempts ?? "—", "number"], ["Paid", paid, "technical"],
  ];
  if (view === "webhook-events") return [
    ["Event", (row) => detail(view,row,row.eventId || short(id(row))), "technical"], ["Type", (row) => label(row.eventType)],
    ["Status", (row) => <Badge value={row.status} />], ["Attempts", (row) => row.attempts ?? "—", "number"],
    ["Transaction", (row) => row.transactionId ? <RecordLink view="transactions" id={row.transactionId}>Open transaction</RecordLink> : "Not recorded"],
    ["Recorded", recorded, "technical"],
  ];
  if (view === "legacy-payments") return [
    ["Reference", (row) => detail(view,row,row.orderId || short(id(row)))], ["Contributor", (row) => shown(row.contributorName)],
    ["Provider", (row) => shown(row.paymentProvider)], ["Recorded major units", (row) => row.amount ?? "Not recorded", "number"],
    ["Status", (row) => <Badge value={row.paymentStatus} />], ["Recorded", recorded],
  ];
  if (view === "reconciliation") return [
    ["Finding", (row) => label(row.code)], ["Severity", (row) => <Badge value={row.severity} />],
    ["Evidence", (row) => <>{row.description}{row.evidence ? " " + label(row.evidence) : ""}</>],
    ["Record", (row) => detail(row.source === "webhooks" ? "webhook-events" : row.source,row,row.reference || short(id(row)))],
    ["Record created", (row) => dateTime(row.observedAt)],
  ];
  return [
    ["Reference", (row) => detail(view,row,row.internalReference || short(id(row))), "technical"],
    [view === "support-payments" ? "Contributor" : "Customer", (row) => shown(row.contributorName || row.customerName)],
    ["Flow", (row) => shown(row.flowType)], ["Recorded amount", amount, "number"], ["Payment", (row) => <Badge value={row.status} />],
    ["Receipt email", (row) => <Badge value={row.receiptEmailStatus} />], ["Created", recorded, "technical"],
  ];
}

export default function Registry({ view }) {
  const spec = descriptions[view];
  const [searchParams] = useSearchParams();
  const linkedReference = searchParams.get("transaction");
  const transactionId = view === "webhook-events" && /^[a-f0-9]{24}$/i.test(linkedReference) ? linkedReference : undefined;
  const defaults = { range: "30d", page: 1, pageSize: 25, view: view === "bookings" ? "recorded" : undefined };
  const [query, setQuery] = useState(defaults);
  const upcoming = view === "bookings" && query.view === "upcoming";
  const enabled = transactionId || upcoming || query.range !== "custom" || !!(query.from && query.to);
  const update = (change) => setQuery((old) => ({ ...old, page: 1, ...change }));
  const { range, from, to, ...filters } = query;
  const dates = transactionId ? { range: "all" } : upcoming ? {} : dateParams(query);
  const params = { ...filters, ...dates, transactionId, endpoint: view };
  if (view === "bookings" && query.view === "paid") delete params.paymentStatus;
  const resource = useResource(getFinancialRows, queryString(params), { enabled, delay: query.search !== undefined ? 250 : 0 });
  const data = resource.data;
  const links = new Map((data?.links?.data || []).map((item) => [item.id, item]));
  const rows = data?.items.map((item) => view === "bookings" ? { ...item, relationship: item.link || links.get(item._id) } : item) || [];
  return <div className="space-y-4">
    <section className={panel}>
      <h2 className={heading}>{spec.title}</h2><p className="mt-1 text-sm text-muted">{spec.caption}</p>
      <FilterBar className="mt-4" refresh={resource.refresh} reset={() => setQuery(defaults)}>
        {spec.placeholder && <label className="grid gap-1 text-sm min-w-0 flex-1 basis-56">Search
          <input className={control} type="search" maxLength={100} value={query.search || ""} placeholder={spec.placeholder} onChange={(e) => update({ search:e.target.value })} />
        </label>}
        {!upcoming && !transactionId && <Range value={query} change={update} />}
        <Select name="Sort by" value={query.sortBy || "createdAt"} change={(sortBy) => update({ sortBy })} options={spec.sort} />
        <Select name="Direction" value={query.order || "desc"} change={(order) => update({ order })} options={[["desc","Descending"],["asc","Ascending"]]} />
        <Select name="Page size" value={query.pageSize} change={(pageSize) => update({ pageSize })} options={[5,10,25,50]} />
      </FilterBar>
      <details className="mt-4" open={view === "bookings" || view === "reconciliation" || undefined}>
        <summary className="cursor-pointer text-sm font-medium text-paper">Filters</summary>
        <div className="mt-2 flex flex-wrap gap-3">
          {spec.filters.filter(([key]) => view !== "bookings" || query.view !== "paid" || key !== "paymentStatus").map(([key,name,options]) =>
            <Select key={key} name={name} value={query[key] || options[0][0]} change={(value) => update(key === "source" ? { source:value, issue:"" } : { [key]:value })} options={options} />)}
          {(view === "transactions" || view === "bookings") && <label className="grid gap-1 text-sm">Service slug
            <input className={control} value={query.service || ""} maxLength={80} onChange={(event) => update({ service:event.target.value })} />
          </label>}
          {view === "reconciliation" && !!data?.issueTypes?.length && <Select name="Finding type" value={query.issue}
            change={(issue) => update({ issue })} options={choices(data.issueTypes)} />}
        </div>
      </details>
      {upcoming && <p className="mt-3 text-xs text-muted">Preferred dates from today through the next 180 days.</p>}
      {view === "bookings" && query.view === "paid" && <p className="mt-3 text-xs text-muted">Date range uses the recorded paid date.</p>}
      {transactionId && <p className="mt-3 text-sm">Showing events for one transaction. <Link className="text-paper underline" to={financePath(view)}>Clear transaction filter</Link></p>}
    </section>
    {enabled ? <LoadState resource={resource} /> : <p role="status">Choose both custom dates.</p>}
    {data && <section className={panel}>
      {view === "reconciliation" && <div className="mb-3 text-sm text-muted">
        <p>{data.scanned} candidate records checked{data.truncated ? " within the " + data.candidateLimit + "-record scan cap. Narrow the date range for more complete coverage." : "."}</p>
        {Object.entries(data.checks).filter(([,part]) => part.status !== "available").map(([name,part]) => <p key={name}>{label(name)} check unavailable. {part.message}</p>)}
      </div>}
      {view === "bookings" && data.truncated && <p className="mb-3 text-sm">Link review is limited to the first 200 records in this date range.</p>}
      {data.links?.status === "unavailable" && <p className="mb-3 text-sm">Transaction links are unavailable. {data.links.message}</p>}
      <Table name={spec.title + " results"} columns={tableColumns(view)} rows={rows} />
      <div className="mt-3"><Pager data={data} change={(page) => update({ page })} label={view === "reconciliation" ? "Findings" : "Results"} /></div>
    </section>}
  </div>;
}
