import { Button, control, heading, InlineAlert, panel } from "../../../components/ui/Primitives";
import { ConfirmDialog } from "../../../components/ui/Dialog";
import { LoadState } from "../../../components/data/Controls";
import { useResource } from "../../../hooks/useResource";
import { Table } from "../../../components/data/Records";
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
  function requestRevocation(scope, row) {
    if (active.current) return;
    if (scope === "all" || row?.current) setConfirmation({ scope, row });
    else void revoke(scope, row);
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
  return <section className={panel}>
    <h2 className={heading}>Active administrator sessions</h2>
    <p className="mt-1 text-sm text-muted">Up to 100 active sessions. Revoking the current session returns you to sign-in.</p>
    <div className="my-4 flex flex-wrap gap-2">
      <Button onClick={resource.refresh} disabled={pending}>Refresh sessions</Button>
      <Button onClick={() => requestRevocation("others")} disabled={pending || !resource.data}>Revoke other sessions</Button>
      <Button variant="destructive" onClick={() => requestRevocation("all")} disabled={pending || !resource.data}>Revoke all sessions</Button>
    </div>
    {notice && <InlineAlert className="mb-2" tone={notice.error ? "error" : "info"}>{notice.text}</InlineAlert>}
    <LoadState resource={resource} />
    {resource.data && <Table name="Active sessions" rows={resource.data.items} empty="No active sessions were returned." columns={[
      ["Session", (row) => row.current ? "Current session" : "Other session"], ["Created", (row) => displayDate(row.createdAt), "technical"],
      ["Last activity", (row) => displayDate(row.lastActivityAt), "technical"], ["Idle expiration", (row) => displayDate(row.idleExpiresAt), "technical"],
      ["Absolute expiration", (row) => displayDate(row.expiresAt), "technical"],
      ["Action", (row) => <Button disabled={pending} onClick={() => requestRevocation("one", row)}>{row.current ? "Revoke current session" : "Revoke session"}</Button>],
    ]} />}
    {confirmation && <ConfirmDialog title={confirmation.scope === "all" ? "Revoke all sessions?" : "Revoke current session?"}
      description="This signs you out and returns you to sign-in."
      action={confirmation.scope === "all" ? "Revoke all sessions" : "Revoke current session"}
      onDismiss={() => setConfirmation(null)} onConfirm={() => { setConfirmation(null); void revoke(confirmation.scope, confirmation.row); }} />}
  </section>;
}

export default function Security({ audit = false }) {
  const { id } = useParams();
  return <Workspace title="Administrator security" current={base}>
    <nav aria-label="Security views" className="flex flex-wrap gap-2">
      <Link className={control} to={base} aria-current={!audit ? "page" : undefined}>Active sessions</Link>
      <Link className={control} to={base + "/audit"} aria-current={audit ? "page" : undefined}>Audit events</Link>
    </nav>
    {!audit ? <Sessions /> : id ? <Inspector key={id} kind="audit-events" id={id} /> : <Registry kind="audit-events" />}
  </Workspace>;
}
