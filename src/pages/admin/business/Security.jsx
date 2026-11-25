import { Button, InlineAlert } from "../../../components/ui/Primitives";
import { ConfirmDialog } from "../../../components/ui/Dialog";
import { LoadState } from "../../../components/data/Controls";
import { useResource } from "../../../hooks/useResource";
import { Table } from "../../../components/data/Records";
import { EditorialSection } from "../../../components/data/Editorial";
import { displayDate } from "../../../components/data/format";
import { Workspace } from "./Shared";
import { useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getAdminSessions, revokeAdminSessions, clearRevokedSession } from "../../../services/api";
import { useAdminAuth } from "../../../context/AdminAuth";

import { Inspector, Registry } from "./Registry";

const base = "/admin/security";

function Sessions() {
  const { details } = useAdminAuth();
  const resource = useResource(getAdminSessions);
  const active = useRef(false);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState(null);
  const [confirmation, setConfirmation] = useState(null);
  function requestRevocation(scope, row, trigger) {
    if (active.current) return;
    if (scope !== "all" && !row?.current) return void revoke(scope, row);
    trigger.focus({ preventScroll: true });
    setConfirmation({ scope, row });
  }
  async function revoke(scope, row) {
    if (active.current) return;
    const endsThis = scope === "all" || row?.current;
    active.current = true;
    setPending(true);
    setNotice(null);
    try {
      const { data } = await revokeAdminSessions(scope, row?.id, details.csrfToken);
      if (endsThis) clearRevokedSession();
      else { setNotice({ error: false, text: `${data.revoked} session${data.revoked === 1 ? "" : "s"} revoked.` }); resource.refresh(); }
    } catch (error) {
      setNotice({ error: true, text: error.message });
      if (error.status !== 401) resource.refresh();
    } finally { active.current = false; setPending(false); }
  }
  return <EditorialSection title="Active administrator sessions" description="Up to 100 sessions. Revoking the current session returns you to sign-in.">
    <div className="my-4 flex flex-wrap gap-2">
      <Button onClick={resource.refresh} disabled={pending}>Refresh sessions</Button>
      <Button onClick={() => requestRevocation("others")} disabled={pending || !resource.data}>Revoke other sessions</Button>
      <Button variant="destructive" onClick={(event) => requestRevocation("all", undefined, event.currentTarget)} disabled={pending || !resource.data}>Revoke all sessions</Button>
    </div>
    {notice && <InlineAlert className="mb-2" tone={notice.error ? "error" : "info"}>{notice.text}</InlineAlert>}
    <LoadState resource={resource} />
    {resource.data && <Table name="Active sessions" rows={resource.data.items} empty="No active sessions were returned." columns={[
      ["Session", (row) => row.current ? <span className="session-current">Current session</span> : "Other session"], ["Created", (row) => displayDate(row.createdAt), "technical"],
      ["Last activity", (row) => displayDate(row.lastActivityAt), "technical"], ["Idle expiration", (row) => displayDate(row.idleExpiresAt), "technical"],
      ["Absolute expiration", (row) => displayDate(row.expiresAt), "technical"],
      ["Action", (row) => <Button disabled={pending} onClick={(event) => requestRevocation("one", row, event.currentTarget)}>{row.current ? "Revoke current session" : "Revoke session"}</Button>],
    ]} />}
    {confirmation && <ConfirmDialog title={confirmation.scope === "all" ? "Revoke all sessions?" : "Revoke current session?"}
      description="This signs you out and returns you to sign-in."
      action={confirmation.scope === "all" ? "Revoke all sessions" : "Revoke current session"}
      onDismiss={() => setConfirmation(null)} onConfirm={() => { setConfirmation(null); void revoke(confirmation.scope, confirmation.row); }} />}
  </EditorialSection>;
}

export default function Security({ audit = false }) {
  const { id } = useParams();
  return <Workspace title="Administrator security">
    <nav aria-label="Security views" className="workspace-tabs">
      <Link to={base} aria-current={!audit ? "page" : undefined}>Active sessions</Link>
      <Link to={base + "/audit"} aria-current={audit ? id ? "location" : "page" : undefined}>Audit history</Link>
    </nav>
    {!audit ? <Sessions /> : id ? <Inspector key={id} kind="audit-events" id={id} /> : <Registry kind="audit-events" />}
  </Workspace>;
}
