import { Link } from "react-router-dom";
import { getFinancialDetail } from "../../../services/api";
import { useChatResource, queryString, LoadState, dateTime, control, panel, heading } from "../chat/Shared";
import { Fields, Badge, Box, RecordLink, financePath, label, Table } from "./Shared";
import { formatPaise } from "./money";

const date = (value) => value ? dateTime(value) : null;
const preferredDate = (value) => value ? new Intl.DateTimeFormat("en-IN", { dateStyle:"medium", timeZone:"Asia/Kolkata" }).format(new Date(value)) : null;
const state = (value) => <Badge value={value} />;
const back = (view) => <Link className={control} to={financePath(view)}>Back to list</Link>;

function Receipt({ value }) {
  return <Box title="Receipt and email delivery">
    <Fields fields={[["Receipt number",value.number],["Identity generated",date(value.generatedAt)],["Receipt availability",label(value.availability)]]} />
    <p className="text-sm text-slate-600">Sent is an application record. PDF access is handled by the Portfolio.</p>
    <div className="mt-3 grid gap-3 md:grid-cols-2">
      {[["Customer receipt email",value.customer],["Admin notification email",value.admin]].map(([name, item]) =>
        <div className="rounded-md border border-slate-200 p-3 min-w-0" key={name}>
          <h3 className="font-semibold text-sm">{name}</h3>
          <Fields fields={[["Status",state(item.status)],["Attempts",item.attempts],["Last attempt",date(item.lastAttemptAt)],["Sent",date(item.sentAt)],
            ["Processing claim",date(item.claimedAt)],["Claim state",item.staleClaim === true ? "Past five-minute claim window" : item.staleClaim === false ? "Within claim window" : null]]} />
        </div>)}
    </div>
  </Box>;
}

function Transaction({ data }) {
  const related = data.booking.data;
  const stages = [
    ["Transaction created", data.createdAt], ["Gateway order ID recorded", null, data.razorpayOrderId],
    ["Verification accepted", data.verificationAcceptedAt], ["Webhook received", data.webhookReceivedAt],
    ["Payment confirmation recorded", data.paidAt], ["Failure recorded", data.failedAt],
    ["Booking linked", null, related?.status === "linked" ? <RecordLink view="bookings" id={related.record._id}>Open booking</RecordLink> : null],
    ["Receipt identity generated", data.receipt.generatedAt],
    ["Customer receipt email sent", data.receipt.customer.sentAt], ["Admin notification sent", data.receipt.admin.sentAt],
  ];
  return <>
    <Box title={data.internalReference || "Transaction"}>
      <p className="mt-2 text-sm text-slate-600">Database-recorded state. Historical test/live mode is unverified.</p>
      <Fields fields={[
        ["Payment",state(data.status)],["Flow",data.flowType],["Provider",data.provider],
        ["Recorded amount",formatPaise(data.amountPaise)],["Amount validation",data.amountIssue && label(data.amountIssue)],
        ["Service",data.serviceName],["Customer",data.customerName],["Contributor",data.contributorName],["Email",data.email],["Phone",data.phone],
        ["Preferred date",preferredDate(data.preferredDate)],["Preferred time",data.preferredTime],["Order ID",data.razorpayOrderId],["Payment ID",data.razorpayPaymentId],
        ["Project brief",data.projectBrief],["Contributor message",data.message],
      ]} />
    </Box>
    <Box title="Recorded payment lifecycle">
      <ol className="mt-3 divide-y divide-slate-100 text-sm">
        {stages.map(([name,time,value]) => <li className="grid gap-1 py-2 sm:grid-cols-2" key={name}>
          <span className="font-medium">{name}</span><span className="text-slate-600 break-words">{time ? date(time) : value ? <>{value} · timestamp not recorded</> : "Not recorded"}</span>
        </li>)}
      </ol>
      <p className="mt-3 text-sm">Booking relationship: {data.booking.status !== "available" ? data.booking.message : label(related?.status) +
        (related?.reason ? " · " + label(related.reason) : "")}</p>
    </Box>
    {data.failure.description && <Box title="Recorded payment failure">
      <p className="mt-2 text-sm">{data.failure.description} A failed record does not establish a bank debit.</p>
      <Fields fields={[["Recorded code",label(data.failure.code)],["Category",label(data.failure.category)],
        ["Provider code",label(data.failure.providerCode)],["Provider HTTP status",data.failure.providerStatus],["Failed at",date(data.failedAt)]]} />
    </Box>}
    <Receipt value={data.receipt} />
    <Box title="Related Razorpay webhook events">
      {data.webhooks.status !== "available" ? <p role="status" className="mt-3 text-sm">{data.webhooks.message}</p> : <>
        <Table name="Linked webhook events" rows={data.webhooks.data.items} columns={[
          ["Event", (row) => <RecordLink view="webhook-events" id={row._id}>{row.eventId}</RecordLink>], ["Type",(row) => label(row.eventType)],
          ["Status",(row) => state(row.status)], ["Attempts",(row) => row.attempts], ["Recorded",(row) => date(row.createdAt)],
        ]} empty="No linked events recorded." />
        <p className="mt-2 text-sm text-slate-600">{data.webhooks.data.more ? "Showing the latest 10 linked events. " : ""}
          <Link className="text-teal-800 underline" to={financePath("webhook-events") + "?transaction=" + encodeURIComponent(data._id)}>View linked events</Link></p>
      </>}
    </Box>
  </>;
}

