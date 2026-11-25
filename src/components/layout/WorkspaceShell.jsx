import { Suspense, useEffect, useRef, useState } from "react";
import { Link, Outlet, useLocation, useNavigationType } from "react-router-dom";
import { useAdminAuth } from "../../context/AdminAuth";
import { linkFor, navigation, workspaceLocation } from "../../routes/workspace";
import { Button, InlineAlert, SkipLink } from "../ui/Primitives";
import { Dialog } from "../ui/Dialog";
import { PortfolioLink } from "./Identity";
import { WorkspaceIcon } from "./WorkspaceIcon";

const groups = [...new Set(navigation.map(({ group }) => group))];
const preference = "portfolio-admin-sidebar-collapsed";
const desktop = "(min-width: 70rem)";

function readPreference() {
  try { return localStorage.getItem(preference) === "true"; } catch { return false; }
}

function Navigation({ active, current, compact = false, onNavigate }) {
  return <nav aria-label="Primary workspace navigation" className="workspace-navigation">
    {groups.map((group) => <div key={group} className="workspace-group">
      <p className="workspace-group-label">{group}</p>
      <ul>{navigation.filter((item) => item.group === group).map((item) => <li key={item.name}>
        <Link to={linkFor(item)} aria-current={active === item.name ? current : undefined} onClick={onNavigate}
          aria-label={compact ? item.label : undefined} data-tooltip={compact ? item.label : undefined} className="workspace-nav-link">
          <WorkspaceIcon name={item.icon} /><span className="workspace-nav-label">{item.label}</span>
        </Link>
      </li>)}</ul>
    </div>)}
  </nav>;
}

function Breadcrumbs({ items }) {
  return <nav aria-label="Breadcrumb" className="workspace-breadcrumbs">
    <ol>{items.map(({ label, to }, index) => <li key={label}>
      {index > 0 && <span aria-hidden="true" className="text-muted">/</span>}
      {to ? <Link to={to} className="ui-text-link">{label}</Link> : <span aria-current="page">{label}</span>}
    </li>)}</ol>
  </nav>;
}

export default function WorkspaceShell() {
  const location = useLocation();
  const navigationType = useNavigationType();
  const page = workspaceLocation(location.pathname, location.search);
  const { signOut } = useAdminAuth();
  const [compact, setCompact] = useState(readPreference);
  const [drawerKey, setDrawerKey] = useState(null);
  const [error, setError] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);
  const lock = useRef(false);
  const main = useRef(null);
  const route = useRef(location.pathname);
  const drawer = drawerKey === location.key;

  useEffect(() => {
    document.title = `${page.title} · Portfolio Admin`;
    return () => { document.title = "Portfolio Admin · Gaurav Kumar Yadav"; };
  }, [page.title]);

  useEffect(() => {
    const query = matchMedia(desktop);
    const close = (event) => { if (event.matches) setDrawerKey(null); };
    query.addEventListener("change", close);
    return () => query.removeEventListener("change", close);
  }, []);

  useEffect(() => {
    if (drawerKey !== null && !drawer) setDrawerKey(null);
    if (route.current === location.pathname) return;
    route.current = location.pathname;
    if (navigationType !== "POP") {
      window.scrollTo(0, 0);
      main.current?.focus({ preventScroll: true });
    }
  }, [drawer, drawerKey, location.pathname, navigationType]);

  function toggle() {
    const next = !compact;
    setCompact(next);
    try { localStorage.setItem(preference, String(next)); } catch { /* Presentation preference only. */ }
  }

  async function logout() {
    if (lock.current) return;
    lock.current = true;
    setLoggingOut(true);
    setError("");
    try { await signOut(); }
    catch (failure) { setError(failure.message); setDrawerKey(null); }
    finally { lock.current = false; setLoggingOut(false); }
  }

  const logoutButton = <Button variant="ghost" loading={loggingOut} onClick={logout} className="workspace-logout">
    <WorkspaceIcon name="logout" />{loggingOut ? "Signing out…" : "Logout"}
  </Button>;

  return <div className="workspace-shell" data-compact={compact ? "true" : undefined}>
    <SkipLink />
    <aside className="workspace-sidebar" aria-label="Workspace sidebar">
      <div className="workspace-sidebar-brand">
        <Link to="/admin" aria-label="Gaurav Kumar Yadav, workspace overview" className="workspace-wordmark">{compact ? "GK" : "Gaurav Kumar Yadav"}</Link>
        {!compact && <p className="workspace-group-label">Private workspace</p>}
      </div>
      <Navigation active={page.active} current={page.current} compact={compact} />
      <div className="workspace-sidebar-footer">{compact ? <a className="ui-text-link" aria-label="View Portfolio" href="https://ggauravky.vercel.app/" target="_blank" rel="noopener noreferrer">↗</a> : <PortfolioLink />}</div>
    </aside>
    <div className="workspace-content">
      <header className="workspace-topbar">
        <Button className="workspace-menu" aria-label="Open navigation" aria-haspopup="dialog" aria-expanded={drawer} onClick={() => setDrawerKey(location.key)}><WorkspaceIcon name="menu" /></Button>
        <Button className="workspace-toggle" aria-label={compact ? "Expand sidebar" : "Collapse sidebar"} aria-pressed={compact} onClick={toggle}><WorkspaceIcon name="panel" /></Button>
        <Breadcrumbs items={page.crumbs} />
        <div className="workspace-topbar-action">{logoutButton}</div>
      </header>
      <main id="main-content" tabIndex={-1} ref={main} className="workspace-main">
        {error && <InlineAlert tone="error" className="mb-4">{error}</InlineAlert>}
        <Suspense fallback={<InlineAlert>Loading workspace…</InlineAlert>}><Outlet /></Suspense>
      </main>
    </div>
    {drawer && <Dialog title="Workspace navigation" description={`Current view: ${page.crumbs.map(({ label }) => label).join(" / ")}`} drawer
      onDismiss={() => setDrawerKey(null)}>
      <Navigation active={page.active} current={page.current} onNavigate={() => setDrawerKey(null)} />
      <div className="workspace-drawer-footer"><PortfolioLink />{logoutButton}</div>
    </Dialog>}
  </div>;
}
