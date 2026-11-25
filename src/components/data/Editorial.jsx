import { Link } from "react-router-dom";
import { heading } from "../ui/Primitives";

export function EditorialSection({ title, description, action, children, className = "" }) {
  return <section className={`editorial-section ${className}`}>
    <header className="editorial-section-header">
      <div><h2 className={heading}>{title}</h2>{description && <p className="mt-1 text-small text-muted">{description}</p>}</div>
      {action}
    </header>
    {children}
  </section>;
}

export function MetricStrip({ items, label, columns }) {
  return <dl className="metric-strip" aria-label={label} data-columns={columns}>
    {items.map(({ title, value, context, to, wide }) => <div key={title} className="metric-cell" data-wide={wide ? "true" : undefined}>
      <dt>{to ? <Link className="ui-text-link" to={to}>{title}</Link> : title}</dt>
      <dd>{value ?? "Unavailable"}</dd>
      {context && <dd className="metric-context">{context}</dd>}
    </div>)}
  </dl>;
}
