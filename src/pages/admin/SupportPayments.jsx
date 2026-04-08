import { useEffect, useState } from "react";
import AdminLayout from "../../components/AdminLayout";
import {
  bulkDeleteSupportPayments,
  deleteSupportPayment,
  getSupportPayments,
} from "../../services/api";

const PAYMENT_STATUS_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "created", label: "Created" },
  { value: "pending", label: "Pending" },
  { value: "paid", label: "Paid" },
  { value: "failed", label: "Failed" },
];

const PAYMENT_PROVIDER_OPTIONS = [{ value: "all", label: "All Providers" }, { value: "cashfree", label: "Cashfree" }];

const SupportPayments = () => {
  const [payments, setPayments] = useState([]);
  const [filteredPayments, setFilteredPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPayments, setSelectedPayments] = useState([]);
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState("desc");
  const [statusFilter, setStatusFilter] = useState("all");
  const [providerFilter, setProviderFilter] = useState("all");

  useEffect(() => {
    fetchPayments();
  }, [sortBy, sortOrder, statusFilter, providerFilter]);

  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredPayments(payments);
      return;
    }

    const term = searchTerm.toLowerCase();
    setFilteredPayments(
      payments.filter((payment) =>
        [
          payment.contributorName,
          payment.email,
          payment.phone,
          payment.message,
          payment.orderId,
          payment.paymentId,
          payment.paymentStatus,
          payment.paymentProvider,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term))
      )
    );
  }, [searchTerm, payments]);

  const fetchPayments = async () => {
    try {
      setError(null);
      const data = await getSupportPayments({
        sortBy,
        order: sortOrder,
        ...(statusFilter !== "all" ? { paymentStatus: statusFilter } : {}),
        ...(providerFilter !== "all" ? { paymentProvider: providerFilter } : {}),
      });
      const paymentList = data.supportPayments || data;
      setPayments(paymentList);
      setFilteredPayments(paymentList);
    } catch (fetchError) {
      console.error("Error fetching support payments:", fetchError);
      setError("Failed to load support payments. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!globalThis.confirm("Are you sure you want to delete this support payment?")) return;

    try {
      await deleteSupportPayment(id);
      setPayments(payments.filter((payment) => payment._id !== id));
      setError(null);
    } catch (deleteError) {
      console.error("Error deleting support payment:", deleteError);
      setError("Failed to delete support payment. Please try again.");
    }
  };

  const handleBulkDelete = async () => {
    if (selectedPayments.length === 0) return;
    if (!globalThis.confirm(`Delete ${selectedPayments.length} selected support payment(s)?`)) return;

    try {
      await bulkDeleteSupportPayments(selectedPayments);
      setPayments(payments.filter((payment) => !selectedPayments.includes(payment._id)));
      setSelectedPayments([]);
      setError(null);
    } catch (bulkError) {
      console.error("Error bulk deleting support payments:", bulkError);
      setError("Failed to delete selected support payments.");
    }
  };

  const toggleSelectPayment = (id) => {
    setSelectedPayments((prev) =>
      prev.includes(id) ? prev.filter((paymentId) => paymentId !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedPayments.length === filteredPayments.length) {
      setSelectedPayments([]);
      return;
    }
    setSelectedPayments(filteredPayments.map((payment) => payment._id));
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

  const formatCurrency = (amount) => {
    if (typeof amount !== "number") return "₹0";
    return `₹${amount.toLocaleString("en-IN")}`;
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="h-14 w-14 rounded-full border-b-2 border-emerald-600 animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">Loading support payments...</p>
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
            <h1 className="text-4xl font-bold bg-gradient-to-r from-emerald-600 to-cyan-600 bg-clip-text text-transparent">
              Support Payments
            </h1>
            <p className="text-gray-600 mt-2">
              Review donor contributions, statuses, and payment metadata.
            </p>
          </div>
          {selectedPayments.length > 0 && (
            <button
              onClick={handleBulkDelete}
              className="px-4 py-2 rounded-xl bg-red-600 text-white hover:bg-red-700"
            >
              Delete Selected ({selectedPayments.length})
            </button>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search name, email, order ID, payment ID..."
              className="xl:col-span-2 px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {PAYMENT_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select
              value={providerFilter}
              onChange={(e) => setProviderFilter(e.target.value)}
              className="px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {PAYMENT_PROVIDER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="createdAt">Date</option>
              <option value="contributorName">Name</option>
              <option value="amount">Amount</option>
              <option value="paymentStatus">Status</option>
              <option value="paidAt">Paid Date</option>
            </select>
          </div>

          <div className="mt-3 flex items-center gap-3">
            <button
              onClick={() => setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"))}
              className="px-4 py-2 border border-gray-200 rounded-xl bg-gray-50 hover:bg-gray-100"
            >
              {sortOrder === "asc" ? "Asc" : "Desc"}
            </button>
            <button
              onClick={fetchPayments}
              className="px-4 py-2 border border-gray-200 rounded-xl bg-gray-50 hover:bg-gray-100"
            >
              Refresh
            </button>
            <div className="ml-auto text-sm text-gray-600">
              Showing {filteredPayments.length} of {payments.length} payment(s)
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-6">
            {error}
          </div>
        )}

        {filteredPayments.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-lg p-10 text-center text-gray-500">
            No support payments found for current filters.
          </div>
        ) : (
          <>
            <div className="bg-white rounded-2xl shadow-lg p-4 mb-4">
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={selectedPayments.length > 0 && selectedPayments.length === filteredPayments.length}
                  onChange={toggleSelectAll}
                  className="w-5 h-5 rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span className="font-medium text-gray-700">
                  {selectedPayments.length === filteredPayments.length
                    ? "Deselect All"
                    : "Select All"}{" "}
                  ({filteredPayments.length})
                </span>
              </label>
            </div>

            <div className="space-y-4">
              {filteredPayments.map((payment) => {
                const statusTone = {
                  created: "bg-slate-100 text-slate-700",
                  pending: "bg-amber-100 text-amber-800",
                  paid: "bg-emerald-100 text-emerald-800",
                  failed: "bg-red-100 text-red-800",
                }[payment.paymentStatus || "created"];

                return (
                  <div key={payment._id} className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100 hover:shadow-xl transition-all">
                    <div className="flex items-start gap-4">
                      <input
                        type="checkbox"
                        checked={selectedPayments.includes(payment._id)}
                        onChange={() => toggleSelectPayment(payment._id)}
                        className="mt-1 w-5 h-5 text-emerald-600 rounded focus:ring-2 focus:ring-emerald-500"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-3">
                          <h3 className="text-lg font-bold text-gray-900">{payment.contributorName || "Unknown"}</h3>
                          <span className={`text-xs px-2 py-1 rounded-full font-semibold ${statusTone}`}>{payment.paymentStatus || "created"}</span>
                          <span className="text-xs px-2 py-1 rounded-full bg-cyan-100 text-cyan-700 font-semibold">
                            {payment.paymentProvider || "cashfree"}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 mb-3 text-sm">
                          <MetaRow label="Email" value={payment.email || "N/A"} />
                          <MetaRow label="Phone" value={payment.phone || "N/A"} />
                          <MetaRow label="Amount" value={formatCurrency(payment.amount)} />
                          <MetaRow label="Order ID" value={payment.orderId || "N/A"} />
                          <MetaRow label="Payment ID" value={payment.paymentId || "N/A"} />
                          <MetaRow label="Paid At" value={formatDate(payment.paidAt)} />
                        </div>

                        {payment.message && (
                          <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 text-sm text-gray-700 mb-3">
                            {payment.message}
                          </div>
                        )}

                        <div className="text-xs text-gray-500 flex flex-wrap gap-4">
                          <span>Created: {formatDate(payment.createdAt)}</span>
                          <span>Updated: {formatDate(payment.updatedAt)}</span>
                        </div>
                      </div>

                      <button
                        onClick={() => handleDelete(payment._id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                        title="Delete"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
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

const MetaRow = ({ label, value }) => (
  <div className="bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
    <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">{label}</div>
    <div className="font-medium text-gray-800 break-words">{value}</div>
  </div>
);

export default SupportPayments;