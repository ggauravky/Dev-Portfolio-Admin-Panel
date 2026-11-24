import { useState } from "react";
import { getChatAnalytics, getChatKnowledge } from "../../../services/api";
import { dateParams, queryString, useChatResource, RangeControls, LoadState, Pager, Timeline, Distribution, panel, heading, control, dateTime, number, percent, latency } from "./Shared";

const dayMs = 86400000;
function timeline(range, data, empty = {}) {
  const index = new Map((data || []).map((row) => [row.day || row.key, row]));
  const results = [];
  for (let at = Date.parse(range.from); at < Date.parse(range.to); at += dayMs) {
    const day = new Date(at + 19800000).toISOString().slice(0, 10);
    results.push({ day, ...empty, ...index.get(day) });
  }
  return results;
}

export function Knowledge({ date }) {
  const [page, setPage] = useState(1);
  const [type, setType] = useState("");
  const resource = useChatResource(getChatKnowledge, queryString({ ...dateParams(date), page, sourceType: type }),
    { enabled: date.range !== "custom" || !!(date.from && date.to) });
  const value = resource.data;
  return <section className={panel}>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className={heading}>Repository knowledge</h3>
      <button type="button" className={control} onClick={resource.refresh}>Refresh knowledge</button>
    </div>
    <LoadState resource={resource} />
    {value && <>
      <p className="mt-2 text-sm text-slate-700">{number(value.chunkCount)} chunks · <code>{value.version}</code> · {value.embeddingModel}, {value.dimensions} dimensions.</p>
      <p className="text-xs text-slate-500 mt-1">Built {dateTime(value.builtAt)} · Source revision {value.sourceRevision.slice(0, 8)}. Deployment version is unverified.</p>
      <ul className="mt-3 flex flex-wrap gap-2 text-xs text-teal-900">
        {Object.entries(value.typeCounts).map(([key, count]) => <li className="rounded bg-teal-50 px-2 py-1" key={key}>{key} · {count}</li>)}
      </ul>
      <details className="mt-4 text-sm">
        <summary className="cursor-pointer font-medium text-teal-800">Inspect source catalog</summary>
        <label className="mt-2 grid max-w-56 gap-1">Source type
          <select className={control} value={type} onChange={(event) => { setType(event.target.value); setPage(1); }}>
            <option value="">All types</option>{Object.keys(value.typeCounts).map((key) => <option key={key}>{key}</option>)}
          </select>
        </label>
        <ul className="my-3 space-y-2">{value.catalog.items.map((item) => <li key={item.id} className="break-words">
          <Source item={item} /> <span className="text-slate-500">{item.type}{item.group ? " · " + item.group : ""}</span>
        </li>)}</ul>
        <Pager data={value.catalog} change={setPage} label="Chunks" />
      </details>
      <details className="mt-3 text-sm">
        <summary className="cursor-pointer font-medium text-teal-800">Observed versions and retrieved chunks</summary>
        {value.observations.status !== "available" ? <p role="status">{value.observations.message}</p> : <>
          <p className="mt-2 text-xs text-slate-500">Observed {dateTime(value.observations.observedAt)}. Retrieval does not prove citation.</p>
          <ul className="my-2">{value.observations.versions.map((row) => <li key={row.version}>{row.version} · {row.count} turns</li>)}</ul>
          {value.observations.retrieved.length ? <ol className="space-y-2">{value.observations.retrieved.map((row) => <li key={row.id}><Source item={row} /> · {row.count} turns</li>)}</ol> :
            <p>No recorded retrieval of verified chunks in this range.</p>}
        </>}
      </details>
    </>}
  </section>;
}

export function Source({ item }) {
  // Only repository-validated links are returned. Questions and answers are displayed as plain text.
  return item.url ? <a className="text-teal-800 underline break-words" href={item.url} target="_blank" rel="noopener noreferrer">{item.title}</a> :
    <span className="break-words">{item.title || item.id} <small className="text-slate-500">({item.mapping === "unavailable" ? "mapping unavailable" : "link unavailable"})</small></span>;
}

