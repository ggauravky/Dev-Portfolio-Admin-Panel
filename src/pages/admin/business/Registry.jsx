import { control, panel } from "../../../components/ui/Primitives";
import { dateParams, queryString } from "../../../components/data/query";
import { FilterBar, LoadState, Pager, Range, Select } from "../../../components/data/Controls";
import { useResource } from "../../../hooks/useResource";
import { Badge, Box, Fields, Table, linkClass, RecordLink, routes } from "../../../components/data/Records";
import { formatPaise } from "../../../components/data/money";
import { displayDate, words } from "../../../components/data/format";
import { person, status, subscribed, Workspace } from "./Shared";
import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { getBusinessAnalytics, getBusinessRecords } from "../../../services/api";
import { EditorialSection, MetricStrip } from "../../../components/data/Editorial";
import { CopyAction } from "../../../components/ui/CopyAction";

const specifications = {
  users: { title: "Registered users", search: "Name or email", sorts: [["createdAt", "Registration"], ["lastLoginAt", "Last recorded login"]],
    filters: [["emailVerified", "Email verification", [["true", "Verified"], ["false", "Unverified"], ["unknown", "Unknown"]]]],
    dates: [["createdAt", "Registration"], ["lastLoginAt", "Last recorded login"]] },
  contacts: { title: "Contact inbox", search: "Name, subject, email or message", sorts: [["createdAt", "Received"], ["name", "Sender"], ["subject", "Subject"]],
    filters: [["status", "Message status", ["unread", "read", "replied"]]] },
  newsletters: { title: "Newsletter subscriptions", search: "Email address", sorts: [["createdAt", "Record created"], ["subscribedAt", "Subscribed"], ["unsubscribedAt", "Unsubscribed"]],
    filters: [["subscribed", "Subscription state", [["true", "Active"], ["false", "Unsubscribed"], ["unknown", "Unknown"]]]],
    dates: [["createdAt", "Record created"], ["subscribedAt", "Recorded subscription"], ["unsubscribedAt", "Recorded unsubscribe"]] },
  activity: { title: "User activity", search: "Title, description, action or domain", filters: [["status", "Status", ["success", "pending", "failed", "info"]],
    ["domain", "Domain", ["auth", "payment", "activity", "unclassified"]],
    ["actionType", "Action", ["login_success", "logout_success", "payment_success", "payment_failed", "receipt_downloaded", "unclassified"]]] },
  "blog-posts": { title: "Recorded articles", search: "Recorded title or slug", sorts: [["createdAt", "Record created"], ["supportCount", "Stored counter"], ["title", "Title"]] },
  "blog-supports": { title: "Blog support relationships" },
  transactions: { title: "Related Razorpay transactions", sorts: [["createdAt", "Record created"], ["paidAt", "Recorded paid date"]] },
  bookings: { title: "Related bookings", sorts: [["createdAt", "Record created"], ["preferredDate", "Preferred date"]] },
};

const relatedName = (link, kind) => link?.state === "linked" ?
  <RecordLink kind={kind} id={link.id}>{link.name || link.title || link.reference || "Open record"}</RecordLink> : words(link?.state);
const fieldDate = (key) => (row) => row[key] ? <time dateTime={row[key]}>{displayDate(row[key])}</time> : "Unknown";
const first = (kind, resolveLabel) => ["Record", (row) => <RecordLink kind={kind} id={row._id || row.reference}>{resolveLabel(row)}</RecordLink>];
const initials = (row) => person(row).split(/\s+/).filter(Boolean).slice(0, 2).map((word) => [...word][0].toUpperCase()).join("");
const verification = (value) => <Badge value={status(value).toLowerCase()} />;
const subscription = (value) => <Badge value={subscribed(value).toLowerCase()} />;

