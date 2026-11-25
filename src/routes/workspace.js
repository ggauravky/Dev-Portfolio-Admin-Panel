import { matchRoutes } from "react-router-dom";

export const aiViews = { overview: "Overview", conversations: "Conversations", operations: "Operations" };
export const financeViews = { overview: "Overview", transactions: "Transactions", bookings: "Bookings", "support-payments": "Support payments",
  receipts: "Receipts", "webhook-events": "Webhook events", reconciliation: "Reconciliation", "legacy-payments": "Legacy payments" };

export const financePath = (view = "overview") => view === "overview" ? "/admin/financial" :
  ["bookings", "support-payments"].includes(view) ? `/admin/${view}` : `/admin/financial/${view}`;

export function aiView(search) {
  const view = new URLSearchParams(search).get("view");
  return Object.hasOwn(aiViews, view) ? view : "overview";
}

export function intendedDestination(value) {
  if (typeof value !== "string" || /[\\\u0000-\u001f\u007f]/.test(value)) return "/admin";
  const pathname = value.split(/[?#]/, 1)[0];
  if (!/^\/admin(?:\/[a-z0-9-]+)*\/?$/i.test(pathname) || /^\/admin\/login(?:\/|$)/i.test(pathname)) return "/admin";
  return value;
}

const route = (name, label, path, group, icon, page, props = {}, parent) => ({ name, label, path, group, icon, page, props, parent });
const record = (path) => `${path}/:id?`;
export const workspaceRoutes = [
  route("overview", "Overview", "/admin", "Workspace", "overview", "dashboard"),
  route("contacts", "Contacts", record("/admin/contacts"), "Workspace", "mail", "business", { kind: "contacts" }),
  route("newsletter", "Newsletter", record("/admin/newsletter"), "Workspace", "newsletter", "business", { kind: "newsletters" }),
  route("users", "Registered users", record("/admin/users"), "Workspace", "users", "business", { kind: "users" }),
  route("ai", "AI Intelligence", "/admin/chats", "Intelligence", "chat", "chats"),
  ...Object.entries(financeViews).map(([view, label]) => route(view === "overview" ? "finance" : view,
    view === "overview" ? "Financial overview" : label, ["overview", "reconciliation"].includes(view) ? financePath(view) : record(financePath(view)),
    ["overview", "transactions", "bookings", "support-payments"].includes(view) ? "Business" : null,
    { overview: "finance", transactions: "transactions", bookings: "calendar", "support-payments": "support" }[view],
    "finance", { fixedView: view }, view === "overview" ? undefined : "finance")),
  ...["overview", "bookings", "support-payments"].map((view) => route(view === "overview" ? "finance" : view, financeViews[view],
    view === "overview" ? "/admin/financial/overview" : record(`/admin/financial/${view}`), null, null,
    "finance", { fixedView: view }, view === "overview" ? undefined : "finance")),
  route("blog", "Blog engagement", record("/admin/blog-engagement"), "Engagement", "article", "business", { kind: "blog-posts" }),
  route("blog-supports", "Support relationships", record("/admin/blog-engagement/supports"), null, null, "business", { kind: "blog-supports" }, "blog"),
  route("activity", "User activity", record("/admin/activity"), "Engagement", "activity", "business", { kind: "activity" }),
  route("security", "Security", "/admin/security", "System", "shield", "security"),
  route("audit", "Audit history", record("/admin/security/audit"), null, null, "security", { audit: true }, "security"),
  route("system", "System health", "/admin/system", "System", "system", "system"),
  route("settings", "Settings", "/admin/settings", "System", "settings", "system", { settings: true }),
];

export const navigation = workspaceRoutes.filter((entry) => entry.group);
const links = new Map(workspaceRoutes.slice().reverse().map((entry) => [entry.name, entry]));
export const linkFor = (entry) => entry.path.replace(/\/:id\?$/, "");
const recordKinds = { users: "users", contacts: "contacts", newsletters: "newsletter", activity: "activity", "blog-posts": "blog",
  "blog-supports": "blog-supports", "audit-events": "audit", bookings: "bookings", transactions: "transactions" };
export const recordPaths = Object.fromEntries(Object.entries(recordKinds).map(([kind, name]) => [kind, linkFor(links.get(name))]));

export function workspaceLocation(pathname, search = "") {
  const match = matchRoutes(workspaceRoutes, pathname)?.at(-1);
  if (!match) return { title: "Page unavailable", crumbs: [{ label: "Page unavailable" }] };
  const entry = links.get(match.route.name);
  const parent = links.get(entry.parent);
  const detail = Boolean(match.params.id);
  const view = entry.name === "ai" ? aiView(search) : null;
  const crumbs = [...(parent ? [{ label: parent.label, to: linkFor(parent) }] : []), { label: entry.label }];
  if (detail || view && view !== "overview") {
    crumbs.at(-1).to = linkFor(entry);
    crumbs.push({ label: detail ? "Record details" : aiViews[view] });
  }
  const parentIsNavigation = navigation.some((item) => item.name === entry.name);
  return { title: crumbs.at(-1).label, active: parentIsNavigation ? entry.name : parent?.name,
    current: parentIsNavigation && !detail ? "page" : "location", crumbs };
}
