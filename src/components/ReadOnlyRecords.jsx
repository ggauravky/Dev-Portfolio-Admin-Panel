import { useEffect, useState } from "react";
import AdminLayout from "./AdminLayout";

const date = (value) => value ? new Date(value).toLocaleString() : "—";
const money = (value) => typeof value === "number" ? new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(value) : "—";

export function recordValue(key, value) {
  if (key === "amount") return money(value);
  if (key.endsWith("At") || ["date", "preferredDate"].includes(key)) return date(value);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.join(", ");
  return value ?? "—";
}

export default function ReadOnlyRecords({ title, description, load, heading, fields, filter, defaultSort = "createdAt" }) {
  const [query, setQuery] = useState({ search: "", sortBy: defaultSort, order: "desc", page: 1 });
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const change = (key, value) => {
    setResult(null);
    setError("");
    setQuery((current) => ({ ...current, [key]: value, page: key === "page" ? value : 1 }));
  };

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      const params = Object.fromEntries(Object.entries(query).filter(([, value]) => value !== ""));
      load(params, controller.signal).then(({ data }) => {
        if (!controller.signal.aborted) setResult(data);
      }).catch((failure) => {
        if (!controller.signal.aborted) setError(failure.message);
      });
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [load, query, refresh]);

  return (
    <AdminLayout>
      <div className="px-4 sm:px-0 space-y-6">
        <header>
          <h1 className="text-3xl font-bold text-gray-900">{title}</h1>
          <p className="text-gray-600 mt-2">{description}</p>
        </header>
        <div className="flex flex-wrap gap-4 items-end bg-white rounded-xl shadow p-4">
          <label className="grid gap-1 text-sm">Search
            <input className="border rounded p-2" type="search" value={query.search} maxLength={100}
              onChange={(event) => change("search", event.target.value)} />
          </label>
          {filter && <label className="grid gap-1 text-sm">{filter.label}
            <select className="border rounded p-2" value={query[filter.key] ?? ""}
              onChange={(event) => change(filter.key, event.target.value)}>
              <option value="">All</option>
              {Object.entries(filter.values).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>}
          <label className="grid gap-1 text-sm">Order
            <select className="border rounded p-2" value={query.order} onChange={(event) => change("order", event.target.value)}>
              <option value="desc">Newest first</option><option value="asc">Oldest first</option>
            </select>
          </label>
          <button type="button" className="border rounded p-2" onClick={() => {
            setResult(null);
            setError("");
            setRefresh((value) => value + 1);
          }}>Refresh</button>
        </div>
        {error ? <p role="alert" className="text-red-700">{error}</p> :
          !result ? <p role="status">Loading…</p> : (
          <>
            <div className="grid gap-4 lg:grid-cols-2">
              {result.items.map((record) => (
                <article key={record._id} className="bg-white border border-gray-100 rounded-xl shadow p-5 min-w-0">
                  <h2 className="text-lg font-semibold break-words">{heading(record)}</h2>
                  <dl className="mt-3 grid gap-2">
                    {fields.map(([key, label]) => <div key={key} className="text-sm">
                      <dt className="text-gray-500">{label}</dt>
                      <dd className="text-gray-900 whitespace-pre-wrap break-words">{recordValue(key, record[key])}</dd>
                    </div>)}
                  </dl>
                </article>
              ))}
            </div>
            {result.items.length === 0 && <p>No matching records on this page.</p>}
            <nav aria-label="Results pagination" className="flex flex-wrap items-center gap-4 text-sm">
              <button type="button" className="border rounded px-3 py-2 disabled:opacity-50"
                disabled={result.page <= 1} onClick={() => change("page", result.page - 1)}>Previous</button>
              <span aria-live="polite">{result.total.toLocaleString()} matching · Page {result.page} of {Math.max(1, result.totalPages)}</span>
              <button type="button" className="border rounded px-3 py-2 disabled:opacity-50"
                disabled={result.page >= result.totalPages} onClick={() => change("page", result.page + 1)}>Next</button>
            </nav>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