function columns(kind) {
  switch (kind) {
    case "users": return [["Name", (r) => <span className="directory-identity"><span className="identity-initials" aria-hidden="true">{initials(r)}</span>
      <RecordLink kind={kind} id={r._id}>{person(r)}</RecordLink></span>], ["Email", (r) => r.email], ["Verification", (r) => verification(r.emailVerified)],
      ["Registered", fieldDate("createdAt")], ["Last recorded login", fieldDate("lastLoginAt")]];
    case "newsletters": return [first(kind, (r) => r.email || "Subscription"), ["State", (r) => subscription(r.subscribed)], ["Subscribed", fieldDate("subscribedAt")], ["Unsubscribed", fieldDate("unsubscribedAt")], ["Created", fieldDate("createdAt")]];
    case "blog-posts": return [["Recorded article", (r) => <div><RecordLink kind={kind} id={r._id}>{r.title || r.slug || "Article"}</RecordLink><div className="mt-1 font-mono text-xs text-muted">{r.slug}</div></div>],
      ["Stored", (r) => r.supportCount ?? "Unknown", "number"], ["Relationships", (r) => r.actualSupportCount ?? "Unavailable", "number"],
      ["Consistency", (r) => words(r.consistency)], ["Created", fieldDate("createdAt")]];
    case "blog-supports": return [first(kind, () => "Open support record"), ["Article", (r) => r.article?.state === "linked" ? relatedName(r.article, "blog-posts") :
      r.article?.snapshotTitle ? `${r.article.snapshotTitle} (stored snapshot)` : words(r.article?.state)], ["User", (r) => relatedName(r.user, "users")],
      ["Article reference", (r) => r.article?.snapshotMismatch ? "Snapshot differs" : words(r.article?.state)], ["Recorded", fieldDate("createdAt")]];
    case "transactions": return [first(kind, (r) => <code>{r.internalReference || "Transaction"}</code>), ["Payment", (r) => words(r.status)], ["Amount", (r) => formatPaise(r.paise), "number"], ["Paid", fieldDate("paidAt")]];
    case "bookings": return [first(kind, (r) => r.service || "Booking"), ["Payment", (r) => words(r.paymentStatus)], ["Preferred date", fieldDate("preferredDate")], ["Time", (r) => r.preferredTime]];
    default: return [];
  }
}

function Inbox({ items, empty }) {
  if (!items.length) return <p className="text-muted">{empty}</p>;
  return <ul aria-label="Contact messages" className="editorial-index">
    {items.map((row) => <li key={row._id} className="inbox-row">
      <div className="min-w-0"><RecordLink kind="contacts" id={row._id}>{row.subject || "Message"}</RecordLink>
        <p className="mt-1 text-small text-muted">{row.name || "Sender unavailable"}</p>
        {row.preview && <p className="mt-1 text-small break-words">{row.preview}</p>}
      </div>
      <div className="inbox-meta"><Badge value={row.status} />{fieldDate("createdAt")(row)}</div>
    </li>)}
  </ul>;
}

const activityDay = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "long" });
function ActivityIndex({ items }) {
  if (!items.length) return <p className="text-muted">No matching activity events.</p>;
  const days = new Map();
  for (const row of items) {
    const day = Number.isFinite(Date.parse(row.createdAt)) ? activityDay.format(new Date(row.createdAt)) : "Date unavailable";
    if (!days.has(day)) days.set(day, []);
    days.get(day).push(row);
  }
  return <div className="space-y-4">
    {[...days].map(([day, rows]) => <section key={day}><h3 className="workspace-kicker">{day}</h3>
      <ul className="editorial-index">{rows.map((row) => <li key={row._id} className="inbox-row">
        <div className="min-w-0"><RecordLink kind="activity" id={row._id}>{row.title || "Activity event"}</RecordLink>
          <p className="mt-1 text-small text-muted">{words(row.domain)} · {words(row.actionType)}</p>
          {row.user?.state === "linked" && <p className="mt-1 text-small">{relatedName(row.user, "users")}</p>}</div>
        <div className="inbox-meta"><Badge value={row.status} />{fieldDate("createdAt")(row)}</div>
      </li>)}</ul>
    </section>)}
  </div>;
}

function NewsletterSummary() {
  const resource = useResource(getBusinessAnalytics, "range=7d");
  const newsletter = resource.data?.newsletter;
  if (!newsletter?.data) return <LoadState resource={resource} empty="Subscription summary unavailable." />;
  return <MetricStrip label="Current recorded subscription statistics" items={[["Recorded subscriptions", newsletter.data.total], ["Active", newsletter.data.active],
    ["Unsubscribed", newsletter.data.unsubscribed], ["Unknown", newsletter.data.unknown]].map(([title, value]) => ({ title, value }))} />;
}

