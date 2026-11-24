import { useEffect, useState } from "react";

export const dateTime = (value) => value ? new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata",
}).format(new Date(value)) + " IST" : "Unavailable";
export const number = (value) => value == null ? "Unavailable" : Math.round(value).toLocaleString("en-IN");
export const percent = (value) => value == null ? "Unavailable" : (value * 100).toFixed(1) + "%";
export const latency = (value, overflow = 120000) => value == null ? "Unavailable" : (value >= overflow ? "≥" : "≈") + number(value) + " ms";
export const yesNo = (value) => value == null ? "Unavailable" : value ? "Yes" : "No";

export const panel = "rounded-xl border border-gray-200 bg-white p-4 sm:p-5 min-w-0";
export const control = "rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-700 disabled:opacity-50";
export const heading = "font-semibold text-lg text-slate-900";

export function useChatResource(load, query = "", { enabled = true, delay = 0 } = {}) {
  const [result, setResult] = useState(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const { data } = await load(query, controller.signal);
        if (!controller.signal.aborted) setResult({ load, query, attempt, data });
      } catch (error) {
        if (!controller.signal.aborted) setResult({ load, query, attempt, error });
      }
    }, delay);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [load, query, delay, attempt, enabled]);
  const current = result?.query === query && result.load === load && enabled ? result : null;
  return { data: current?.data, error: current?.error, pending: !current || current.attempt !== attempt,
    refresh: () => setAttempt((value) => value + 1) };
}

export function RangeControls({ value, onChange }) {
  return <>
    <label className="grid gap-1 text-sm">Date range
      <select className={control} value={value.range} onChange={(event) => onChange({ ...value, range: event.target.value })}>
        <option value="today">Today</option><option value="7d">Last 7 days</option>
        <option value="30d">Last 30 days</option><option value="90d">Last 90 days</option>
        <option value="custom">Custom (IST)</option>
      </select>
    </label>
    {value.range === "custom" && <>
      <label className="grid gap-1 text-sm">From
        <input className={control} type="date" value={value.from || ""} onChange={(event) => onChange({ ...value, from: event.target.value })} />
      </label>
      <label className="grid gap-1 text-sm">Through
        <input className={control} type="date" min={value.from || undefined} value={value.to || ""} onChange={(event) => onChange({ ...value, to: event.target.value })} />
      </label>
    </>}
  </>;
}

export function dateParams(value) {
  return value.range === "custom" ? { range: "custom", from: value.from, to: value.to } : { range: value.range };
}

export function queryString(params) {
  return new URLSearchParams(Object.entries(params).filter(([, value]) => value !== "" && value != null)).toString();
}

export function LoadState({ resource, empty = "No matching records." }) {
  if (resource.error) return <p role="alert" className="text-sm text-red-800">{resource.error.message}</p>;
  if (resource.pending) return <p role="status" className="text-sm text-slate-600">{resource.data ? "Refreshing…" : "Loading…"}</p>;
  if (!resource.data) return <p className="text-sm text-slate-600">{empty}</p>;
  return null;
}

export function Pager({ data, change, label = "Results" }) {
  if (!data) return null;
  return <nav aria-label={label + " pagination"} className="flex flex-wrap items-center gap-3 text-sm">
    <button className={control} type="button" disabled={data.page <= 1} onClick={() => change(data.page - 1)}>Previous</button>
    <span>{number(data.total)} {data.total === 1 ? label.toLowerCase().replace(/s$/, "") : label.toLowerCase()} · Page {data.page} of {Math.max(1, data.totalPages)}</span>
    <button className={control} type="button" disabled={data.page >= data.totalPages} onClick={() => change(data.page + 1)}>Next</button>
  </nav>;
}

export function Timeline({ title, rows, series, unit, format = number, max: maximum }) {
  const values = rows.flatMap((row) => series.map(({ key }) => row[key])).filter(Number.isFinite);
  const max = maximum ?? Math.max(1, ...values);
  return <section className={panel}>
    <h3 className={heading}>{title}</h3>
    {!values.length ? <p className="text-sm text-slate-600 mt-3">No recorded data for this range.</p> : <>
      <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-600">
        {series.map(({ key, label, color }) => <span key={key} className="flex items-center gap-2"><i className={"inline-block h-2 w-2 rounded-sm " + color} />{label}</span>)}
      </div>
      <div className="mt-3 flex gap-2 text-xs text-slate-500" aria-hidden="true">
        <div className="flex h-28 flex-col justify-between text-right"><span>{format(max)}</span><span>{format(0)}</span></div>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex h-28 items-end gap-px border-b border-slate-300">
            {rows.map((row) => <div key={row.day} className="flex h-full min-w-0 flex-1 items-end justify-center gap-px">
              {series.map(({ key, color }) => <i key={key} className={"max-w-6 flex-1 " + color} style={{ height: Number.isFinite(row[key]) ? (100 * row[key] / max) + "%" : "0%" }} />)}
            </div>)}
          </div>
          <div className="flex justify-between gap-2"><span>{rows[0].day}</span><span>{rows.at(-1).day}</span></div>
        </div>
      </div>
      <details className="mt-3 text-sm"><summary className="cursor-pointer text-teal-800">View data table ({unit})</summary>
        <div className="overflow-x-auto"><table className="mt-2 w-full text-left">
          <thead><tr><th scope="col">Date (IST)</th>{series.map(({ key, label }) => <th key={key} scope="col">{label}</th>)}</tr></thead>
          <tbody>{rows.map((row) => <tr key={row.day}><th scope="row">{row.day}</th>{series.map(({ key }) => <td key={key}>{format(row[key])}</td>)}</tr>)}</tbody>
        </table></div>
      </details>
    </>}
  </section>;
}

export function Distribution({ title, rows }) {
  return <section className={panel}>
    <h3 className={heading}>{title}</h3>
    {!rows?.length ? <p className="text-sm text-slate-600 mt-3">No recorded data.</p> :
      <ul className="mt-3 space-y-2">
        {rows.map(({ key, count, fraction }) => <li key={key}>
          <div className="flex justify-between gap-2 text-sm"><span>{key}</span><span>{number(count)} · {percent(fraction)}</span></div>
          <div className="mt-1 h-1.5 rounded-full bg-slate-100" aria-hidden="true"><div className="h-full rounded-full bg-teal-700" style={{ width: (100 * fraction) + "%" }} /></div>
        </li>)}
      </ul>}
  </section>;
}
