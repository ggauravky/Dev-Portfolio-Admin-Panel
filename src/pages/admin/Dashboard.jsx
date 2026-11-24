import { useState } from "react";
import { Link } from "react-router-dom";
import AdminLayout from "../../components/AdminLayout";
import { getBusinessAnalytics, getStats } from "../../services/api";
import { control, dateParams, Distribution, latency, LoadState, percent, queryString, Timeline, useChatResource } from "./chat/Shared";
import { Range, Table } from "./finance/Shared";
import { formatPaise } from "./finance/money";
import { displayDate, linkClass, MetricSection, RecordLink, routes, words } from "./business/Shared";

function Group({ title, fields, link, unavailable, children }) {
  return <MetricSection title={title} fields={fields}>
    {unavailable && <p className="text-sm text-slate-600">{unavailable}</p>}
    {children}
    {link && <Link className={linkClass + " mt-3 inline-block text-sm"} to={link[1]}>{link[0]}</Link>}
  </MetricSection>;
}

const daily = (rows) => (rows || []).map(({ key, count }) => ({ day: key, count }));
const distribution = (rows) => {
  const total = (rows || []).reduce((sum, row) => sum + row.count, 0);
  return (rows || []).map((row) => ({ ...row, fraction: total ? row.count / total : 0 }));
};

function BusinessSections({ report }) {
  const users = report.users.data;
  const newsletter = report.newsletter.data;
  const contacts = report.contacts.data;
  const engagement = report.engagement.data;
  const activity = report.activity.data;
  return <>
    <div className="grid gap-4 lg:grid-cols-2">
      <Group title="Audience" fields={[["Registered users · current", users?.total], ["Verified accounts · current", users?.verified],
        ["Unverified accounts · current", users?.unverified], ["Unknown verification · current", users?.verificationUnknown],
        ["New registrations · period", users?.registrations], ["Last recorded login · period", users?.lastLoginInPeriod],
        ["Users with activity · period", activity?.linkedUsers.data]]} link={["Open registered users", routes.users]} />
      <Group title="Newsletter" fields={[["Subscription records · current", newsletter?.total], ["Active · current", newsletter?.active],
        ["Unsubscribed · current", newsletter?.unsubscribed], ["Unknown · current", newsletter?.unknown], ["New records · period", newsletter?.newRecords],
        ["Stored unsubscribe timestamps · period", newsletter?.unsubscribeTimestamps]]} link={["Open newsletter registry", routes.newsletters]} />
      <Group title="Communications" fields={[["Contact messages · current", contacts?.total], ["Unread · current", contacts?.unread],
        ["Incoming messages · period", contacts?.received]]} link={["Open contact inbox", routes.contacts]}>
        {contacts && <p className="text-sm text-slate-700">{contacts.statuses.map(({ key, count }) => `${words(key)} ${count}`).join(" · ") || "No recorded statuses."}</p>}
      </Group>
      <Group title="Content and engagement" fields={[["Support relationships · current", engagement?.total], ["Distinct supporter IDs · current", engagement?.distinctSupporterIds],
        ["Supported articles · current", engagement?.supportedArticles], ["Recorded supports · period", engagement?.received]]} link={["Open blog engagement", routes["blog-posts"]]}>
        {engagement?.top.length > 0 && <>
          <h3 className="mt-3 text-sm font-semibold">Most-supported recorded articles</h3>
          <ul className="mt-2 space-y-1 text-sm">{engagement.top.map((item) => <li key={item.id}>
            <RecordLink kind="blog-posts" id={item.id}>{item.article.title || item.article.slug || "Recorded article"}</RecordLink> · {item.count}</li>)}</ul>
        </>}
      </Group>
    </div>
    <Group title="Recent activity" unavailable={report.timelinePaymentSource !== "available" ? "The transaction source is unavailable. Other recorded events may still appear." : undefined}>
      <Table name="Recent activity across modules" rows={report.timeline.map((item) => ({ ...item, _id: item.source + item.id }))} empty="No available sources recorded activity in this period." columns={[
        ["Event", (item) => <RecordLink kind={item.source} id={item.id}>{item.title}</RecordLink>], ["Time", (item) => displayDate(item.timestamp)],
      ]} />
    </Group>
    <details className="rounded-xl border border-slate-200 bg-white p-4">
      <summary className="cursor-pointer font-semibold text-slate-900">Daily trends and activity breakdown</summary>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {[["Daily registrations", users], ["Daily incoming messages", contacts], ["Daily new subscription records", newsletter],
          ["Daily blog supports", engagement], ["Daily recorded user activity", activity]].map(([title, data]) => data ?
          <Timeline key={title} title={title} rows={daily(data.daily)} unit="records" series={[{ key: "count", label: "Records", color: "bg-teal-700" }]} /> :
          <MetricSection key={title} title={title} description="Source unavailable." />)}
        {activity && <>
          <MetricSection title="Recorded activity" fields={[["All stored events", activity.total], ["Events in selected period", activity.recorded], ["Linked users in selected period", activity.linkedUsers.data]]} />
          {[['Activity domains', activity.domains], ['Activity actions', activity.actions], ['Activity status', activity.statuses]].map(([title, rows]) =>
            <Distribution key={title} title={title} rows={distribution(rows)} />)}
        </>}
      </div>
    </details>
  </>;
}

