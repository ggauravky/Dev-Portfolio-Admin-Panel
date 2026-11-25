import { Link } from "react-router-dom";
import { panel, heading, Tag } from "../ui/Primitives";

export { routes, linkClass };
const routes = {
  users: "/admin/users", contacts: "/admin/contacts", newsletters: "/admin/newsletter", activity: "/admin/activity",
  "blog-posts": "/admin/blog-engagement", "blog-supports": "/admin/blog-engagement/supports", "audit-events": "/admin/security/audit",
  bookings: "/admin/bookings", transactions: "/admin/financial/transactions",
};
const linkClass = "ui-text-link";

export function Badge({ value }) {
  const color = ["paid", "sent", "processed", "linked", "success", "available"].includes(value) ? "text-success" :
    ["failed", "inconsistent", "potential_inconsistency", "confirmed_structural_mismatch"].includes(value) ? "text-error" :
    ["pending", "authorized", "processing", "needs_review", "unread"].includes(value) ? "text-warning" : "text-muted";
  return <Tag tone={color}>{value ? String(value).replaceAll("_", " ") : "Not recorded"}</Tag>;
}

export function Fields({ fields }) {
  return <dl className="my-3 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
    {fields.map(([name, value, technical]) => <div key={name} className="min-w-0">
      <dt className="text-xs text-muted">{name}</dt>
      <dd className={`mt-1 whitespace-pre-wrap [overflow-wrap:anywhere] ${technical || typeof value === "number" ? "font-mono tabular-nums" : ""}`}>{value == null || value === "" ? "Not recorded" : value}</dd>
    </div>)}
  </dl>;
}

export function Table({ name, columns, rows, empty = "No matching records in this range." }) {
  if (!rows.length) return <p className="py-3 text-sm text-muted">{empty}</p>;
  return <div role="region" aria-label={name} tabIndex={0} className="data-scroll">
    <table className="data-table">
      <caption className="sr-only">{name}</caption>
      <thead><tr>
        {columns.map(([title, , options]) => <th scope="col" key={title} data-align={options === "number" ? "right" : undefined}>{title}</th>)}
      </tr></thead>
      <tbody>{rows.map((row, index) => <tr key={row._id || row.id + ":" + index}>
        {columns.map(([title, read, options], i) => {
          const Cell = i === 0 ? "th" : "td";
          return <Cell scope={i === 0 ? "row" : undefined} key={title}
            data-align={options === "number" ? "right" : undefined}
            className={`max-w-72 [overflow-wrap:anywhere] ${options ? "data-technical" : ""}`}>{read(row)}</Cell>;
        })}
      </tr>)}</tbody>
    </table>
  </div>;
}

export function RecordLink({ kind, id, children }) {
  return id ? <Link className={linkClass} to={routes[kind] + "/" + encodeURIComponent(id)}>{children}</Link> : children;
}

export function Box({ title, children }) {
  return <section className={panel}><h2 className={heading}>{title}</h2>{children}</section>;
}

export function MetricSection({ title, description, children, fields }) {
  return <section className={panel}><h2 className={heading}>{title}</h2>
    {description && <p className="mt-1 text-sm text-muted">{description}</p>}
    {fields && <Fields fields={fields.map(([name, value]) => [name, value ?? "Unavailable", typeof value === "number"])} />}
    {children}
  </section>;
}
