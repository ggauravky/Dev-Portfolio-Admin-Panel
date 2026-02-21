import { useEffect, useMemo, useState } from "react";
import AdminLayout from "../../components/AdminLayout";
import { bulkDeleteChats, deleteChat, getChats } from "../../services/api";

const INTENT_OPTIONS = [
  "all",
  "greeting",
  "skills",
  "projects",
  "hiring",
  "education",
  "goals",
  "other",
];

const Chats = () => {
  const [chats, setChats] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [degradedFilter, setDegradedFilter] = useState("all");
  const [intentFilter, setIntentFilter] = useState("all");
  const [countryFilter, setCountryFilter] = useState("");
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState("desc");
  const [selectedChats, setSelectedChats] = useState([]);

  const countries = useMemo(() => {
    const allCountries = chats
      .map((chat) => chat.country || "unknown")
      .filter(Boolean);
    return [...new Set(allCountries)].sort((a, b) => a.localeCompare(b));
  }, [chats]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchChats();
    }, 250);
    return () => clearTimeout(timeoutId);
  }, [
    searchTerm,
    sourceFilter,
    degradedFilter,
    intentFilter,
    countryFilter,
    sortBy,
    sortOrder,
  ]);

  const fetchChats = async (isRefresh = false) => {
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
        limit: 200,
      };

      if (searchTerm.trim()) params.search = searchTerm.trim();
      if (sourceFilter !== "all") params.source = sourceFilter;
      if (degradedFilter !== "all") params.degraded = degradedFilter;
      if (intentFilter !== "all") params.intentTag = intentFilter;
      if (countryFilter) params.country = countryFilter;

      const data = await getChats(params);
      const list = data.chats || [];
      setChats(list);
      setTotal(data.total || list.length);
      setSelectedChats((prev) => prev.filter((id) => list.some((c) => c._id === id)));
    } catch (fetchError) {
      console.error("Error fetching chats:", fetchError);
      setError("Failed to load chat logs. Please try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this chat log?")) return;
    try {
      await deleteChat(id);
      setChats((prev) => prev.filter((chat) => chat._id !== id));
      setSelectedChats((prev) => prev.filter((chatId) => chatId !== id));
      setTotal((prev) => Math.max(0, prev - 1));
      setError(null);
    } catch (deleteError) {
      console.error("Error deleting chat log:", deleteError);
      setError("Failed to delete chat log.");
    }
  };

  const handleBulkDelete = async () => {
    if (selectedChats.length === 0) return;
    if (!window.confirm(`Delete ${selectedChats.length} selected chat log(s)?`)) return;

    try {
      await bulkDeleteChats(selectedChats);
      setChats((prev) => prev.filter((chat) => !selectedChats.includes(chat._id)));
      setTotal((prev) => Math.max(0, prev - selectedChats.length));
      setSelectedChats([]);
      setError(null);
    } catch (bulkError) {
      console.error("Error bulk deleting chat logs:", bulkError);
      setError("Failed to delete selected chat logs.");
    }
  };

  const toggleSelect = (id) => {
    setSelectedChats((prev) =>
      prev.includes(id) ? prev.filter((chatId) => chatId !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedChats.length === chats.length) {
      setSelectedChats([]);
      return;
    }
    setSelectedChats(chats.map((chat) => chat._id));
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

  const formatResponseTime = (ms) => {
    if (ms === null || ms === undefined || Number.isNaN(ms)) return "N/A";
    return `${ms} ms`;
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="h-14 w-14 rounded-full border-b-2 border-blue-600 animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">Loading chat logs...</p>
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
            <h1 className="text-4xl font-bold bg-gradient-to-r from-cyan-600 to-blue-700 bg-clip-text text-transparent">
              AI Chats
            </h1>
            <p className="text-gray-600 mt-2">
              Review user prompts, AI replies, and chat diagnostics in one place.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => fetchChats(true)}
              disabled={refreshing}
              className="px-4 py-2 rounded-xl bg-cyan-600 text-white hover:bg-cyan-700 disabled:opacity-60"
            >
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>
            {selectedChats.length > 0 && (
              <button
                onClick={handleBulkDelete}
                className="px-4 py-2 rounded-xl bg-red-600 text-white hover:bg-red-700"
              >
                Delete Selected ({selectedChats.length})
              </button>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-3">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search message, model, session..."
              className="xl:col-span-2 px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              <option value="all">All Sources</option>
              <option value="gemini">Gemini</option>
              <option value="fallback">Fallback</option>
            </select>
            <select
              value={degradedFilter}
              onChange={(e) => setDegradedFilter(e.target.value)}
              className="px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              <option value="all">All Modes</option>
              <option value="true">Degraded</option>
              <option value="false">Normal</option>
            </select>
            <select
              value={intentFilter}
              onChange={(e) => setIntentFilter(e.target.value)}
              className="px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              {INTENT_OPTIONS.map((intent) => (
                <option key={intent} value={intent}>
                  {intent === "all"
                    ? "All Intents"
                    : intent.charAt(0).toUpperCase() + intent.slice(1)}
                </option>
              ))}
            </select>
            <select
              value={countryFilter}
              onChange={(e) => setCountryFilter(e.target.value)}
              className="px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              <option value="">All Countries</option>
              {countries.map((country) => (
                <option key={country} value={country}>
                  {country}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-3 flex flex-wrap gap-3">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-4 py-2 border border-gray-200 rounded-xl"
            >
              <option value="createdAt">Date</option>
              <option value="responseTimeMs">Response Time</option>
              <option value="source">Source</option>
              <option value="degraded">Mode</option>
              <option value="country">Country</option>
              <option value="intentTag">Intent</option>
              <option value="messageIndex">Message Index</option>
            </select>
            <button
              onClick={() => setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"))}
              className="px-4 py-2 border border-gray-200 rounded-xl bg-gray-50 hover:bg-gray-100"
            >
              {sortOrder === "asc" ? "Asc" : "Desc"}
            </button>
            <div className="ml-auto text-sm text-gray-600 self-center">
              Showing {chats.length} of {total} chat log(s)
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-6">
            {error}
          </div>
        )}

        {chats.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-lg p-10 text-center text-gray-500">
            No chat logs found for current filters.
          </div>
        ) : (
          <>
            <div className="bg-white rounded-2xl shadow-lg p-4 mb-4">
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={chats.length > 0 && selectedChats.length === chats.length}
                  onChange={toggleSelectAll}
                  className="w-5 h-5 rounded text-cyan-600 focus:ring-cyan-500"
                />
                <span className="font-medium text-gray-700">
                  {selectedChats.length === chats.length ? "Deselect All" : "Select All"} ({chats.length})
                </span>
              </label>
            </div>

            <div className="space-y-4">
              {chats.map((chat) => {
                const sourceClass =
                  chat.source === "fallback"
                    ? "bg-amber-100 text-amber-800"
                    : "bg-cyan-100 text-cyan-800";
                const modeClass = chat.degraded
                  ? "bg-red-100 text-red-700"
                  : "bg-emerald-100 text-emerald-700";

                return (
                  <div key={chat._id} className="bg-white rounded-2xl shadow-lg p-5 border border-gray-100">
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                      <div className="flex items-center gap-3 flex-wrap">
                        <input
                          type="checkbox"
                          checked={selectedChats.includes(chat._id)}
                          onChange={() => toggleSelect(chat._id)}
                          className="w-5 h-5 rounded text-cyan-600 focus:ring-cyan-500"
                        />
                        <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-700">
                          {formatDate(chat.createdAt)}
                        </span>
                        <span className={`text-xs px-2 py-1 rounded-full font-semibold ${sourceClass}`}>
                          {(chat.source || "unknown").toUpperCase()}
                        </span>
                        <span className={`text-xs px-2 py-1 rounded-full font-semibold ${modeClass}`}>
                          {chat.degraded ? "DEGRADED" : "NORMAL"}
                        </span>
                        <span className="text-xs px-2 py-1 rounded-full bg-indigo-100 text-indigo-700 font-semibold">
                          {chat.intentTag || "other"}
                        </span>
                        <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-700">
                          {chat.model || "unknown"}
                        </span>
                      </div>
                      <button
                        onClick={() => handleDelete(chat._id)}
                        className="px-3 py-2 rounded-lg text-sm bg-red-50 text-red-700 hover:bg-red-100"
                      >
                        Delete
                      </button>
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-4">
                      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                        <div className="text-xs font-semibold text-blue-700 mb-2">Human Message</div>
                        <p className="text-gray-800 whitespace-pre-wrap break-words">
                          {chat.userMessage || "N/A"}
                        </p>
                      </div>
                      <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4">
                        <div className="text-xs font-semibold text-emerald-700 mb-2">AI Reply</div>
                        <p className="text-gray-800 whitespace-pre-wrap break-words">
                          {chat.aiReply || "N/A"}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 text-sm">
                      <MetaRow label="Response Time" value={formatResponseTime(chat.responseTimeMs)} />
                      <MetaRow label="Session ID" value={chat.sessionId || "unknown"} />
                      <MetaRow label="Message Index" value={String(chat.messageIndex ?? 0)} />
                      <MetaRow label="History Length" value={String(chat.historyLength ?? 0)} />
                      <MetaRow label="Message Length" value={String(chat.messageLength ?? 0)} />
                      <MetaRow label="IP Address" value={chat.ipAddress || "unknown"} />
                      <MetaRow label="Country" value={chat.country || "unknown"} />
                      <MetaRow label="Country Code" value={chat.countryCode || "unknown"} />
                      <MetaRow label="City" value={chat.city || "unknown"} />
                      <MetaRow label="Region" value={chat.region || "unknown"} />
                      <MetaRow label="Timezone" value={chat.timezone || "unknown"} />
                      <MetaRow label="Referrer" value={chat.referrer || "direct"} />
                    </div>

                    <div className="mt-3 text-xs text-gray-500 break-words">
                      <span className="font-semibold text-gray-600">User Agent:</span>{" "}
                      {chat.userAgent || "unknown"}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
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

export default Chats;
