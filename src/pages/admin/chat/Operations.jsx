import { useResource } from "../../../hooks/useResource";
import { LoadState } from "../../../components/data/Controls";
import { panel, heading, control } from "../../../components/ui/Primitives";
import { number, dateTime } from "../../../components/data/format";
import { getChatOperations } from "../../../services/api";

const utc = (value) => new Date(value).toISOString().replace("T", " ").slice(0, 19) + " UTC";

function Unavailable({ part }) {
  return <p role="status" className="mt-3 text-sm text-muted">{part.message || "Observation unavailable."}</p>;
}

export default function Operations() {
  const resource = useResource(getChatOperations);
  const report = resource.data;
  return <div className="space-y-4">
    <button type="button" className={control} onClick={resource.refresh}>Refresh operations</button>
    <LoadState resource={resource} />
    {report && <>
      <section className={panel}>
        <h2 className={heading}>Storage and freshness</h2>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
          <div><dt className="text-muted">Chat database connection</dt><dd className="font-semibold">{report.database.replaceAll("_", " ")}</dd></div>
          <div><dt className="text-muted">Repository corpus</dt><dd><code>{report.corpusVersion}</code></dd></div>
          <div><dt className="text-muted">Last observation</dt><dd>{dateTime(report.observedAt)}</dd></div>
        </dl>
        <p className="mt-3 text-sm text-muted">Configured turn retention: {report.turnRetentionDays} days. Cache retention: {report.cacheRetentionHours} hours.</p>
      </section>
      <section className={panel}>
        <h2 className={heading}>Application-side quota windows</h2>
        <p className="mt-2 text-sm text-muted">Repository limits alongside observed shared counters. UTC windows. Counts may include refusals and unsettled reservations. Provider account-wide limits, actual API calls, and tokens saved are unavailable.</p>
        {report.quota.status !== "available" ? <Unavailable part={report.quota} /> :
          <div className="mt-3"><Table name="Quota windows" rows={report.quota.data.map((row) => ({ ...row, _id: row.label + ":" + row.metric }))} columns={[
            ["Category", (row) => row.label], ["Metric", (row) => row.metric.toUpperCase(), "technical"],
            ["Configured limit", (row) => number(row.configuredLimit), "number"], ["Observed counter", (row) => row.count == null ? "Not observed" : number(row.count), "number"],
            ["Window", (row) => `${utc(row.startsAt)} → ${utc(row.endsAt)}`, "technical"],
          ]} /></div>}
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
import { Table } from "../../../components/data/Records";