export default function Overview() {
  const [date, setDate] = useState({ range: "7d" });
  const enabled = date.range !== "custom" || !!(date.from && date.to);
  const resource = useChatResource(getChatAnalytics, queryString(dateParams(date)), { enabled });
  const report = resource.data;
  const core = report?.core.data;
  const timings = report?.latency.data;
  const kpis = [
    ["Recorded turns", number(core?.turns)], ["Recorded conversations", number(core?.conversations)],
    ["Cache hit rate", percent(core?.cache.rate)], ["Retrieval match rate", percent(core?.retrieval.eligibleRate)],
    ["Median latency", latency(timings?.medianMs)], ["P95 latency", latency(timings?.p95Ms)],
  ];
  const daily = core ? timeline(report.range, core.daily, { turns: 0, conversations: 0, cacheRate: null }) : [];
  const dailyLatency = timings ? timeline(report.range, timings.daily, { averageMs: null }) : [];
  return <div className="space-y-5">
    <div className="flex flex-wrap gap-3 items-end"><RangeControls value={date} onChange={setDate} />
      <button type="button" className={control} onClick={resource.refresh}>Refresh analytics</button>
    </div>
    <p className="text-sm text-slate-600">Asia/Kolkata calendar days. Counts cover durable chat turns only. Provider labels describe the recorded answer type.</p>
    {enabled ? <LoadState resource={resource} /> : <p role="status">Choose both custom dates.</p>}
    {report && <>
      <section className={panel}>
        <h3 className={heading}>Recorded activity</h3>
        <dl className="mt-3 grid grid-cols-2 gap-4 lg:grid-cols-6">
          {kpis.map(([label, value]) => <div key={label}><dt className="text-xs text-slate-600">{label}</dt><dd className="mt-1 text-xl font-semibold tabular-nums text-slate-900">{value}</dd></div>)}
        </dl>
        {report.core.message && <p className="mt-3 text-sm text-red-800" role="status">{report.core.message}</p>}
        {report.latency.message && <p className="mt-3 text-sm text-red-800" role="status">{report.latency.message}</p>}
        <p className="mt-3 text-xs text-slate-500">{dateTime(report.core.observedAt || report.latency.observedAt)} · Percentiles use 50 ms buckets and exclude aborted turns.</p>
      </section>
      {core && <>
        <div className="grid gap-4 lg:grid-cols-2">
          <Timeline title="Daily recorded activity" rows={core.turns ? daily : []} unit="count" series={[{ key: "turns", label: "Turns", color: "bg-teal-700" }, { key: "conversations", label: "Conversations", color: "bg-sky-500" }]} />
          <Timeline title="Cache hit rate by day" rows={daily} unit="percent" format={percent} max={1} series={[{ key: "cacheRate", label: "Hit rate", color: "bg-teal-700" }]} />
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <Distribution title="Response types" rows={core.distributions.response} />
          <Distribution title="Recorded intents" rows={core.distributions.intent} />
          <Distribution title="Retrieval modes" rows={core.distributions.retrieval} />
        </div>
        <details className={panel}>
          <summary className="cursor-pointer font-semibold">Daily response types and metric details</summary>
          <p className="mt-2 text-sm">Average turns per conversation: {core.averageTurns?.toFixed(2) ?? "Unavailable"}. {core.local} local responses, {core.templates} templates, {core.declined} declined, {core.unsupported} recorded no-match intents.</p>
          <p className="mt-2 text-sm">Cache: {core.cache.hits} hits and {core.cache.misses} misses among known observations. Matched: {core.retrieval.matched}; unmatched: {core.retrieval.unmatched}. All-turn match rate: {percent(core.retrieval.allRate)}. Retrieval-eligible rate: {percent(core.retrieval.eligibleRate)} among hybrid, keyword and about records. Aborted: {core.aborted.count} ({percent(core.aborted.rate)} of known flags).</p>
          <div className="mt-2 overflow-x-auto"><table className="text-left text-sm w-full">
            <thead><tr><th scope="col">Date (IST)</th><th scope="col">Recorded response types</th></tr></thead>
            <tbody>{core.daily.map((row) => <tr key={row.day}><th scope="row">{row.day}</th><td>{row.responseTypes.map((type) => type.key + ": " + type.count).join(", ")}</td></tr>)}</tbody>
          </table></div>
        </details>
      </>}
      {timings && <>
        <Timeline title="Average handler latency by day" rows={dailyLatency} unit="milliseconds" series={[{ key: "averageMs", label: "Average latency (ms)", color: "bg-teal-700" }]} />
        <details className={panel}><summary className="cursor-pointer font-semibold">Latency by response type</summary>
          <p className="my-2 text-sm">Overall average {number(timings.averageMs)} ms · Range {number(timings.minMs)}–{number(timings.maxMs)} ms · {number(timings.count)} valid turns.</p>
          {!timings.providers.length ? <p>No valid latency observations.</p> : <div className="overflow-x-auto"><table className="w-full text-left text-sm">
            <thead><tr><th scope="col">Type</th><th scope="col">Turns</th><th scope="col">Average (ms)</th><th scope="col">Min (ms)</th><th scope="col">Max (ms)</th></tr></thead>
            <tbody>{timings.providers.map((row) => <tr key={row.key}><th scope="row">{row.key}</th><td>{row.count}</td><td>{number(row.averageMs)}</td><td>{number(row.minMs)}</td><td>{number(row.maxMs)}</td></tr>)}</tbody>
          </table></div>}
        </details>
      </>}
    </>}
    {enabled && <Knowledge key={queryString(dateParams(date))} date={date} />}
  </div>;
}
