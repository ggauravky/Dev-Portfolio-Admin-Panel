import { control } from "../../../components/ui/Primitives";
import { LoadState } from "../../../components/data/Controls";
import { useResource } from "../../../hooks/useResource";
import { Table, linkClass, MetricSection } from "../../../components/data/Records";
import { displayDate, words } from "../../../components/data/format";
import { Workspace } from "./Shared";
import { Link } from "react-router-dom";
import { getSystemStatus } from "../../../services/api";

const labels = { primary: "Portfolio database", chat: "Chat database", admin: "Admin security database" };

export default function System({ settings = false }) {
  const resource = useResource(getSystemStatus);
  const report = resource.data;
  const policy = report?.policy;
  const title = settings ? "Settings" : "System health";
  return <Workspace title={title} current={settings ? "/admin/settings" : "/admin/system"}>
    <button className={control} type="button" onClick={resource.refresh}>Refresh {settings ? "settings" : "health"}</button>
    <LoadState resource={resource} />
    {report && <>
      {settings ? <MetricSection title="Configuration summary" fields={[["Business data", report.readOnly ? "Read-only" : "Unknown"],
        ["Reporting timezone", policy?.timezone], ["Session idle timeout", policy && `${policy.idleMinutes} minutes`],
        ["Session absolute timeout", policy && `${policy.maxHours} hours`], ["Audit retention", policy && `${policy.auditDays} days`],
        ["Chat turn retention policy", policy?.chatRetention && `${policy.chatRetention.turnRetentionDays} days`],
        ["Chat cache retention policy", policy?.chatRetention && `${policy.chatRetention.cacheRetentionHours} hours`],
        ["Portfolio source revision", policy?.portfolioRevision], ["Portfolio contract revision", policy?.contractRevision], ["Backend application version", policy?.version],
        ["Checked", displayDate(report.checkedAt)]]} /> : <>
        <MetricSection title="Dependencies and readiness" fields={[["API process", words(report.process)], ["API ready", report.ready ? "Ready" : "Unavailable"],
          ["Configuration", words(report.configuration)], ["Business data", report.readOnly ? "Read-only" : "Unknown"], ["Checked", displayDate(report.checkedAt)],
          ...Object.entries(labels).map(([key, label]) => [label, words(report.dependencies[key])])]} />
        <MetricSection title="Optional collections" description="Available collections passed a bounded read check. Unknown means the collection was outside the connection’s visible inventory."
          fields={Object.entries(report.optionalCollections).map(([key, value]) => [key, words(value)])} />
        <div className="flex flex-wrap gap-4"><Link className={linkClass} to="/admin/chats">AI diagnostics and chat retention</Link>
          <Link className={linkClass} to="/admin/financial/reconciliation">Financial reconciliation</Link></div>
      </>}
      <MetricSection title="Administrative capabilities">
        <Table name="Administrative capabilities" rows={Object.entries(report.capabilities).map(([name, value]) => ({ id: name, name, ...value }))}
          columns={[["Resource", (row) => row.name], ["Read", (row) => row.read ? "Available" : "Disabled"],
            ["Actions", (row) => row.revoke ? "Revoke sessions" : row.write ? "Write" : "Read-only"]]} />
      </MetricSection>
    </>}
  </Workspace>;
}
