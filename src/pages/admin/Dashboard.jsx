import { control } from "../../components/ui/Primitives";
import { dateParams, queryString } from "../../components/data/query";
import { Distribution, Timeline } from "../../components/data/Charts";
import { latency, percent, displayDate, words } from "../../components/data/format";
import { LoadState, Range } from "../../components/data/Controls";
import { useResource } from "../../hooks/useResource";
import { Badge, Table, linkClass, MetricSection, RecordLink, routes } from "../../components/data/Records";
import { formatPaise } from "../../components/data/money";
import { useState } from "react";
import { Link } from "react-router-dom";
import { EditorialSection, MetricStrip } from "../../components/data/Editorial";
import { getBusinessAnalytics, getStats } from "../../services/api";

function Group({ title, fields, link, unavailable, children }) {
  return <MetricSection title={title} fields={fields}>
    {unavailable && <p className="text-sm text-muted">{unavailable}</p>}
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
        {contacts && <p className="text-sm text-muted">{contacts.statuses.map(({ key, count }) => `${words(key)} ${count}`).join(" · ") || "No recorded statuses."}</p>}
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
    <details className="rounded-control border border-rule bg-ink-raised p-4">
      <summary className="cursor-pointer font-semibold text-paper">Daily trends and activity breakdown</summary>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {[["Daily registrations", users], ["Daily incoming messages", contacts], ["Daily new subscription records", newsletter],
          ["Daily blog supports", engagement], ["Daily recorded user activity", activity]].map(([title, data]) => data ?
          <Timeline key={title} title={title} rows={daily(data.daily)} unit="records" series={[{ key: "count", label: "Records", seriesTone: "main" }]} /> :
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
  const stats = useResource(getStats);
  const [range, setRange] = useState({ range: "7d" });
  const defaultRange = range.range === "7d";
  const ready = range.range !== "custom" || Boolean(range.from && range.to);
  const business = useResource(getBusinessAnalytics, queryString(dateParams(range)), { enabled: !defaultRange && ready });
  const report = defaultRange ? stats.data?.businessSummary : business.data;
  const ai = stats.data?.chatSummary;
  const finance = stats.data?.financialSummary;
  const payment = finance?.transactions.data;
  const availability = stats.data?.availability;
  const total = payment ? formatPaise(payment.paid.totalPaise) : null;
  return <div className="workspace-page">
    <header className="overview-masthead">
      <div><p className="workspace-kicker">Portfolio workspace</p><h1 className="ui-page-title">Overview</h1>
        <p className="mt-2 text-small text-muted">Audience, activity, payments, and system readiness.</p>
        {stats.data?.generatedAt && <p className="mt-2 font-mono text-xs text-muted">Generated {displayDate(stats.data.generatedAt)}</p>}</div>
      <div className="flex flex-wrap items-end gap-2">
        <Range value={range} change={(change) => setRange((old) => ({ ...old, ...change }))} />
        <button type="button" className={control} onClick={() => { stats.refresh(); business.refresh(); }}>Refresh dashboard</button>
      </div>
    </header>
    <p className="text-small text-muted">Business reports use Asia/Kolkata. AI and payment metrics show the last seven days.</p>
    <LoadState resource={stats} />
    {stats.data && <MetricStrip label="Key portfolio metrics" items={[
      { title: "Registered users", value: stats.data.businessSummary?.users.data?.total, context: "Current accounts", to: routes.users },
      { title: "Unread messages", value: stats.data.businessSummary?.contacts.data?.unread, context: "Current inbox", to: routes.contacts },
      { title: "Recorded paid amount", value: total, wide: total?.length > 15, context: "7 days · test/live mode unverified", to: "/admin/financial" },
      { title: "AI conversations", value: ai?.conversations, context: "7 days · recorded", to: "/admin/chats" },
    ]} />}
    {!ready ? <p role="status">Choose both custom dates.</p> : !defaultRange && <LoadState resource={business} />}
    {report && <EditorialSection title="Activity and trends" description={`Selected period · generated ${displayDate(report.generatedAt)}`}>
      <div className="grid gap-4 md:grid-cols-2">
        {[["Incoming contacts", report.contacts.data], ["Recorded registrations", report.users.data]].map(([title, data]) => data ?
          <Timeline key={title} title={title} rows={daily(data.daily)} unit="records" series={[{ key: "count", label: "Records" }]} /> :
          <MetricSection key={title} title={title} description="Source unavailable." />)}
      </div>
    </EditorialSection>}
    {stats.data && <EditorialSection title="Operations" action={<Link className={linkClass} to="/admin/system">System health</Link>}>
      <div className="overview-operations">
        <div><h3 className="ui-heading">Availability</h3><ul>{[["Portfolio database", availability?.primary], ["Chat database", availability?.chat], ["Admin database", availability?.admin],
          ["API readiness", availability?.primary === "available" && availability?.admin === "available" ? "ready" : "unavailable"]].map(([label, value]) =>
          <li key={label}><span>{label}</span><Badge value={value} /></li>)}</ul></div>
        <div><h3 className="ui-heading">Payment diagnostics</h3><ul>{[["Failed customer emails", payment?.attempts.receiptFailures, "/admin/financial/receipts"],
          ["Failed webhooks", finance?.webhooks.data?.failed, "/admin/financial/webhook-events"], ["Pending attempts", payment?.attempts.pending, "/admin/financial/transactions"]].map(([label, value, to]) =>
          <li key={label}><Link className={linkClass} to={to}>{label}</Link><span className="font-mono">{value ?? "Unavailable"}</span></li>)}</ul></div>
      </div>
    </EditorialSection>}
    {report && <EditorialSection title="Recent activity" description={report.timelinePaymentSource !== "available" ? "Transaction activity is unavailable." : undefined}>
      <Table name="Recent activity across modules" rows={report.timeline.map((item) => ({ ...item, _id: item.source + item.id }))}
        empty="No available sources recorded activity in this period." columns={[
          ["Event", (item) => <RecordLink kind={item.source} id={item.id}>{item.title}</RecordLink>], ["Source", (item) => words(item.source.replaceAll("-", "_"))],
          ["Recorded", (item) => <time dateTime={item.timestamp}>{displayDate(item.timestamp)}</time>, "technical"],
        ]} />
    </EditorialSection>}
    {stats.data && <details className="editorial-disclosure"><summary>Seven-day AI and financial details</summary><div className="mt-4 grid gap-4 md:grid-cols-2">
      <Group title="Intelligence · last 7 days" fields={[["Turns", ai?.turns], ["Conversations", ai?.conversations], ["Cache hit rate", ai && percent(ai.cacheRate)],
        ["Median latency", ai && latency(ai.medianMs)]]} link={["Open AI Intelligence", "/admin/chats"]} />
      <Group title="Financial snapshot · last 7 days" fields={[["Paid services", payment && formatPaise(payment.paid.servicePaise)],
        ["Paid support", payment && formatPaise(payment.paid.supportPaise)], ["Recorded paid bookings", finance?.bookings.data?.confirmedPaid]]}
        unavailable="Historical test/live mode is unverified. Refund amounts are unavailable." link={["Open Financial Control Center", "/admin/financial"]} />
    </div></details>}
    {report ? <EditorialSection title="Business summaries"><BusinessSections report={report} /></EditorialSection> : defaultRange && stats.data && <p role="status">Business analytics are unavailable.</p>}
  </div>;
}