function Booking({ data }) {
  const related = data.transaction.data;
  return <>
    <Box title={data.service || "Booking record"}>
      <p className="mt-2 text-sm text-slate-600">Preferred date and time are customer requests.</p>
      <Fields fields={[
        ["Booking ID",data._id],["Service slug",data.serviceSlug],["Customer",data.name],["Email",data.email],["Phone",data.phone],
        ["Preferred date",preferredDate(data.preferredDate)],["Preferred time",data.preferredTime],["Project brief",data.projectBrief],
        ["Booking amount (recorded major units)",data.amount],["Payment status",state(data.paymentStatus)],["Provider",data.paymentProvider],
        ["Order ID",data.orderId],["Payment ID",data.paymentId],["Paid timestamp",date(data.paidAt)],["Created",date(data.createdAt)],
        ["Verification accepted",date(data.verificationAcceptedAt)],["Webhook recorded",date(data.webhookReceivedAt)],
        ["Receipt email sent (booking)",date(data.receiptEmailSentAt)],["Admin notification sent (booking)",date(data.adminEmailSentAt)],
        ["Recorded reconciliation status",state(data.reconciliationStatus)],["Recorded reconciliation attempts",data.reconciliationAttempts],
        ["Last reconciliation observation",date(data.lastReconciliationAt)],
      ]} />
    </Box>
    <Box title="Transaction relationship">
      {data.transaction.status === "unavailable" ? <p role="status" className="mt-3 text-sm">{data.transaction.message}</p> :
        <Fields fields={[["Link state",state(related?.status)],["Evidence",label(related?.reason || related?.matchedBy)],
          ["Transaction",related?.record && <RecordLink view="transactions" id={related.record._id}>{related.record.internalReference || "Open transaction"}</RecordLink>],
          ["Canonical transaction amount",related?.record && formatPaise(related.record.amountPaise)],
          ["Canonical receipt",related?.record?.receiptNumber],["Customer email state",state(related?.record?.receiptEmailStatus)],
          ["Admin email state",state(related?.record?.adminEmailStatus)]]} />}
    </Box>
  </>;
}

function Webhook({ data }) {
  const related = data.transaction.data;
  return <Box title={data.eventId || "Webhook event"}>
    <Fields fields={[
      ["Recorded type",label(data.eventType)],["Processing state",state(data.status)],["Provider",data.provider],["Attempts",data.attempts],
      ["Recorded",date(data.createdAt)],["Last updated",date(data.updatedAt)],["Processed",date(data.processedAt)],
      ["Failure",data.failure],["Linked transaction",related?.status === "linked" ?
        <RecordLink view="transactions" id={related._id}>{related.internalReference || "Open transaction"}</RecordLink> :
        data.transaction.message || label(related?.status || data.transaction.status)],
    ]} />
    <p className="text-sm text-slate-600">A retry can update these timestamps. They do not measure gateway latency.</p>
  </Box>;
}

export default function Inspector({ view, id }) {
  const resource = useChatResource(getFinancialDetail, queryString({ endpoint:view, id }));
  const data = resource.data;
  return <div className="space-y-4">
    <div className="flex gap-2 items-center flex-wrap">{back(view)}<button type="button" className={control} onClick={resource.refresh}>Refresh record</button></div>
    <LoadState resource={resource} />
    {data && (view === "bookings" ? <Booking data={data} /> : view === "webhook-events" ? <Webhook data={data} /> :
      view === "receipts" ? <>
        <section className={panel}><h2 className={heading}>{data.internalReference || "Receipt record"}</h2>
          <Fields fields={[["Payment",state(data.status)],["Paid",date(data.paidAt)],["Linked transaction",<RecordLink view="transactions" id={data._id}>Open transaction</RecordLink>]]} />
        </section><Receipt value={data.receipt} />
      </> : view === "legacy-payments" ? <Box title={data.orderId || "Legacy payment record"}>
        <p className="mt-2 text-sm text-slate-600">Historical collection. Currency and payment mode cannot be inferred.</p>
        <Fields fields={[["Provider",data.paymentProvider],["Status",state(data.paymentStatus)],["Recorded major amount",data.amount],
          ["Contributor",data.contributorName],["Email",data.email],["Phone",data.phone],["Message",data.message],
          ["Payment ID",data.paymentId],["Paid",date(data.paidAt)],["Created",date(data.createdAt)]]} />
      </Box> : <Transaction data={data} />)}
  </div>;
}
