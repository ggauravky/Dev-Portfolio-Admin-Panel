import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import AdminLayout from "../../components/AdminLayout";
import { getStats } from "../../services/api";

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      const data = await getStats();
      setStats(data);
    } catch (fetchError) {
      console.error("Error fetching stats:", fetchError);
      setError("Failed to load dashboard stats. Please try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex justify-center items-center py-20">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
            <p className="text-gray-600">Loading dashboard...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  const cards = [
    {
      title: "Contacts",
      value: stats?.totalContacts || 0,
      hint: `${stats?.unreadContacts || 0} unread`,
      gradient: "from-blue-500 to-indigo-600",
      path: "/admin/contacts",
    },
    {
      title: "Newsletter Subscribers",
      value: stats?.totalNewsletters || 0,
      hint: `${stats?.unsubscribedNewsletters || 0} unsubscribed`,
      gradient: "from-emerald-500 to-teal-600",
      path: "/admin/newsletter",
    },
    {
      title: "AI Chat Logs",
      value: stats?.totalChats || 0,
      hint: `${stats?.degradedChats || 0} degraded sessions`,
      gradient: "from-cyan-500 to-blue-700",
      path: "/admin/chats",
    },
    {
      title: "Fallback Responses",
      value: stats?.fallbackChats || 0,
      hint: `Avg latency: ${stats?.avgChatResponseMs ? `${stats.avgChatResponseMs} ms` : "N/A"}`,
      gradient: "from-amber-500 to-orange-600",
      path: "/admin/chats",
    },
  ];

  return (
    <AdminLayout>
      <div className="px-4">
        <div className="mb-8">
          <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-slate-900 via-blue-700 to-cyan-700 bg-clip-text text-transparent mb-2">
                Admin Overview
              </h1>
              <p className="text-gray-600">
                Track conversations, visitors, and subscriptions from one dashboard.
              </p>
            </div>
            <button
              onClick={() => fetchStats(true)}
              disabled={refreshing}
              className="flex items-center px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
            >
              <svg
                className={`w-5 h-5 mr-2 ${refreshing ? "animate-spin" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl mb-6">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
          {cards.map((card) => (
            <Link
              to={card.path}
              key={card.title}
              className={`group rounded-2xl p-6 text-white shadow-lg hover:shadow-2xl transition-all duration-300 bg-gradient-to-br ${card.gradient}`}
            >
              <div className="text-white/80 text-sm font-medium">{card.title}</div>
              <div className="text-5xl font-bold mt-2">{card.value}</div>
              <div className="text-white/80 mt-3 text-sm">{card.hint}</div>
            </Link>
          ))}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 bg-white rounded-2xl shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-5">Quick Actions</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Link
                to="/admin/contacts"
                className="p-4 rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100 transition-colors"
              >
                <div className="text-sm font-semibold text-blue-700">Contacts</div>
                <div className="text-2xl font-bold text-gray-900 mt-2">{stats?.totalContacts || 0}</div>
                <p className="text-sm text-gray-600 mt-1">Review incoming messages</p>
              </Link>
              <Link
                to="/admin/newsletter"
                className="p-4 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 transition-colors"
              >
                <div className="text-sm font-semibold text-emerald-700">Newsletter</div>
                <div className="text-2xl font-bold text-gray-900 mt-2">{stats?.totalNewsletters || 0}</div>
                <p className="text-sm text-gray-600 mt-1">Manage subscriber status</p>
              </Link>
              <Link
                to="/admin/chats"
                className="p-4 rounded-xl border border-cyan-200 bg-cyan-50 hover:bg-cyan-100 transition-colors"
              >
                <div className="text-sm font-semibold text-cyan-700">AI Chats</div>
                <div className="text-2xl font-bold text-gray-900 mt-2">{stats?.totalChats || 0}</div>
                <p className="text-sm text-gray-600 mt-1">Inspect user/AI conversations</p>
              </Link>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-5">System Signals</h2>
            <div className="space-y-3">
              <SignalRow
                label="Unread contacts"
                value={stats?.unreadContacts || 0}
                tone="amber"
              />
              <SignalRow
                label="Degraded chat responses"
                value={stats?.degradedChats || 0}
                tone="red"
              />
              <SignalRow
                label="Fallback model responses"
                value={stats?.fallbackChats || 0}
                tone="blue"
              />
              <SignalRow
                label="Average chat response"
                value={stats?.avgChatResponseMs ? `${stats.avgChatResponseMs} ms` : "N/A"}
                tone="emerald"
              />
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

const SignalRow = ({ label, value, tone }) => {
  const tones = {
    amber: "bg-amber-50 border-amber-200 text-amber-800",
    red: "bg-red-50 border-red-200 text-red-800",
    blue: "bg-blue-50 border-blue-200 text-blue-800",
    emerald: "bg-emerald-50 border-emerald-200 text-emerald-800",
  };

  return (
    <div className={`rounded-xl border px-4 py-3 ${tones[tone] || tones.blue}`}>
      <div className="text-xs uppercase tracking-wide opacity-80">{label}</div>
      <div className="text-lg font-bold mt-1">{value}</div>
    </div>
  );
};

export default Dashboard;