export function Registry({ kind, owner, article, user }) {
  const spec = specifications[kind];
  const defaults = { range: "30d", useDates: false, page: 1, pageSize: 25 };
  const [filters, setFilters] = useState(defaults);
  const change = (patch) => setFilters((old) => ({ ...old, page: 1, ...patch }));
  const { useDates, range, from, to, ...query } = filters;
  const enabled = !useDates || range !== "custom" || Boolean(from && to);
  const params = queryString({ ...query, ...(useDates ? dateParams(filters) : {}), endpoint: kind, owner, blogPostId: article, userId: user });
  const resource = useResource(getBusinessRecords, params, { enabled, delay: query.search ? 250 : 0 });
  const data = resource.data;
  return <div className="space-y-4">
    <section className={panel} aria-label={spec.title + " filters"}>
      <FilterBar refresh={resource.refresh} reset={() => setFilters(defaults)}>
        {spec.search && <label className="grid min-w-0 flex-1 basis-56 gap-1 text-sm">Search<input type="search" maxLength={100} className={control}
          placeholder={spec.search} value={query.search || ""} onChange={(e) => change({ search: e.target.value })} /></label>}
        {(spec.filters || []).map(([key, name, options]) => <Select key={key} name={name} value={query[key]} change={(value) => change({ [key]: value })} options={[["", "All"], ...options]} />)}
        <Select name="Sort by" value={query.sortBy || "createdAt"} change={(sortBy) => change({ sortBy })} options={spec.sorts || [["createdAt", "Recorded date"]]} />
        <Select name="Direction" value={query.order || "desc"} change={(order) => change({ order })} options={[["desc", "Newest first"], ["asc", "Oldest first"]]} />
        <Select name="Page size" value={query.pageSize} change={(pageSize) => change({ pageSize })} options={[5, 10, 25, 50]} />
      </FilterBar>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="flex items-center gap-2 self-center text-sm"><input type="checkbox" checked={useDates}
          onChange={(e) => change({ useDates: e.target.checked, dateField: e.target.checked ? query.dateField : undefined })} />Filter by date</label>
        {useDates && <>{spec.dates && <Select name="Date field" value={query.dateField || "createdAt"} change={(dateField) => change({ dateField })} options={spec.dates} />}
          <Range value={filters} change={change} /></>}
        {kind === "activity" && !owner && <UserFilter value={user} />}
      </div>
    </section>
    {enabled ? <LoadState resource={kind === "contacts" && resource.error?.status === 503 ? { ...resource, error: { message: "Contact data unavailable. Use Refresh to try again." } } : resource} /> : <p role="status">Choose both custom dates.</p>}
    {data && <EditorialSection title={kind === "contacts" ? "Messages" : kind === "activity" ? "Recorded events" : spec.title + " results"}>
      {kind === "contacts" ? <Inbox items={data.items} empty={query.search || query.status || useDates ? "No matching messages." : "No messages recorded."} /> :
        kind === "activity" ? <ActivityIndex items={data.items} /> :
          <Table name={spec.title + " results"} columns={columns(kind)} rows={data.items.map((row) => row.reference ? { ...row, id: row.reference } : row)} empty="No matching records." />}
      <div className="mt-3"><Pager data={data} change={(page) => change({ page })} /></div>
    </EditorialSection>}
  </div>;
}

function UserFilter({ value }) {
  const [, setSearch] = useSearchParams();
  const [entry, setEntry] = useState(value || "");
  return <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); setSearch(entry ? { user: entry.toLowerCase() } : {}); }}>
    <label className="grid gap-1 text-sm">User ID<input value={entry} pattern="[0-9a-fA-F]{24}" maxLength={24} className={control} onChange={(e) => setEntry(e.target.value.trim())} /></label>
    <button className={control} type="submit">Apply user filter</button>
  </form>;
}

