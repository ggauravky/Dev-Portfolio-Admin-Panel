/* eslint-disable react/prop-types */
import { useEffect, useState } from "react";
import AdminLayout from "../../components/AdminLayout";
import { getMlLogs } from "../../services/api";

const DEMO_TYPE_OPTIONS = [
  { value: "all", label: "All Demos" },
  { value: "image_analyzer", label: "Image Analyzer" },
  { value: "prompt_improver", label: "Prompt Improver" },
];

const normalizeMlLog = (log = {}) => {
  const topPredictions = Array.isArray(log.topPredictions)
    ? log.topPredictions
    : [];

  let normalizedDemoType = log.demoType || "unknown";
  if (log.demoType === "image-analyzer") {
    normalizedDemoType = "image_analyzer";
  }
  if (log.demoType === "prompt-improver") {
    normalizedDemoType = "prompt_improver";
  }

  return {
    ...log,
    demoType: normalizedDemoType,
    predictionLabel: log.predictionLabel || log.prediction || "",
    inputPrompt: log.inputPrompt || log.prompt || "",
    improvedPrompt: log.improvedPrompt || log.result || "",
    topPredictions,
  };
};

const MlLogs = () => {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [demoTypeFilter, setDemoTypeFilter] = useState("all");
  const [eventFilter, setEventFilter] = useState("");
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState("desc");

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchMlLogs();
    }, 250);

    return () => clearTimeout(timeoutId);
  }, [searchTerm, demoTypeFilter, eventFilter, sortBy, sortOrder]);

  const fetchMlLogs = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError(null);

      const params = {
        sortBy,
        order: sortOrder,
      };

      if (searchTerm.trim()) params.search = searchTerm.trim();
      if (demoTypeFilter !== "all") params.demoType = demoTypeFilter;
      if (eventFilter.trim()) params.event = eventFilter.trim();

      const data = await getMlLogs(params);
      const rawList = Array.isArray(data)
        ? data
        : data.mllogs || data.mlLogs || data.logs || [];
      const list = rawList.map(normalizeMlLog);
      setLogs(list);
      setTotal(data?.total || data?.count || list.length);
    } catch (fetchError) {
      console.error("Error fetching ML logs:", fetchError);
      setError(fetchError?.message || "Failed to load ML logs. Please try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return "N/A";
    return date.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatProbability = (value) => {
    if (typeof value !== "number" || Number.isNaN(value)) return "N/A";
    return `${(value * 100).toFixed(2)}%`;
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="h-14 w-14 rounded-full border-b-2 border-indigo-600 animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">Loading ML logs...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="px-4">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-violet-700 bg-clip-text text-transparent">
              ML Logs
            </h1>
            <p className="text-gray-600 mt-2">
              Inspect image analyzer and prompt improver activity with full metadata.
            </p>
          </div>
          <button
            onClick={() => fetchMlLogs(true)}
            disabled={refreshing}
            className="px-4 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search prompt, prediction, IP, city..."
              className="xl:col-span-2 px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <select
              value={demoTypeFilter}
              onChange={(e) => setDemoTypeFilter(e.target.value)}
              className="px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {DEMO_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={eventFilter}
              onChange={(e) => setEventFilter(e.target.value)}
              placeholder="Event filter (example: run)"
              className="px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="createdAt">Date</option>
              <option value="demoType">Demo Type</option>
              <option value="event">Event</option>
              <option value="predictionLabel">Prediction Label</option>
              <option value="nlpAction">NLP Action</option>
              <option value="nlpTone">NLP Tone</option>
              <option value="countryCode">Country Code</option>
              <option value="city">City</option>
            </select>
          </div>

          <div className="mt-3 flex items-center gap-3">
            <button
              onClick={() => setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"))}
              className="px-4 py-2 border border-gray-200 rounded-xl bg-gray-50 hover:bg-gray-100"
            >
              {sortOrder === "asc" ? "Asc" : "Desc"}
            </button>
            <div className="ml-auto text-sm text-gray-600">
              Showing {logs.length} of {total} log(s)
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-6">
            {error}
          </div>
        )}

        {logs.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-lg p-10 text-center text-gray-500">
            No ML logs found for current filters.
          </div>
        ) : (
          <div className="space-y-4">
            {logs.map((log) => {
              const isImageAnalyzer = log.demoType === "image_analyzer";
              const isPromptImprover = log.demoType === "prompt_improver";
              let typeClass = "bg-gray-100 text-gray-700";
              if (isImageAnalyzer) {
                typeClass = "bg-blue-100 text-blue-700";
              }
              if (isPromptImprover) {
                typeClass = "bg-violet-100 text-violet-700";
              }

              let typeLabel = "Unknown";
              if (isImageAnalyzer) {
                typeLabel = "Image Analyzer";
              }
              if (isPromptImprover) {
                typeLabel = "Prompt Improver";
              }

              return (
                <div
                  key={log._id}
                  className="bg-white rounded-2xl shadow-lg border border-gray-100 p-5"
                >
                  <div className="flex flex-wrap items-center gap-2 mb-4">
                    <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-700">
                      {formatDate(log.createdAt)}
                    </span>
                    <span className={`text-xs px-2 py-1 rounded-full font-semibold ${typeClass}`}>
                      {typeLabel}
                    </span>
                    <span className="text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-700 font-semibold">
                      {log.event || "run"}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 mb-4 text-sm">
                    <MetaRow label="IP Address" value={log.ipAddress || "unknown"} />
                    <MetaRow label="Country Code" value={log.countryCode || "unknown"} />
                    <MetaRow label="City" value={log.city || "unknown"} />
                    <MetaRow label="Public ID" value={log.imagePublicId || "N/A"} />
                  </div>

                  <div className="mb-4 text-xs text-gray-500 break-words">
                    <span className="font-semibold text-gray-600">User Agent:</span>{" "}
                    {log.userAgent || "unknown"}
                  </div>

                  {(log.predictionLabel || (log.topPredictions || []).length > 0 || log.imageUrl) && (
                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-3">
                      <div className="text-xs font-semibold text-blue-700 mb-2">
                        Image Analyzer Data
                      </div>
                      {log.predictionLabel && (
                        <p className="text-sm text-gray-800 mb-2">
                          <span className="font-semibold">Prediction:</span> {log.predictionLabel}
                        </p>
                      )}
                      {(log.topPredictions || []).length > 0 && (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2 mb-2">
                          {log.topPredictions.map((prediction, index) => (
                            <div
                              key={`${log._id}-pred-${index}`}
                              className="bg-white border border-blue-100 rounded-lg px-3 py-2 text-sm"
                            >
                              <div className="font-medium text-gray-800 break-words">
                                {prediction.className || "N/A"}
                              </div>
                              <div className="text-blue-700 text-xs">
                                {formatProbability(prediction.probability)}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {log.imageUrl && (
                        <a
                          href={log.imageUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm text-blue-700 hover:text-blue-900 underline break-all"
                        >
                          Open Image URL
                        </a>
                      )}
                    </div>
                  )}

                  {(log.inputPrompt || log.improvedPrompt || log.nlpAction || log.nlpTone) && (
                    <div className="bg-violet-50 border border-violet-100 rounded-xl p-4">
                      <div className="text-xs font-semibold text-violet-700 mb-2">
                        Prompt Improver Data
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                        <MetaRow label="NLP Action" value={log.nlpAction || "N/A"} />
                        <MetaRow label="NLP Tone" value={log.nlpTone || "N/A"} />
                      </div>
                      {log.inputPrompt && (
                        <div className="bg-white border border-violet-100 rounded-lg p-3 mb-2">
                          <div className="text-xs font-semibold text-violet-700 mb-1">Input Prompt</div>
                          <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">
                            {log.inputPrompt}
                          </p>
                        </div>
                      )}
                      {log.improvedPrompt && (
                        <div className="bg-white border border-violet-100 rounded-lg p-3">
                          <div className="text-xs font-semibold text-violet-700 mb-1">
                            Improved Prompt
                          </div>
                          <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">
                            {log.improvedPrompt}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

const MetaRow = ({ label, value }) => {
  return (
    <div className="bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
      <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">{label}</div>
      <div className="font-medium text-gray-800 break-words">{value}</div>
    </div>
  );
};

export default MlLogs;
