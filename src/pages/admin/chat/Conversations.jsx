import { control, panel, heading } from "../../../components/ui/Primitives";
import { useResource } from "../../../hooks/useResource";
import { dateParams, queryString } from "../../../components/data/query";
import { RangeControls, LoadState, Pager } from "../../../components/data/Controls";
import { dateTime, yesNo, number } from "../../../components/data/format";
import { useRef, useState } from "react";
import { getChatConversation, getChatConversations, getChats } from "../../../services/api";
import taxonomy from "../../../../server/contracts/chat-values.json";
import { Source } from "./Overview";

function Turn({ item }) {
  return <details className="rounded-control border border-rule p-3">
    <summary className="cursor-pointer break-words font-medium text-paper">
      {item.question || "Question unavailable"} <span className="ml-1 text-xs font-normal text-muted">· {item.provider || "Unknown response"}</span>
    </summary>
    <div className="mt-3 border-t border-rule pt-3 space-y-3">
      <p className="whitespace-pre-wrap break-words text-sm text-paper">{item.answer || "Answer unavailable."}</p>
      <dl className="grid grid-cols-2 gap-x-2 gap-y-2 text-xs text-muted sm:grid-cols-4">
        {[
          ["Recorded", dateTime(item.createdAt)], ["Intent", item.intent || "Unknown"], ["Response type", item.provider || "Unknown"],
          ["Retrieval", item.retrieval || "Unknown"], ["Matched", yesNo(item.matched)], ["Cached", yesNo(item.cached)],
          ["Latency", item.latencyMs == null ? "Unavailable" : number(item.latencyMs) + " ms"],
          ["Aborted", yesNo(item.aborted)], ["Corpus", item.corpusVersion || "Unknown"],
        ].map(([name, value]) => <div key={name} className="min-w-0"><dt className="font-medium">{name}</dt><dd className="break-words text-muted">{value}</dd></div>)}
      </dl>
      {!!item.sources?.length && <div className="text-xs"><p className="font-medium">Retrieved chunks</p>
        <ul className="mt-1 space-y-1">{item.sources.map((source, index) => <li key={source.id + ":" + index}><Source item={source} /> <code className="break-all text-muted">{source.id}</code></li>)}</ul>
        <p className="mt-2 text-muted">Stored retrieval does not confirm citation in the answer.</p>
      </div>}
    </div>
  </details>;
}

function Inspector({ reference, date, close }) {
  const [page, setPage] = useState(1);
  const [title] = useState(reference.slice(0, 8));
  const resource = useResource(getChatConversation, queryString({ ...dateParams(date), page, reference }));
  return <section className={panel} aria-label="Conversation inspector">
    <div className="flex justify-between items-center gap-2">
      <h3 className={heading}>Conversation {title}</h3>
      <button type="button" className={control} onClick={close} autoFocus>Close inspector</button>
    </div>
    <p className="my-2 text-xs text-muted">Turns in chronological order for the chosen date range. Expand a question to see its answer.</p>
    <LoadState resource={resource} />
    {resource.data && <>
      <div className="my-3 space-y-2">{resource.data.items.map((item) => <Turn key={item._id} item={item} />)}</div>
      {!resource.data.total && <p>No turns in this date range.</p>}
      <Pager data={resource.data} change={setPage} label="Turns" />
    </>}
  </section>;
}

const filters = [
  ["provider", "Response type", [...taxonomy.provider, "unknown"]],
  ["intent", "Intent", [...taxonomy.intent, "unknown"]],
  ["retrieval", "Retrieval mode", [...taxonomy.retrieval, "unknown"]],
  ["cached", "Cache", ["true", "false"]],
  ["matched", "Matched", ["true", "false"]],
  ["aborted", "Aborted", ["true", "false"]],
];

