import { financePath } from "./finance/Shared";
import { control, InlineAlert, PageHeader } from "../../components/ui/Primitives";
import { Link, useParams } from "react-router-dom";
import AdminLayout from "../../components/AdminLayout";
import Overview from "./finance/Overview";
import Registry from "./finance/Registry";
import Inspector from "./finance/Inspector";

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
  return <AdminLayout><div className="space-y-5 min-w-0">
    <PageHeader title="Financial Control Center" description="Read-only access to recorded payments, bookings, receipts, and webhook diagnostics." />
    <nav aria-label="Financial views" className="flex flex-wrap gap-2 border-b border-rule pb-3">
      {Object.entries(views).map(([key,label]) => <Link key={key} to={financePath(key)}
        aria-current={key === view ? "page" : undefined} className={control}>{label}</Link>)}
    </nav>
    {!allowed || invalidRecord ? <InlineAlert tone="error">Financial view or record not found.</InlineAlert> :
     view === "overview" ? <Overview /> : id ? <Inspector key={view + id} view={view} id={id} /> : <Registry key={view} view={view} />}
  </div></AdminLayout>;
}
