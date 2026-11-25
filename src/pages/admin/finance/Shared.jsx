import { TextLink } from "../../../components/ui/Primitives";

export const label = (value) => value ? String(value).replaceAll("_", " ") : "Not recorded";
export const statusList = ["created", "pending", "authorized", "paid", "failed", "refunded"];
export const emailStates = ["not_sent", "processing", "sent", "failed"];
export const hookStates = ["processing", "processed", "failed", "ignored"];
export const categories = ["authentication", "network", "provider", "order_creation", "unclassified"];

export function financePath(view, id) {
  const base = view === "bookings" || view === "support-payments" ? "/admin/" + view : "/admin/financial" + (view === "overview" ? "" : "/" + view);
  return id && /^[a-f0-9]{24}$/i.test(id) ? base + "/" + id : base;
}

export function RecordLink({ view, id, children }) {
  if (typeof id !== "string" || !/^[a-f0-9]{24}$/i.test(id)) return <span>{children}</span>;
  return <TextLink to={financePath(view, id)}>{children}</TextLink>;
}
