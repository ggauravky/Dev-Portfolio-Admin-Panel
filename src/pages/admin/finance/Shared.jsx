import { Link } from "react-router-dom";
import { control, panel, heading } from "../chat/Shared";

export const label = (value) => value ? String(value).replaceAll("_", " ") : "Not recorded";
export const statusList = ["created", "pending", "authorized", "paid", "failed", "refunded"];
export const emailStates = ["not_sent", "processing", "sent", "failed"];
export const hookStates = ["processing", "processed", "failed", "ignored"];
export const categories = ["authentication", "network", "provider", "order_creation", "unclassified"];

export function financePath(view, id) {
  const base = view === "bookings" || view === "support-payments" ? "/admin/" + view : "/admin/financial" + (view === "overview" ? "" : "/" + view);
  return id && /^[a-f0-9]{24}$/i.test(id) ? base + "/" + id : base;
}

export function Select({ name, value, change, options }) {
  return <label className="grid gap-1 min-w-0 text-sm text-slate-700">
    {name}
    <select value={value || ""} onChange={(event) => change(event.target.value)} className={control}>
      {options.map((option) => <option value={Array.isArray(option) ? option[0] : option} key={Array.isArray(option) ? option[0] : option}>
        {Array.isArray(option) ? option[1] : label(option)}
      </option>)}
    </select>
  </label>;
}

export function Range({ value, change }) {
  return <>
    <Select name="Date range" value={value.range} change={(range) => change({ range })}
      options={[["today","Today"],["7d","Last 7 days"],["30d","Last 30 days"],["month","Current month"],["custom","Custom (IST)"]]} />
    {value.range === "custom" && <>
      <label className="grid gap-1 text-sm text-slate-700">From
        <input className={control} type="date" value={value.from || ""} onChange={(e) => change({ from: e.target.value })} />
      </label>
      <label className="grid gap-1 text-sm text-slate-700">Through
        <input className={control} type="date" min={value.from || undefined} value={value.to || ""} onChange={(e) => change({ to: e.target.value })} />
      </label>
    </>}
  </>;
}

export function Badge({ value }) {
  const color = ["paid", "sent", "processed", "linked"].includes(value) ? "bg-teal-100 text-teal-900" :
    ["failed", "inconsistent", "potential_inconsistency", "confirmed_structural_mismatch"].includes(value) ? "bg-rose-100 text-rose-900" :
    ["pending", "authorized", "processing", "needs_review"].includes(value) ? "bg-amber-100 text-amber-900" :
    "bg-slate-100 text-slate-700";
  return <span className={"inline-block rounded px-1.5 py-0.5 text-xs font-medium " + color}>{label(value)}</span>;
}

export function Fields({ fields }) {
  return <dl className="my-3 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
    {fields.map(([name, value]) => <div key={name} className="min-w-0">
      <dt className="text-xs text-slate-600">{name}</dt>
      <dd className="mt-1 whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-slate-900">{value == null || value === "" ? "Not recorded" : value}</dd>
    </div>)}
  </dl>;
}

export function Table({ name, columns, rows, empty = "No matching records in this range." }) {
  if (!rows.length) return <p className="py-3 text-sm text-slate-600">{empty}</p>;
  return <div role="region" aria-label={name} tabIndex={0} className="overflow-x-auto focus-visible:outline focus-visible:outline-teal-700">
    <table className="w-full min-w-max text-left text-sm">
      <caption className="sr-only">{name}</caption>
      <thead className="border-y border-slate-200 text-xs text-slate-600"><tr>
        {columns.map(([title]) => <th scope="col" className="p-2" key={title}>{title}</th>)}
      </tr></thead>
      <tbody>{rows.map((row, index) => <tr key={row._id || row.id + ":" + index} className="border-b border-slate-100 hover:bg-slate-50">
        {columns.map(([title, read], i) => {
          const Cell = i === 0 ? "th" : "td";
          return <Cell scope={i === 0 ? "row" : undefined} key={title}
            className="max-w-72 p-2 align-top font-normal break-words [overflow-wrap:anywhere]">{read(row)}</Cell>;
        })}
      </tr>)}</tbody>
    </table>
  </div>;
}

export function RecordLink({ view, id, children }) {
  if (typeof id !== "string" || !/^[a-f0-9]{24}$/i.test(id)) return <span>{children}</span>;
  return <Link className="font-medium text-teal-800 underline" to={financePath(view, id)}>{children}</Link>;
}

export function Box({ title, children }) {
  return <section className={panel}><h2 className={heading}>{title}</h2>{children}</section>;
}
