import { useId } from "react";
import { Link } from "react-router-dom";

export const control = "ui-control";
export const panel = "ui-panel";
export const heading = "ui-heading";
const variants = { primary: "ui-primary", secondary: "", ghost: "ui-ghost", link: "ui-text-link", destructive: "ui-destructive" };

export function Button({ variant = "secondary", className = "", type = "button", disabled, loading = false, children, ...props }) {
  return <button {...props} type={type} className={`${control} ${variants[variant] || ""} ${className}`} disabled={disabled || loading}
    aria-busy={loading || undefined}>{children}</button>;
}

export function Icon({ name, className = "h-4 w-4" }) {
  const paths = { arrow: "M4 12h15m-6-6 6 6-6 6", close: "m6 6 12 12M18 6 6 18" };
  return <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
    <path d={paths[name]} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>;
}

export function IconButton({ name, label, className = "", ...props }) {
  return <Button {...props} variant="ghost" className={`ui-icon ${className}`} aria-label={label}><Icon name={name} /></Button>;
}

export function TextLink({ to, className = "", children, ...props }) {
  const shared = { ...props, className: `ui-text-link ${className}` };
  return to ? <Link {...shared} to={to}>{children}</Link> : <a {...shared}>{children}</a>;
}

export function Field({ label, hint, error, id, as: Control = "input", action, className = "", ...props }) {
  const fallbackId = useId();
  const fieldId = id || fallbackId;
  const messageId = error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined;
  const describedBy = [props["aria-describedby"], messageId].filter(Boolean).join(" ") || undefined;
  return <div className={`grid min-w-0 gap-1 ${className}`}>
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <label htmlFor={fieldId} className="text-small text-paper">{label}</label>{action}
    </div>
    <Control {...props} id={fieldId} className={control} aria-invalid={error ? true : props["aria-invalid"]} aria-describedby={describedBy} />
    {messageId && <p id={messageId} className={error ? "text-small text-error" : "text-small text-muted"}>{error || hint}</p>}
  </div>;
}

export function PageHeader({ title, description, children }) {
  return <header className="min-w-0"><h1 className="ui-page-title">{title}</h1>
    {description && <p className="mt-2 max-w-prose text-small text-muted">{description}</p>}{children}</header>;
}

export function Rule({ className = "" }) {
  return <hr className={`ui-rule ${className}`} />;
}

export function Tag({ children, tone = "text-muted" }) {
  return <span className={`ui-status ${tone}`}>{children}</span>;
}

export function InlineAlert({ children, tone = "info", className = "", ...props }) {
  return <p {...props} role={tone === "error" ? "alert" : "status"} data-tone={tone} className={`ui-alert ${className}`}>{children}</p>;
}

export function SkipLink() {
  return <a className="ui-skip ui-control" href="#main-content" onClick={() => document.getElementById("main-content")?.focus()}>
    Skip to main content
  </a>;
}