function ContactActions({ email, subject, canReply }) {
  const reply = canReply && typeof email === "string" && /^[A-Za-z0-9._+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(email);
  return <div className="mt-3 flex flex-wrap items-center gap-2">
    <CopyAction value={email} label="Email" /><CopyAction value={subject} label="Subject" />
    {reply && <a className={control} href={"mailto:" + encodeURIComponent(email).replace("%40", "@") + (subject ? "?subject=" + encodeURIComponent("Re: " + subject.replace(/[\x00-\x1F\x7F]/g, " ")) : "")}>
      Open email client</a>}
    {reply && <p className="text-xs text-muted">The email client opens separately. The recorded message status stays the same.</p>}
  </div>;
}

export function Inspector({ kind, id }) {
  const resource = useResource(getBusinessRecords, queryString({ endpoint: kind, id }));
  const r = resource.data;
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center gap-3"><Link to={routes[kind]} className={linkClass}>Back to {specifications[kind].title.toLowerCase()}</Link>
      <button type="button" className={control} onClick={resource.refresh}>Refresh record</button></div>
    <LoadState resource={resource} />
    {r && <RecordDetails kind={kind} record={r} />}
  </div>;
}

function RecordDetails({ kind, record: r }) {
  if (kind === "users") return <>
    <EditorialSection title={person(r)} action={<span className="identity-initials" aria-hidden="true">{initials(r)}</span>}>
      <Fields fields={[["User ID", r._id, true], ["Email", r.email], ["Email verification", verification(r.emailVerified)],
        ["Registered", fieldDate("createdAt")(r)], ["Last recorded login", fieldDate("lastLoginAt")(r)]]} />
    </EditorialSection>
    <EditorialSection title="Profile information"><Fields fields={[["Given name", r.givenName], ["Family name", r.familyName],
      ["Bio", r.bio], ["Location", r.location], ["Website", r.website], ["Profile last updated", fieldDate("updatedAt")(r)]]} /></EditorialSection>
    <Box title="Recorded welcome emails"><Fields fields={[["Last welcome email", displayDate(r.lastWelcomeEmailAt)], ["Welcome email count", r.welcomeEmailSentCount],
      ["Last welcome-back email", displayDate(r.lastWelcomeBackEmailAt)], ["Welcome-back email count", r.welcomeBackEmailSentCount], ["Last login email type", words(r.lastLoginEmailType)]]} /></Box>
    <RelatedUser id={r._id} />
  </>;
  if (kind === "contacts") return <EditorialSection title={r.subject || "Message"} action={<Badge value={r.status} />}><Fields fields={[["Sender", r.name], ["Email", r.email],
    ["Received", fieldDate("createdAt")(r)], ["Updated", fieldDate("updatedAt")(r)]]} />
    <p className="transcript-text mt-4">{r.message}</p><ContactActions email={r.email} subject={r.subject} canReply /></EditorialSection>;
  if (kind === "newsletters") return <Box title={r.email || "Subscription"}><Fields fields={[["State", subscribed(r.subscribed)], ["Subscribed timestamp", displayDate(r.subscribedAt)],
    ["Unsubscribe timestamp", displayDate(r.unsubscribedAt)], ["Record created", displayDate(r.createdAt)], ["Record updated", displayDate(r.updatedAt)]]} />
    <p className="text-sm text-muted">Resubscription can preserve the original subscribed date and clear the unsubscribe date.</p><ContactActions email={r.email} /></Box>;
  if (kind === "activity") return <Box title={r.title || "Activity event"}><Fields fields={[["Action", words(r.actionType)], ["Domain", words(r.domain)], ["Status", words(r.status)],
    ["User", relatedName(r.user, "users")], ["Transaction", relatedName(r.transaction, "transactions")], ["Recorded", displayDate(r.createdAt)], ["Description", r.description],
    ["Recorded amount", r.amount], ["Currency", r.amount == null ? null : r.currency], ["Order ID", r.orderId], ["Payment ID", r.paymentId], ["Receipt kind", r.receiptKind]]} /></Box>;
  if (kind === "blog-posts") return <>
    <Box title={r.title || "Recorded article"}><Fields fields={[["Slug", r.slug], ["Stored support count", r.supportCount], ["Relationship count", r.actualSupportCount],
      ["Consistency", words(r.consistency)], ["Created", displayDate(r.createdAt)]]} />
      {r.publicUrl && <a className={linkClass} href={r.publicUrl} target="_blank" rel="noopener noreferrer">Open Portfolio article</a>}
    </Box><Registry kind="blog-supports" article={r._id} />
  </>;
  if (kind === "blog-supports") return <Box title="Recorded blog support"><Fields fields={[["Article", relatedName(r.article, "blog-posts")], ["User", relatedName(r.user, "users")],
    ["Recorded", displayDate(r.createdAt)], ["Stored article snapshot", r.article?.snapshotTitle], ["Snapshot comparison", r.article?.snapshotMismatch ? "Differs from the stored article" : null]]} /></Box>;
  return null;
}

function RelatedUser({ id }) {
  const [kind, setKind] = useState("activity");
  return <div className="space-y-3">
    <EditorialSection title="Related records" description="Linked by the recorded user ID.">
      <div className="workspace-tabs" role="group" aria-label="Related record type">{[["activity", "Activity"], ["transactions", "Transactions"],
        ["bookings", "Bookings"], ["blog-supports", "Blog supports"]].map(([key, label]) => <button type="button" key={key} aria-pressed={kind === key} onClick={() => setKind(key)}>{label}</button>)}</div>
    </EditorialSection>
    <Registry key={kind} kind={kind} owner={id} />
  </div>;
}

export default function BusinessPage({ kind }) {
  const { id } = useParams();
  const [search] = useSearchParams();
  const user = search.get("user") || undefined;
  const engagement = kind === "blog-posts" || kind === "blog-supports";
  const description = kind === "newsletters" ? "Recorded subscription state and timestamps. Historical records with no stored flag are unknown." :
    engagement ? "Blog support is a non-monetary relationship. Article records can be created during support." :
    kind === "activity" ? "The Portfolio records selected sign-in and payment events." : undefined;
  return <Workspace title={engagement ? "Blog engagement" : specifications[kind].title} description={description}>
    {kind === "newsletters" && !id && <NewsletterSummary />}
    {engagement && <nav className="workspace-tabs" aria-label="Blog engagement views">
      <Link to={routes["blog-posts"]} aria-current={kind === "blog-posts" ? id ? "location" : "page" : undefined}>Recorded articles</Link>
      <Link to={routes["blog-supports"]} aria-current={kind === "blog-supports" ? id ? "location" : "page" : undefined}>Support relationships</Link>
    </nav>}
    {id ? <Inspector key={kind + id} kind={kind} id={id} /> : <Registry key={kind + (user || "")} kind={kind} user={kind === "activity" ? user : undefined} />}
  </Workspace>;
}