export default function Dashboard() {
  const stats = useChatResource(getStats);
  const [range, setRange] = useState({ range: "7d" });
  const defaultRange = range.range === "7d";
  const ready = range.range !== "custom" || Boolean(range.from && range.to);
  const business = useChatResource(getBusinessAnalytics, queryString(dateParams(range)), { enabled: !defaultRange && ready });
  const report = defaultRange ? stats.data?.businessSummary : business.data;
  const ai = stats.data?.chatSummary;
  const finance = stats.data?.financialSummary;
  const payment = finance?.transactions.data;
  const availability = stats.data?.availability;
  return <AdminLayout><div className="min-w-0 space-y-5 px-4 sm:px-0">
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div><h1 className="text-3xl font-bold text-slate-900">Portfolio dashboard</h1>
        <p className="mt-1 text-sm text-slate-600">Last generated {displayDate(stats.data?.generatedAt)}</p></div>
      <button type="button" className={control} onClick={() => { stats.refresh(); business.refresh(); }}>Refresh dashboard</button>
    </header>
    <LoadState resource={stats} />
    {stats.data && <div className="grid gap-4 lg:grid-cols-3">
      <Group title="Intelligence · last 7 days" fields={[["Recorded chat turns", ai?.turns], ["Recorded conversations", ai?.conversations],
        ["Cache hit rate", ai && percent(ai.cacheRate)], ["Median latency", ai && latency(ai.medianMs)]]} link={["Open AI Intelligence", "/admin/chats"]} />
      <Group title="Financial snapshot · last 7 days" fields={[["Paid services", payment && formatPaise(payment.paid.servicePaise)],
        ["Paid support", payment && formatPaise(payment.paid.supportPaise)], ["Pending attempts", payment?.attempts.pending],
        ["Recorded paid bookings", finance?.bookings.data?.confirmedPaid], ["Failed customer emails", payment?.attempts.receiptFailures], ["Failed webhooks", finance?.webhooks.data?.failed]]}
        unavailable="Test/live mode is unverified. Refund amounts are unavailable." link={["Open Financial Control Center", "/admin/financial"]} />
      <Group title="System status" fields={[["Portfolio database", words(availability?.primary)], ["Chat database", words(availability?.chat)],
        ["Admin database", words(availability?.admin)], ["API readiness", availability?.primary === "available" && availability?.admin === "available" ? "Ready" : "Unavailable"]]}
        link={["Open system health", "/admin/system"]} />
    </div>}
    <section className="space-y-4" aria-label="Business analytics">
      <div className="flex flex-wrap items-end gap-3 border-b border-slate-200 pb-3">
        <div className="mr-auto"><h2 className="text-xl font-semibold text-slate-900">Business analytics</h2>
          <p className="text-sm text-slate-600">The date range applies to period metrics only. Reports use Asia/Kolkata.</p>
          {report && <p className="mt-1 text-xs text-slate-600">Report generated {displayDate(report.generatedAt)}</p>}</div>
        <Range value={range} change={(change) => setRange((old) => ({ ...old, ...change }))} />
      </div>
      {!ready ? <p role="status">Choose both custom dates.</p> : !defaultRange && <LoadState resource={business} />}
      {report ? <BusinessSections report={report} /> : defaultRange && stats.data && <p role="status">Business analytics are unavailable.</p>}
    </section>
  </div></AdminLayout>;
}
