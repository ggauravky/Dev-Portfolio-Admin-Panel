import { getChatOperations } from "../../../services/api";
import { useChatResource, LoadState, panel, heading, control, number, dateTime } from "./Shared";

const utc = (value) => new Date(value).toISOString().replace("T", " ").slice(0, 19) + " UTC";

function Unavailable({ part }) {
  return <p role="status" className="mt-3 text-sm text-slate-600">{part.message || "Observation unavailable."}</p>;
}

export default function Operations() {
  const resource = useChatResource(getChatOperations);
  const report = resource.data;
  return <div className="space-y-4">
    <button type="button" className={control} onClick={resource.refresh}>Refresh operations</button>
    <LoadState resource={resource} />
    {report && <>
      <section className={panel}>
        <h3 className={heading}>Storage and freshness</h3>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
          <div><dt className="text-slate-600">Chat database connection</dt><dd className="font-semibold">{report.database.replaceAll("_", " ")}</dd></div>
          <div><dt className="text-slate-600">Repository corpus</dt><dd><code>{report.corpusVersion}</code></dd></div>
          <div><dt className="text-slate-600">Last observation</dt><dd>{dateTime(report.observedAt)}</dd></div>
        </dl>
        <p className="mt-3 text-sm text-slate-600">Configured turn retention: {report.turnRetentionDays} days. Cache retention: {report.cacheRetentionHours} hours.</p>
      </section>
      <section className={panel}>
        <h3 className={heading}>Application-side quota windows</h3>
        <p className="mt-2 text-sm text-slate-600">Repository limits alongside observed shared counters. UTC windows. Counts may include refusals and unsettled reservations. Provider account-wide limits, actual API calls, and tokens saved are unavailable.</p>
        {report.quota.status !== "available" ? <Unavailable part={report.quota} /> :
          <div className="mt-3 overflow-x-auto" tabIndex="0" aria-label="Quota window table">
            <table className="min-w-[38rem] w-full text-left text-sm">
              <thead><tr><th scope="col">Category</th><th scope="col">Metric</th><th scope="col">Configured limit</th><th scope="col">Observed counter</th><th scope="col">Window</th></tr></thead>
              <tbody>{report.quota.data.map((row) => <tr key={row.label + ":" + row.metric} className="border-t border-slate-100">
                <th scope="row" className="py-2">{row.label}</th><td>{row.metric.toUpperCase()}</td><td>{number(row.configuredLimit)}</td>
                <td>{row.count == null ? "Not observed" : number(row.count)}</td><td className="text-xs">{utc(row.startsAt)} → {utc(row.endsAt)}</td>
              </tr>)}</tbody>
            </table>
          </div>}
        {report.quota.status !== "available" && <ul className="mt-3 text-sm">
          {Object.entries(report.configured.providers).map(([name, values]) => <li key={name}>{name}: {Object.entries(values).map(([key, value]) => key.toUpperCase() + " " + number(value)).join(", ")}</li>)}
          <li>Generation starts: {report.configured.generationStartsPer10s} per 10 seconds</li>
        </ul>}
      </section>
      <div className="grid gap-4 md:grid-cols-2">
        <section className={panel}><h3 className={heading}>Shared provider cooldowns</h3>
          {report.cooldowns.status !== "available" ? <Unavailable part={report.cooldowns} /> :
            <ul className="mt-3 space-y-2 text-sm">{report.cooldowns.data.map((row) => <li key={row.label}><strong>{row.label}</strong> · {row.status === "active" ? "Active until " + dateTime(row.until) : "No active cooldown observed"}</li>)}</ul>}
        </section>
        <section className={panel}><h3 className={heading}>Response cache</h3>
          {report.cacheEntries.status !== "available" ? <Unavailable part={report.cacheEntries} /> :
            <p className="mt-3 text-sm">{number(report.cacheEntries.data)} unexpired cache {report.cacheEntries.data === 1 ? "entry" : "entries"} observed.</p>}
        </section>
      </div>
    </>}
  </div>;
}