export default function Conversations() {
  const [mode, setMode] = useState("conversations");
  const [query, setQuery] = useState({ range: "30d", page: 1 });
  const [reference, setReference] = useState(null);
  const returnFocus = useRef(null);
  const enabled = query.range !== "custom" || !!(query.from && query.to);
  const request = { ...query, ...dateParams(query) };
  if (query.range !== "custom") { delete request.from; delete request.to; }
  const resource = useResource(mode === "conversations" ? getChatConversations : getChats, queryString(request), { enabled, delay: 250 });
  const data = resource.data;
  const change = (value) => { setQuery((old) => ({ ...old, page: 1, ...value })); setReference(null); };
  const close = () => { setReference(null); returnFocus.current?.focus(); };
  return <div className="space-y-4">
    <section className={panel}>
      <div className="flex flex-wrap gap-2">
        {[["conversations", "Conversations"], ["turns", "Individual turns"]].map(([key, label]) => <button key={key} type="button"
          aria-pressed={mode === key} className={control}
          onClick={() => { if (key !== mode) { setMode(key); change({ sortBy: undefined }); } }}>{label}</button>)}
        <button type="button" className={control} onClick={resource.refresh}>Refresh</button>
      </div>
      <div className="mt-4 flex flex-wrap gap-3 items-end">
        <label className="grid gap-1 text-sm min-w-0 flex-1 basis-52">Search question or answer
          <input className={control} type="search" maxLength={100} value={query.search || ""} onChange={(event) => change({ search: event.target.value })} />
        </label>
        <RangeControls value={query} onChange={(next) => change({ range: next.range, from: next.from, to: next.to })} />
        <label className="grid gap-1 text-sm">Order
          <select className={control} value={query.order || "desc"} onChange={(event) => change({ order: event.target.value })}>
            <option value="desc">Descending</option><option value="asc">Ascending</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm">Page size
          <select className={control} value={query.pageSize || 25} onChange={(event) => change({ pageSize: event.target.value })}>
            {[5, 10, 25, 50].map((size) => <option key={size}>{size}</option>)}
          </select>
        </label>
        {mode === "turns" && <label className="grid gap-1 text-sm">Sort by
          <select className={control} value={query.sortBy || "createdAt"} onChange={(event) => change({ sortBy: event.target.value })}>
            <option value="createdAt">Recorded date</option><option value="latencyMs">Latency</option>
          </select>
        </label>}
      </div>
      <details className="mt-4">
        <summary className="cursor-pointer text-sm font-medium text-paper">Response, retrieval, and cache filters</summary>
        <div className="mt-3 flex flex-wrap gap-3">
          {filters.map(([key, label, values]) => <label className="grid gap-1 text-sm" key={key}>{label}
            <select className={control} value={query[key] || ""} onChange={(event) => change({ [key]: event.target.value })}>
              <option value="">All</option>{values.map((value) => <option key={value} value={value}>{value === "true" ? "Yes" : value === "false" ? "No" : value}</option>)}
            </select>
          </label>)}
          <label className="grid gap-1 text-sm">Corpus version
            <input className={control} maxLength={16} value={query.corpusVersion || ""} onChange={(event) => change({ corpusVersion: event.target.value })} />
          </label>
        </div>
      </details>
    </section>
    {enabled ? <LoadState resource={resource} /> : <p role="status">Choose both custom dates.</p>}
    {data && <>
      <section className={panel}>
        <h3 className={heading}>{mode === "conversations" ? "Matching conversations" : "Matching turns"}</h3>
        <p className="text-xs text-muted mt-1">Conversation counts cover turns matching current filters. A conversation reference represents a recorded context.</p>
        {!data.items.length ? <p className="mt-3">No matching records.</p> :
          <ul className="my-3 space-y-2">
            {data.items.map((item) => <li key={item.reference || item._id}>
              {mode === "turns" ? <Turn item={item} /> : <button type="button" className="w-full rounded-control border border-rule p-3 text-left hover:bg-paper/5 focus-visible:outline focus-visible:outline-accent"
                aria-expanded={reference === item.reference} onClick={(event) => {
                  returnFocus.current = event.currentTarget;
                  setReference((value) => value === item.reference ? null : item.reference);
                }}>
                <strong className="block break-words">{item.preview || "Question preview unavailable"}</strong>
                <span className="mt-1 block text-xs text-muted">
                  {item.turns} turns · {item.latestResponseType || "Unknown response"} · {item.cachedTurns}/{item.cacheObserved} known cached · {item.abortedTurns} aborted
                </span>
                <span className="mt-1 block text-xs text-muted">{dateTime(item.firstAt)} to {dateTime(item.lastAt)} · {item.intents.join(", ")}</span>
              </button>}
            </li>)}
          </ul>}
        <Pager data={data} change={(page) => change({ page })} label={mode === "conversations" ? "Conversations" : "Turns"} />
      </section>
      {reference && <Inspector key={reference} reference={reference} date={query} close={close} />}
    </>}
  </div>;
}
