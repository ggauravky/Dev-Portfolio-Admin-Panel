import { number, percent } from "./format";
import { panel, heading } from "../ui/Primitives";
import { Table } from "./Records";

export function Timeline({ title, rows, series, unit, format = number, max: maximum }) {
  const values = rows.flatMap((row) => series.map(({ key }) => row[key])).filter(Number.isFinite);
  const max = maximum ?? Math.max(1, ...values);
  const graph = rows.map((row) => ({ ...row, _id: row.day }));
  return <section className={panel}>
    <h3 className={heading}>{title}</h3>
    {!values.length ? <p className="mt-3 text-small text-muted">No recorded data for this range.</p> : <>
      <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted" aria-label="Chart legend">
        {series.map(({ key, label, seriesTone }) => <span key={key} className="flex items-center gap-2">
          <i className="chart-series inline-block h-2 w-2" data-series={seriesTone} aria-hidden="true" />{label}
        </span>)}
      </div>
      <div className="chart-axis mt-3 flex gap-2 text-xs" aria-hidden="true">
        <div className="flex h-28 flex-col justify-between text-right"><span>{format(max)}</span><span>{format(0)}</span></div>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="chart-plot flex h-28 items-end gap-px">
            {rows.map((row) => <div key={row.day} className="flex h-full min-w-0 flex-1 items-end justify-center gap-px">
              {series.map(({ key, seriesTone }) => <i key={key} className="chart-series max-w-6 flex-1" data-series={seriesTone}
                style={Number.isFinite(row[key]) ? { height: `${100 * row[key] / max}%` } : { visibility: "hidden" }} />)}
            </div>)}
          </div>
          <div className="flex flex-wrap justify-between gap-x-2"><span>{rows[0].day}</span><span>{rows.at(-1).day}</span></div>
        </div>
      </div>
      <details className="mt-3 text-small"><summary>View data table ({unit})</summary>
        <div className="mt-2"><Table name={title + " data"} rows={graph} columns={[
          ["Date (IST)", (row) => row.day, "technical"], ...series.map(({ key, label }) => [label, (row) => Number.isFinite(row[key]) ? format(row[key]) : "Unavailable", "number"]),
        ]} /></div>
      </details>
    </>}
  </section>;
}

export function Distribution({ title, rows }) {
  return <section className={panel}>
    <h3 className={heading}>{title}</h3>
    {rows?.length ? <ul className="mt-3 space-y-3">
      {rows.map(({ key, count, fraction }) => <li key={key}>
        <div className="flex flex-wrap justify-between gap-x-2 text-small"><span className="[overflow-wrap:anywhere]">{key}</span>
          <span className="font-mono tabular-nums">{number(count)} · {percent(fraction)}</span></div>
        {Number.isFinite(fraction) && <div className="data-meter mt-1" aria-hidden="true"><span style={{ width: `${100 * fraction}%` }} /></div>}
      </li>)}
    </ul> : <p className="mt-3 text-small text-muted">No recorded data.</p>}
  </section>;
}
