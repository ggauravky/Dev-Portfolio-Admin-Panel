/* eslint-disable react/prop-types */
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import AdminLayout from "../../components/AdminLayout";
import { getStats } from "../../services/api";
import { latency, percent } from "./chat/Shared";
import { formatPaise } from "./finance/money";

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastSync, setLastSync] = useState(new Date());

  useEffect(() => {
    fetchStats();
    const interval = setInterval(() => {
      setLastSync(new Date());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const fetchStats = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      const data = await getStats();
      setStats(data);
      setLastSync(new Date());
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
            <div className="relative w-16 h-16 mx-auto mb-4">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full animate-spin blur"></div>
              <div className="absolute inset-1 bg-white rounded-full"></div>
              <div className="absolute inset-3 bg-gradient-to-r from-blue-600 to-cyan-600 rounded-full animate-spin"></div>
            </div>
            <p className="text-gray-600 font-medium">Loading dashboard...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  const chat = stats?.chatSummary;
  const counts = [stats?.totalContacts, stats?.totalNewsletters];
  const totalEntities = counts.every(Number.isFinite) ? counts.reduce((sum, count) => sum + count, 0) : "Unavailable";

  const cards = [
    {
      title: "Contacts",
      value: stats?.totalContacts ?? "Unavailable",
      change: `${stats?.unreadContacts ?? "—"} unread`,
      gradient: "from-blue-500 to-indigo-600",
      icon: "📧",
      color: "blue",
      path: "/admin/contacts",
    },
    {
      title: "Bookings · 7 days",
      value: stats?.totalBookings ?? "Unavailable",
      change: `${stats?.paidBookings ?? "—"} paid, ${stats?.pendingBookings ?? "—"} pending`,
      gradient: "from-emerald-500 to-cyan-600",
      icon: "📅",
      color: "emerald",
      path: "/admin/bookings",
    },
    {
      title: "Support Payments · 7 days",
      value: stats?.totalSupportPayments ?? "Unavailable",
      change: `${stats?.paidSupportPayments ?? "—"} paid, ${stats?.pendingSupportPayments ?? "—"} pending`,
      gradient: "from-amber-500 to-orange-600",
      icon: "💸",
      color: "amber",
      path: "/admin/support-payments",
    },
    {
      title: "Newsletter",
      value: stats?.totalNewsletters ?? "Unavailable",
      change: `${stats?.unsubscribedNewsletters ?? "—"} unsubscribed`,
      gradient: "from-emerald-500 to-teal-600",
      icon: "📬",
      color: "teal",
      path: "/admin/newsletter",
    },
    {
      title: "Recorded Chat Turns · 7 days",
      value: chat?.turns ?? "Unavailable",
      change: chat ? `${chat.conversations} conversations · ${percent(chat.cacheRate)} cache hits · ${latency(chat.medianMs)} median` : "Recorded chat metrics unavailable",
      gradient: "from-cyan-500 to-blue-700",
      icon: "💬",
      color: "cyan",
      path: "/admin/chats",
    },
  ];

  const formatTime = (date) => {
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    }).format(date);
  };

  return (
    <AdminLayout>
      <div className="px-4 py-6">
        {/* Header Section */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-4 mb-6">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <h1 className="text-5xl font-bold bg-gradient-to-r from-slate-900 via-blue-700 to-cyan-700 bg-clip-text text-transparent">
                  Dashboard
                </h1>
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-green-100 text-green-800 text-xs font-semibold">
                  <span className="w-2 h-2 rounded-full bg-green-600 animate-pulse"></span>{" "}
                  Live
                </span>
              </div>
              <p className="text-gray-600 leading-relaxed">
                Real-time overview of all platform activities and metrics
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right text-sm hidden sm:block">
                <p className="text-gray-600">Last updated</p>
                <p className="font-semibold text-gray-900">{formatTime(lastSync)}</p>
              </div>
              <button
                onClick={() => fetchStats(true)}
                disabled={refreshing}
                className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 disabled:opacity-60 transition-all duration-200 shadow-lg hover:shadow-xl group"
              >
                <svg
                  className={`w-5 h-5 ${refreshing ? "animate-spin" : "group-hover:rotate-180 transition-transform"}`}
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
                <span className="font-medium">{refreshing ? "Syncing..." : "Refresh"}</span>
              </button>
            </div>
          </div>

          {/* Stats Summary Bar */}
          <div className="flex flex-wrap gap-3">
            <div className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 text-sm">
              <span className="text-gray-600">Contacts and subscriptions</span>
              <span className="ml-2 font-bold text-gray-900">{totalEntities.toLocaleString()}</span>
            </div>
            <div className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-50 to-blue-50 border border-cyan-200 text-sm">
              <span className="text-gray-600">Chat storage</span>
              <span className="ml-2 font-bold text-gray-900">{stats?.availability?.chat === "available" ? "Available" : "Unavailable"}</span>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 flex items-start gap-3">
            <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <div>
              <p className="font-semibold text-red-900">Error</p>
              <p className="text-red-800">{error}</p>
            </div>
          </div>
        )}

        {/* Main Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6 gap-5 mb-8">
          {cards.map((card) => (
            <Link
              to={card.path}
              key={card.title}
              className="group"
            >
              <div className={`relative overflow-hidden rounded-2xl p-6 text-white shadow-lg hover:shadow-2xl transition-all duration-300 bg-gradient-to-br ${card.gradient} hover:scale-105 h-full`}>
                {/* Animated background elements */}
                <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500"></div>
                <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-white/5 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500"></div>

                <div className="relative z-10">
                  {/* Header with icon */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="text-4xl">{card.icon}</div>
                    <div className="px-2 py-1 rounded-lg bg-white/20 backdrop-blur text-xs font-semibold">
                      {card.color}
                    </div>
                  </div>

                  {/* Title */}
                  <p className="text-white/90 text-sm font-medium tracking-wide">{card.title}</p>

                  {/* Value */}
                  <div className="mt-3 mb-2">
                    <div className="text-4xl font-bold text-white">{card.value.toLocaleString()}</div>
                  </div>

                  {/* Change indicator */}
                  <div className="flex items-center justify-between">
                    <p className="text-white/80 text-xs">{card.change}</p>
                    <svg className="w-4 h-4 text-white/60 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>

        <FinancialSnapshot report={stats?.financialSummary} />

        {/* Lower Section - Quick Access & Insights */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Quick Actions */}
          <div className="lg:col-span-2 rounded-2xl border border-gray-200/50 bg-white/80 backdrop-blur shadow-lg hover:shadow-xl transition-all duration-300 p-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Quick Actions</h2>
                <p className="text-gray-600 text-sm mt-1">Navigate to main sections</p>
              </div>
              <div className="p-3 rounded-lg bg-gradient-to-br from-blue-100 to-indigo-100">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {cards.map((card) => (
                <Link
                  key={card.title}
                  to={card.path}
                  className={`group p-4 rounded-xl border-2 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 bg-gradient-to-br border-${card.color}-200 bg-${card.color}-50 hover:bg-${card.color}-100`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-2xl">{card.icon}</div>
                    <div className={`text-xs font-bold px-2 py-1 rounded-full bg-${card.color}-200 text-${card.color}-800`}>
                      NEW
                    </div>
                  </div>
                  <h3 className={`font-bold text-gray-900 mb-1`}>{card.title}</h3>
                  <p className={`text-xl font-bold text-${card.color}-600 mb-2`}>{card.value.toLocaleString()}</p>
                  <p className="text-xs text-gray-600">{card.change}</p>
                </Link>
              ))}
            </div>
          </div>

          {/* System Signals */}
          <div className="rounded-2xl border border-gray-200/50 bg-white/80 backdrop-blur shadow-lg hover:shadow-xl transition-all duration-300 p-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">System Signals</h2>
                <p className="text-gray-600 text-sm mt-1">Live metrics</p>
              </div>
              <div className="p-3 rounded-lg bg-gradient-to-br from-amber-100 to-orange-100">
                <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
            </div>

            <div className="space-y-3">
              <SignalRow
                label="Unread Contacts"
                value={stats?.unreadContacts ?? "Unavailable"}
                tone="amber"
                icon="📧"
              />
              <SignalRow
                label="Unsubscribed"
                value={stats?.unsubscribedNewsletters ?? "Unavailable"}
                tone="slate"
                icon="☰"
              />
            </div>
          </div>
        </div>

        {/* Footer Info */}
        <div className="mt-8 p-4 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 text-center">
          <p className="text-sm text-gray-700">
            💡 <strong>Tip:</strong> Click on any card to view detailed information and manage records. Your dashboard syncs in real-time.
          </p>
        </div>
      </div>
    </AdminLayout>
  );
};

function FinancialSnapshot({ report }) {
  const payments = report?.transactions?.data;
  const bookings = report?.bookings?.data;
  const webhooks = report?.webhooks?.data;
  const metrics = [
    ["Paid services", payments && formatPaise(payments.paid.servicePaise), "/admin/financial/transactions"],
    ["Paid support", payments && formatPaise(payments.paid.supportPaise), "/admin/support-payments"],
    ["Pending service attempts", payments?.attempts.pendingService, "/admin/financial/transactions"],
    ["Recorded paid bookings", bookings?.confirmedPaid, "/admin/bookings"],
    ["Failed customer emails", payments?.attempts.receiptFailures, "/admin/financial/receipts"],
    ["Failed webhooks", webhooks?.failed, "/admin/financial/webhook-events"],
  ];
  return <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-5">
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <h2 className="text-lg font-semibold text-slate-900">Financial snapshot · last 7 days (IST)</h2>
      <Link className="text-sm font-semibold text-teal-800 underline" to="/admin/financial">Open Financial Control Center</Link>
    </div>
    <p className="mt-1 text-sm text-slate-600">Paid totals use recorded payment dates. Razorpay test or live mode is unverified.</p>
    <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {metrics.map(([label, value, path]) => <div key={label} className="rounded-lg border border-slate-200 p-3">
        <dt className="text-sm"><Link className="text-teal-800 underline" to={path}>{label}</Link></dt>
        <dd className="mt-1 break-words font-semibold text-slate-900">{value ?? "Unavailable"}</dd>
      </div>)}
    </dl>
  </section>;
}

const SignalRow = ({ label, value, tone, icon }) => {
  const tones = {
    amber: "bg-amber-50 border-amber-200 text-amber-800 bg-gradient-to-r from-amber-50 to-orange-50",
    red: "bg-red-50 border-red-200 text-red-800 bg-gradient-to-r from-red-50 to-rose-50",
    blue: "bg-blue-50 border-blue-200 text-blue-800 bg-gradient-to-r from-blue-50 to-cyan-50",
    emerald: "bg-emerald-50 border-emerald-200 text-emerald-800 bg-gradient-to-r from-emerald-50 to-teal-50",
    slate: "bg-slate-100 border-slate-200 text-slate-800 bg-gradient-to-r from-slate-50 to-gray-100",
  };

  return (
    <div className={`rounded-xl border px-4 py-3 transition-all duration-300 hover:shadow-md ${tones[tone] || tones.blue} group`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">{icon}</span>
          <div className="text-xs uppercase tracking-wide opacity-80">{label}</div>
        </div>
        <div className="text-xl font-bold">{value}</div>
      </div>
      <div className="mt-2 h-1 rounded-full bg-black/10 overflow-hidden">
        <div className="h-full bg-current opacity-30 rounded-full" style={{ width: `${Math.min(Number.parseInt(value, 10) / 100 * 100, 100)}%` }}></div>
      </div>
    </div>
  );
};

export default Dashboard;
