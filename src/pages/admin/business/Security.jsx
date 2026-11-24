import { useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getAdminSessions, revokeAdminSessions, clearRevokedSession } from "../../../services/api";
import { useAdminAuth } from "../../../context/AdminAuth";
import { control, LoadState, panel, useChatResource } from "../chat/Shared";
import { Table } from "../finance/Shared";
import { displayDate, Workspace } from "./Shared";
import { Inspector, Registry } from "./Registry";

const base = "/admin/security";

function Sessions() {
  const { details } = useAdminAuth();
  const resource = useChatResource(getAdminSessions);
  const active = useRef(false);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState(null);
  async function revoke(scope, row) {
    if (active.current) return;
    const endsThis = scope === "all" || row?.current;
    if (endsThis && !window.confirm(scope === "all" ? "Revoke every administrator session? This signs you out of this session as well." :
      "Revoke this session and return to sign-in?")) return;
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
    <h2 className="text-lg font-semibold">Active administrator sessions</h2>
    <p className="mt-1 text-sm text-slate-600">Up to 100 active sessions. Revoking the current session returns you to sign-in.</p>
    <div className="my-4 flex flex-wrap gap-2">
      <button type="button" className={control} onClick={resource.refresh} disabled={pending}>Refresh sessions</button>
      <button type="button" className={control} onClick={() => revoke("others")} disabled={pending || !resource.data}>Revoke other sessions</button>
      <button type="button" className={control + " !text-red-800"} onClick={() => revoke("all")} disabled={pending || !resource.data}>Revoke all sessions</button>
    </div>
    {notice && <p role={notice.error ? "alert" : "status"} className="mb-2 text-sm">{notice.text}</p>}
    <LoadState resource={resource} />
    {resource.data && <Table name="Active sessions" rows={resource.data.items} empty="No active sessions were returned." columns={[
      ["Session", (row) => row.current ? "Current session" : "Other session"], ["Created", (row) => displayDate(row.createdAt)],
      ["Last activity", (row) => displayDate(row.lastActivityAt)], ["Idle expiration", (row) => displayDate(row.idleExpiresAt)],
      ["Absolute expiration", (row) => displayDate(row.expiresAt)],
      ["Action", (row) => <button type="button" className={control} disabled={pending} onClick={() => revoke("one", row)}>{row.current ? "Revoke current session" : "Revoke session"}</button>],
    ]} />}
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
