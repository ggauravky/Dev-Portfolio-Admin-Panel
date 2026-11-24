import { Link } from "react-router-dom";
import AdminLayout from "../../../components/AdminLayout";
import { control, panel, heading, dateTime } from "../chat/Shared";
import { Fields } from "../finance/Shared";

export const routes = {
  users: "/admin/users", contacts: "/admin/contacts", newsletters: "/admin/newsletter", activity: "/admin/activity",
  "blog-posts": "/admin/blog-engagement", "blog-supports": "/admin/blog-engagement/supports", "audit-events": "/admin/security/audit",
  bookings: "/admin/bookings", transactions: "/admin/financial/transactions",
};
export const linkClass = "font-medium text-teal-800 underline [overflow-wrap:anywhere]";
export const words = (value) => typeof value === "string" && value ? value.replaceAll("_", " ") : "Unknown";
export const displayDate = (value) => value && Number.isFinite(Date.parse(value)) ? dateTime(value) : "Unknown";
export const status = (value) => value === true ? "Verified" : value === false ? "Unverified" : "Unknown";
export const subscribed = (value) => value === true ? "Active" : value === false ? "Unsubscribed" : "Unknown";
export const person = (row) => row.displayName || row.name || "Name unrecorded";

export function RecordLink({ kind, id, children }) {
  return id ? <Link className={linkClass} to={routes[kind] + "/" + encodeURIComponent(id)}>{children}</Link> : children;
}

export function Workspace({ title, description, children, current }) {
  const navigation = [["Users", routes.users], ["Activity", routes.activity], ["Blog engagement", routes["blog-posts"]], ["Security", "/admin/security"],
    ["System health", "/admin/system"], ["Settings", "/admin/settings"]];
  return <AdminLayout><div className="min-w-0 space-y-5 px-4 sm:px-0">
    <header><h1 className="text-3xl font-bold text-slate-900">{title}</h1>{description && <p className="mt-2 text-sm text-slate-600">{description}</p>}</header>
    <nav aria-label="Operations views" className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
      {navigation.map(([name, path]) => <Link key={path} to={path} aria-current={current === path ? "page" : undefined}
        className={control + (current === path ? " !border-teal-700 !bg-teal-50" : "")}>{name}</Link>)}
    </nav>
    {children}
  </div></AdminLayout>;
}

export function MetricSection({ title, description, children, fields }) {
  return <section className={panel}><h2 className={heading}>{title}</h2>
    {description && <p className="mt-1 text-sm text-slate-600">{description}</p>}
    {fields && <Fields fields={fields.map(([name, value]) => [name, value ?? "Unavailable"])} />}
    {children}
  </section>;
}
