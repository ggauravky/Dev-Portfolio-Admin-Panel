import { financePath, financeViews as views } from "../../routes/workspace";
import { InlineAlert, PageHeader } from "../../components/ui/Primitives";
import { Link, useParams } from "react-router-dom";
import Overview from "./finance/Overview";
import Registry from "./finance/Registry";
import Inspector from "./finance/Inspector";

const primary = ["overview", "transactions", "bookings", "support-payments"];
const diagnostics = ["receipts", "webhook-events", "reconciliation", "legacy-payments"];

export default function Finance({ fixedView }) {
  const params = useParams();
  const view = fixedView || params.view || "overview";
  const id = params.id;
  const allowed = Object.hasOwn(views,view);
  const invalidRecord = id && (!/^[a-f0-9]{24}$/i.test(id) || ["overview","reconciliation"].includes(view));
  return <div className="workspace-page">
    <PageHeader title={view === "overview" ? "Financial Control Center" : views[view] || "Financial Control Center"}
      description={view === "overview" ? "Recorded payments, bookings, and payment operations." : undefined} />
    {!id && <div className="finance-subnavigation">
      <nav aria-label="Financial views" className="workspace-tabs">
        {primary.map((key) => <Link key={key} to={financePath(key)} aria-current={key === view ? id ? "location" : "page" : undefined}>{views[key]}</Link>)}
      </nav>
      <nav aria-label="Payment diagnostics" className="workspace-tabs workspace-tabs-secondary">
        {diagnostics.map((key) => <Link key={key} to={financePath(key)} aria-current={key === view ? id ? "location" : "page" : undefined}>{views[key]}</Link>)}
      </nav>
    </div>}
    {!allowed || invalidRecord ? <InlineAlert tone="error">Financial view or record not found.</InlineAlert> :
     view === "overview" ? <Overview /> : id ? <Inspector key={view + id} view={view} id={id} /> : <Registry key={view} view={view} />}
  </div>;
}
