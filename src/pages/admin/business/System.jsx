import { control } from "../../../components/ui/Primitives";
import { LoadState } from "../../../components/data/Controls";
import { useResource } from "../../../hooks/useResource";
import { Badge, Fields, Table, linkClass, MetricSection } from "../../../components/data/Records";
import { EditorialSection } from "../../../components/data/Editorial";
import { displayDate, words } from "../../../components/data/format";
import { Workspace } from "./Shared";
import { Link } from "react-router-dom";
import { getSystemStatus } from "../../../services/api";

const labels = { primary: "Portfolio database", chat: "Chat database" };

export default function System({ settings = false }) {
  const resource = useResource(getSystemStatus);
  const report = resource.data;
  const policy = report?.policy;
  const title = settings ? "Settings" : "System health";
  return <Workspace title={title} description={settings ? "Read-only configuration for this workspace." : "Dependency availability and operational readiness."}>
    <div className="flex flex-wrap items-center gap-4"><button className={control} type="button" onClick={resource.refresh}>Refresh {settings ? "settings" : "health"}</button>
      {settings && <Link className={linkClass} to="/admin/system">Open system health</Link>}
    </div>
    <LoadState resource={resource} />
    {report && <>
      {settings ? <EditorialSection title="Configuration summary"><Fields fields={[["Business data", report.readOnly ? "Read-only" : "Unknown"],
        ["Reporting timezone", policy?.timezone], ["Session lifetime", policy && `${policy.maxHours} hours, then sign in again`],
        ["Session storage", policy && "Signed HttpOnly cookie. Not stored in MongoDB. Signing out clears this browser only; changing the password or signing secret ends every session."],
        ["Security events", "Written to the API host logs only. No persistent audit history."],
        ["Chat turn retention policy", policy?.chatRetention && `${policy.chatRetention.turnRetentionDays} days`],
        ["Chat cache retention policy", policy?.chatRetention && `${policy.chatRetention.cacheRetentionHours} hours`],
        ["Portfolio source revision", policy?.portfolioRevision, true], ["Portfolio contract revision", policy?.contractRevision, true], ["Backend application version", policy?.version, true],
        ["Checked", displayDate(report.checkedAt), true]]} /></EditorialSection> : <>
        <EditorialSection title="Dependencies and readiness" description={`Last checked ${displayDate(report.checkedAt)}`}>
          <div className="overview-operations"><ul>{Object.entries(labels).map(([key, label]) => <li key={key}><span>{label}</span><Badge value={report.dependencies[key]} /></li>)}</ul>
            <ul><li><span>API ready</span><Badge value={report.ready ? "ready" : "unavailable"} /></li><li><span>API process</span><Badge value={report.process} /></li>
              <li><span>Business data</span><span>{report.readOnly ? "Read-only" : "Unknown"}</span></li><li><span>Configuration</span><span>{words(report.configuration)}</span></li></ul>
          </div>
        </EditorialSection>
        <MetricSection title="Optional collections" description="Available collections passed a bounded read check. Unknown means the collection was outside the connection’s visible inventory."
          fields={Object.entries(report.optionalCollections).map(([key, value]) => [key, words(value)])} />
        <div className="flex flex-wrap gap-4"><Link className={linkClass} to="/admin/chats?view=operations">AI diagnostics and chat retention</Link>
          <Link className={linkClass} to="/admin/financial/reconciliation">Financial reconciliation</Link></div>
      </>}
      <MetricSection title="Administrative capabilities">
        <Table name="Administrative capabilities" rows={Object.entries(report.capabilities).map(([name, value]) => ({ id: name, name, ...value }))}
          columns={[["Resource", (row) => row.name], ["Read", (row) => row.read ? "Available" : "Disabled"],
            ["Actions", (row) => row.write ? "Write" : "Read-only"]]} />
      </MetricSection>
    </>}
  </Workspace>;
}
