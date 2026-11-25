import { dateParams, queryString } from "../../../components/data/query";
import { useResource } from "../../../hooks/useResource";
import { RangeControls, LoadState, Pager } from "../../../components/data/Controls";
import { Timeline, Distribution } from "../../../components/data/Charts";
import { panel, heading, control } from "../../../components/ui/Primitives";
import { dateTime, number, percent, latency } from "../../../components/data/format";
import { useState } from "react";
import { getChatAnalytics, getChatKnowledge } from "../../../services/api";

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
  const resource = useResource(getChatKnowledge, queryString({ ...dateParams(date), page, sourceType: type }),
    { enabled: date.range !== "custom" || !!(date.from && date.to) });
  const value = resource.data;
  return <section className={panel}>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className={heading}>Repository knowledge</h3>
      <button type="button" className={control} onClick={resource.refresh}>Refresh knowledge</button>
    </div>
    <LoadState resource={resource} />
    {value && <>
      <p className="mt-2 text-sm text-muted">{number(value.chunkCount)} chunks · <code>{value.version}</code> · {value.embeddingModel}, {value.dimensions} dimensions.</p>
      <p className="text-xs text-muted mt-1">Built {dateTime(value.builtAt)} · Source revision {value.sourceRevision.slice(0, 8)}. Deployment version is unverified.</p>
      <ul className="mt-3 flex flex-wrap gap-2 text-xs text-paper">
        {Object.entries(value.typeCounts).map(([key, count]) => <li className="rounded-control bg-ink px-2 py-1" key={key}>{key} · {count}</li>)}
      </ul>
      <details className="mt-4 text-sm">
        <summary className="cursor-pointer font-medium text-paper">Inspect source catalog</summary>
        <label className="mt-2 grid max-w-56 gap-1">Source type
          <select className={control} value={type} onChange={(event) => { setType(event.target.value); setPage(1); }}>
            <option value="">All types</option>{Object.keys(value.typeCounts).map((key) => <option key={key}>{key}</option>)}
          </select>
        </label>
        <ul className="my-3 space-y-2">{value.catalog.items.map((item) => <li key={item.id} className="break-words">
          <Source item={item} /> <span className="text-muted">{item.type}{item.group ? " · " + item.group : ""}</span>
        </li>)}</ul>
        <Pager data={value.catalog} change={setPage} label="Chunks" />
      </details>
      <details className="mt-3 text-sm">
        <summary className="cursor-pointer font-medium text-paper">Observed versions and retrieved chunks</summary>
        {value.observations.status !== "available" ? <p role="status">{value.observations.message}</p> : <>
          <p className="mt-2 text-xs text-muted">Observed {dateTime(value.observations.observedAt)}. Retrieval does not prove citation.</p>
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
  return item.url ? <a className="text-paper underline break-words" href={item.url} target="_blank" rel="noopener noreferrer">{item.title}</a> :
    <span className="break-words">{item.title || item.id} <small className="text-muted">({item.mapping === "unavailable" ? "mapping unavailable" : "link unavailable"})</small></span>;
}

export default function Overview() {
  const [date, setDate] = useState({ range: "7d" });
  const enabled = date.range !== "custom" || !!(date.from && date.to);
  const resource = useResource(getChatAnalytics, queryString(dateParams(date)), { enabled });
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
    <p className="text-sm text-muted">Asia/Kolkata calendar days. Counts cover durable chat turns only. Provider labels describe the recorded answer type.</p>
    {enabled ? <LoadState resource={resource} /> : <p role="status">Choose both custom dates.</p>}
    {report && <>
      <EditorialSection title="Recorded activity">
        <MetricStrip label="Recorded AI metrics" columns="three" items={kpis.map(([title, value]) => ({ title, value }))} />
        {report.core.message && <p className="mt-3 text-sm text-error" role="status">{report.core.message}</p>}
        {report.latency.message && <p className="mt-3 text-sm text-error" role="status">{report.latency.message}</p>}
        <p className="mt-3 text-xs text-muted">{dateTime(report.core.observedAt || report.latency.observedAt)} · Percentiles use 50 ms buckets and exclude aborted turns.</p>
      </EditorialSection>
      {core && <>
        <div className="grid gap-4 lg:grid-cols-2">
          <Timeline title="Daily recorded activity" rows={core.turns ? daily : []} unit="count" series={[{ key: "turns", label: "Turns", seriesTone: "main" }, { key: "conversations", label: "Conversations", seriesTone: "alternate" }]} />
          <Timeline title="Cache hit rate by day" rows={daily} unit="percent" format={percent} max={1} series={[{ key: "cacheRate", label: "Hit rate", seriesTone: "main" }]} />
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
          <div className="mt-2"><Table name="Daily recorded response types" rows={core.daily.map((row) => ({ ...row, _id: row.day }))}
            columns={[["Date (IST)", (row) => row.day, "technical"], ["Recorded response types", (row) => row.responseTypes.map((type) => type.key + ": " + type.count).join(", ")]]} /></div>
        </details>
      </>}
      {timings && <>
        <Timeline title="Average handler latency by day" rows={dailyLatency} unit="milliseconds" series={[{ key: "averageMs", label: "Average latency (ms)", seriesTone: "main" }]} />
        <details className={panel}><summary className="cursor-pointer font-semibold">Latency by response type</summary>
          <p className="my-2 text-sm">Overall average {number(timings.averageMs)} ms · Range {number(timings.minMs)}–{number(timings.maxMs)} ms · {number(timings.count)} valid turns.</p>
          <Table name="Latency by response type" empty="No valid latency observations." rows={timings.providers.map((row) => ({ ...row, _id: row.key }))}
            columns={[["Type", (row) => row.key], ["Turns", (row) => row.count, "number"], ["Average (ms)", (row) => number(row.averageMs), "number"],
              ["Min (ms)", (row) => number(row.minMs), "number"], ["Max (ms)", (row) => number(row.maxMs), "number"]]} />
        </details>
      </>}
    </>}
    {enabled && <Knowledge key={queryString(dateParams(date))} date={date} />}
  </div>;
}
import { Table } from "../../../components/data/Records";
import { EditorialSection, MetricStrip } from "../../../components/data/Editorial";
