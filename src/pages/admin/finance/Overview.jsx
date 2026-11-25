import { useResource } from "../../../hooks/useResource";
import { queryString, dateParams } from "../../../components/data/query";
import { LoadState, Range } from "../../../components/data/Controls";
import { Timeline, Distribution } from "../../../components/data/Charts";
import { number, dateTime } from "../../../components/data/format";
import { control, panel, heading } from "../../../components/ui/Primitives";
import { Fields, Box, Table } from "../../../components/data/Records";
import { financePath } from "./Shared";
import { formatPaise } from "../../../components/data/money";
import { useState } from "react";
import { Link } from "react-router-dom";
import { getFinancialAnalytics } from "../../../services/api";

const dayLabel = (value) => new Date(Date.parse(value) + 19800000).toISOString().slice(0,10);
const rows = (items, fields) => items.map((item) => ({ day:item.key, ...Object.fromEntries(fields.map((field) => [field,item[field]])) }));
const ratio = (entries, total) => entries.map((row) => ({ ...row, fraction: total ? row.count / total : 0 }));

export default function Overview() {
  const [range,setRange] = useState({ range:"7d" });
  const enabled = range.range !== "custom" || !!(range.from && range.to);
  const resource = useResource(getFinancialAnalytics, queryString(dateParams(range)), { enabled });
  const report = resource.data;
  const payment = report?.transactions.data;
  const hooks = report?.webhooks.data;
  const paidBookings = report?.bookings.data;
  const value = (entry) => entry == null ? "Unavailable" : number(entry);
  const metrics = [
    ["Recorded amount, currently paid",formatPaise(payment?.paid.totalPaise)],
    ["Service payments",formatPaise(payment?.paid.servicePaise)], ["Support payments",formatPaise(payment?.paid.supportPaise)],
    ["Recorded paid transactions",value(payment?.paid.count)],["Pending attempts",value(payment?.attempts.pending)],
    ["Authorized attempts",value(payment?.attempts.authorized)],["Recorded paid bookings",value(paidBookings?.confirmedPaid)],
    ["Customer receipt email failures",value(payment?.attempts.receiptFailures)],["Webhook failures",value(hooks?.failed)],
  ];
  return <div className="space-y-4">
    <div className="flex items-end flex-wrap gap-3">
      <Range value={range} change={(patch) => setRange((previous) => ({ ...previous,...patch }))} />
      <button type="button" className={control} onClick={resource.refresh}>Refresh overview</button>
    </div>
    <p className="text-sm text-muted">Recorded database amounts. Historical test/live mode, settlements, fees, refund amounts and net revenue are unverified or unavailable.</p>
    {enabled ? <LoadState resource={resource} /> : <p role="status">Choose both custom dates.</p>}
    {report && <>
      <section className={panel}>
        <h2 className={heading}>Financial snapshot</h2>
        <p className="mt-1 text-xs text-muted">{dayLabel(report.dates.from)} through {dayLabel(new Date(Date.parse(report.dates.to)-86400000))} IST · Observed {dateTime(report.observedAt)}</p>
        <dl className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-3">
          {metrics.map(([name,value], index) => <div key={name} className={`min-w-0 border-l border-rule pl-3 ${index < 3 && value.length > 14 ? "col-span-2 sm:col-span-1" : ""}`}>
            <dt className="text-xs text-muted">{name}</dt><dd className="mt-1 font-serif text-h2 tabular-nums [overflow-wrap:anywhere]">{value}</dd>
          </div>)}
        </dl>
        {Object.entries({ Transactions:report.transactions, Bookings:report.bookings, Webhooks:report.webhooks }).filter(([,part]) => part.status !== "available")
          .map(([name,part]) => <p role="status" className="mt-3 text-sm text-error" key={name}>{name} unavailable. {part.message}</p>)}
        {payment && <p className="mt-3 text-sm text-muted">
          {payment.paid.excluded} paid records excluded from INR sums due to an amount or currency check. {payment.paid.invalidFlow} paid records have an unclassified flow.
        </p>}
      </section>
      {payment && <>
        <div className="grid gap-4 lg:grid-cols-2">
          <Timeline title="Checkout records by created date" rows={rows(payment.dailyAttempts,["count","failed"])} unit="records" series={[
            { key:"count",label:"Recorded attempts",seriesTone: "main" },{ key:"failed",label:"Currently failed",seriesTone: "warning" }]} />
          <Timeline title="Currently paid records by paid date" rows={rows(payment.dailyPaid,["count"])} unit="records" series={[
            { key:"count",label:"Recorded paid",seriesTone: "main" }]} />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Distribution title="Current status of checkout records" rows={ratio(payment.statuses,payment.attempts.total)} />
          <Distribution title="Recorded payment failure categories" rows={ratio(payment.failureCategories,payment.attempts.failed)} />
        </div>
        <Box title="Payment and email diagnostics">
          <Fields fields={[["Failed attempts",payment.attempts.failed],["Refunded state (records)",payment.attempts.refunded],
            ["Recorded pending amount",formatPaise(payment.attempts.pendingPaise)],["Pending records excluded from sums",payment.attempts.pendingInvalid],
            ["Admin notification failures",payment.attempts.adminFailures]]} />
          <details className="text-sm"><summary className="cursor-pointer text-paper">Daily paid amounts</summary>
            <Table name="Daily paid amounts" rows={payment.dailyPaid.map((row) => ({ ...row,_id:row.key }))}
              columns={[["Date (IST)",(row) => row.key,"technical"],["Recorded amount",(row) => formatPaise(row.paise),"number"],["Paid records",(row) => row.count,"number"],
                ["Excluded",(row) => row.count-row.valid,"number"]]} empty="No recorded paid activity." />
          </details>
        </Box>
      </>}
      {hooks && <Box title="Recorded webhook processing">
        <Fields fields={[["Total events",hooks.total],["Processed",hooks.processed],["Failed",hooks.failed],["Ignored",hooks.ignored],
          ["Processing",hooks.processing],["Unclassified",hooks.unclassified]]} />
      </Box>}
      <Box title="Reconciliation observations">
        <p className="mt-2 text-sm text-muted">Run a bounded review of links, monetary fields and delivery metadata in the selected record scope.</p>
        <Link className="mt-2 inline-block text-sm font-medium text-paper underline" to={financePath("reconciliation")}>Open reconciliation</Link>
      </Box>
    </>}
  </div>;
}
