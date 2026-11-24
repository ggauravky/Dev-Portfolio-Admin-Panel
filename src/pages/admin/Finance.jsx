import { Link, useParams } from "react-router-dom";
import AdminLayout from "../../components/AdminLayout";
import Overview from "./finance/Overview";
import Registry from "./finance/Registry";
import Inspector from "./finance/Inspector";
import { financePath } from "./finance/Shared";
import { control } from "./chat/Shared";

const views = {
  overview: "Overview", transactions: "Transactions", bookings: "Bookings", "support-payments": "Support payments",
  receipts: "Receipts", "webhook-events": "Webhook events", reconciliation: "Reconciliation", "legacy-payments": "Legacy payments",
};

export default function Finance({ fixedView }) {
  const params = useParams();
  const view = fixedView || params.view || "overview";
  const id = params.id;
  const allowed = Object.hasOwn(views,view);
  const invalidRecord = id && (!/^[a-f0-9]{24}$/i.test(id) || ["overview","reconciliation"].includes(view));
  return <AdminLayout><div className="px-4 sm:px-0 space-y-5 min-w-0">
    <header>
      <h1 className="text-3xl font-bold text-slate-900">Financial Control Center</h1>
      <p className="mt-2 text-sm text-slate-600">Read-only access to recorded payments, bookings, receipts, and webhook diagnostics.</p>
    </header>
    <nav aria-label="Financial views" className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
      {Object.entries(views).map(([key,label]) => <Link key={key} to={financePath(key)}
        aria-current={key === view ? "page" : undefined} className={control + (key === view ? " !border-teal-700 !bg-teal-50" : "")}>{label}</Link>)}
    </nav>
    {!allowed || invalidRecord ? <p role="alert">Financial view or record not found.</p> :
     view === "overview" ? <Overview /> : id ? <Inspector key={view + id} view={view} id={id} /> : <Registry key={view} view={view} />}
  </div></AdminLayout>;
}
