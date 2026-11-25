import { number } from "./format";
import { Button, InlineAlert, control } from "../ui/Primitives";

export function FilterBar({ children, refresh, reset, className = "" }) {
  return <div className={`flex flex-wrap items-end gap-3 ${className}`}>
    {children}
    {refresh && <Button onClick={refresh}>Refresh</Button>}
    {reset && <Button variant="ghost" onClick={reset}>Clear filters</Button>}
  </div>;
}

export function Select({ name, value, change, options }) {
  return <label className="grid gap-1 min-w-0 text-sm text-muted">
    {name}
    <select value={value || ""} onChange={(event) => change(event.target.value)} className={control}>
      {options.map((option) => <option value={Array.isArray(option) ? option[0] : option} key={Array.isArray(option) ? option[0] : option}>
        {Array.isArray(option) ? option[1] : String(option).replaceAll("_", " ")}
      </option>)}
    </select>
  </label>;
}

export function Range({ value, change, chat = false }) {
  return <>
    <Select name="Date range" value={value.range} change={(range) => change({ range })}
      options={[["today","Today"],["7d","Last 7 days"],["30d","Last 30 days"],chat ? ["90d","Last 90 days"] : ["month","Current month"],["custom","Custom (IST)"]]} />
    {value.range === "custom" && <>
      <label className="grid gap-1 text-sm text-muted">From
        <input className={control} type="date" value={value.from || ""} onChange={(e) => change({ from: e.target.value })} />
      </label>
      <label className="grid gap-1 text-sm text-muted">Through
        <input className={control} type="date" min={value.from || undefined} value={value.to || ""} onChange={(e) => change({ to: e.target.value })} />
      </label>
    </>}
  </>;
}

export function RangeControls({ value, onChange }) {
  return <Range value={value} change={(patch) => onChange({ ...value, ...patch })} chat />;
}

export function LoadState({ resource, empty = "No matching records." }) {
  if (resource.error) return <InlineAlert tone="error">{resource.error.message}</InlineAlert>;
  if (resource.pending) return <InlineAlert>{resource.data ? "Refreshing…" : "Loading…"}</InlineAlert>;
  if (!resource.data) return <InlineAlert>{empty}</InlineAlert>;
  return null;
}

export function Pager({ data, change, label = "Results" }) {
  if (!data) return null;
  return <nav aria-label={label + " pagination"} className="flex flex-wrap items-center gap-3 text-sm">
    <Button disabled={data.page <= 1} onClick={() => change(data.page - 1)}>Previous</Button>
    <span className="font-mono text-xs text-muted">{number(data.total)} {data.total === 1 ? label.toLowerCase().replace(/s$/, "") : label.toLowerCase()} · Page {data.page} of {Math.max(1, data.totalPages)}</span>
    <Button disabled={data.page >= data.totalPages} onClick={() => change(data.page + 1)}>Next</Button>
  </nav>;
}
